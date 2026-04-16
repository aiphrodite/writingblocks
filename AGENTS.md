# AGENTS.md

## Cursor Cloud specific instructions

**WritingBlocks** is a single-page React writing/idea management app. No backend or database is required — data is persisted in the browser's `localStorage`.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Vite Dev Server | `npm run dev` | 5173 | Serves the SPA with HMR; also hosts git snapshot API endpoints (`/api/git-log`, `/api/git-show`, `/api/git-commit`) |

### Standard commands

See `package.json` scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

### Non-obvious notes

- **ESLint has pre-existing errors** (11 errors, 1 warning) in the committed codebase. These are primarily `react-refresh/only-export-components` in shadcn UI files, `react-hooks/set-state-in-effect` in `App.jsx`, and `no-undef` for Node.js globals (`process`, `__dirname`) in `vite.config.js`. `npm run lint` exits with code 1 due to these.
- The git snapshot feature (History panel) uses a custom Vite plugin in `vite.config.js` that spawns `git` subprocesses. It reads/writes `data/ideas.json` and creates commits in the local repo. Be careful not to accidentally commit `data/ideas.json` as part of unrelated PRs.
- No TypeScript — the codebase is JavaScript (JSX) only.
- Uses path alias `@/` mapped to `./src/` (configured in both `vite.config.js` and `jsconfig.json`).
