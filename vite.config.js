import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { spawnSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

function gitApiPlugin() {
  return {
    name: 'git-api',
    configureServer(server) {

      // GET /api/git-log — list all snapshot commits
      server.middlewares.use('/api/git-log', (req, res) => {
        const result = spawnSync(
          'git', ['log', '--pretty=format:%H|||%s|||%aI|||%an', '--', 'data/ideas.json'],
          { cwd: process.cwd(), encoding: 'utf8' }
        )
        const lines = (result.stdout || '').trim().split('\n').filter(Boolean)
        const commits = lines.map(line => {
          const [hash, subject, date, author] = line.split('|||')
          return { hash, subject, date, author }
        })
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(commits))
      })

      // GET /api/git-show?hash=<sha> — ideas.json at that commit
      server.middlewares.use('/api/git-show', (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const hash = url.searchParams.get('hash') || ''
        if (!/^[a-f0-9]{6,40}$/.test(hash)) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid hash' }))
          return
        }
        const result = spawnSync('git', ['show', `${hash}:data/ideas.json`], {
          cwd: process.cwd(), encoding: 'utf8'
        })
        if (result.status !== 0) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(result.stdout)
      })

      // POST /api/git-commit — write ideas.json and commit
      server.middlewares.use('/api/git-commit', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', chunk => (body += chunk))
        req.on('end', () => {
          try {
            const { ideas, message } = JSON.parse(body)
            const dataDir = path.join(process.cwd(), 'data')
            if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
            writeFileSync(path.join(dataDir, 'ideas.json'), JSON.stringify(ideas, null, 2))
            spawnSync('git', ['add', 'data/ideas.json'], { cwd: process.cwd() })
            const msg = message?.trim() || `Snapshot — ${new Date().toLocaleString()}`
            const commit = spawnSync('git', ['commit', '-m', msg], {
              cwd: process.cwd(), encoding: 'utf8'
            })
            if (commit.status !== 0) {
              const stderr = commit.stderr || ''
              // "nothing to commit" is not really an error
              if (stderr.includes('nothing to commit')) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, noop: true }))
                return
              }
              throw new Error(stderr)
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), gitApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
