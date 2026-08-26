import { supabase } from '@/lib/supabase'
import { createIdea } from '@/lib/storage'

function toIso(value) {
  return new Date(value || Date.now()).toISOString()
}

function fromIso(value) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : Date.now()
}

function toDbIdea(idea, userId) {
  return {
    id: idea.id,
    user_id: userId,
    type: idea.type === 'block' ? 'block' : 'build',
    title: idea.title ?? '',
    context: idea.context ?? '',
    tweet: idea.tweet ?? '',
    linkedin: idea.linkedin ?? '',
    substack_title: idea.substackTitle ?? '',
    substack_body: idea.substackBody ?? '',
    shorts: idea.shorts ?? '',
    vod: idea.vod ?? '',
    flow_graph: idea.flowGraph ?? null,
    created_at: toIso(idea.createdAt),
    updated_at: toIso(idea.updatedAt),
  }
}

function fromDbIdea(row, sourceBlockIds = []) {
  return createIdea({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title ?? '',
    context: row.context ?? '',
    tweet: row.tweet ?? '',
    linkedin: row.linkedin ?? '',
    substackTitle: row.substack_title ?? '',
    substackBody: row.substack_body ?? '',
    shorts: row.shorts ?? '',
    vod: row.vod ?? '',
    flowGraph: row.flow_graph ?? null,
    sourceBlockIds,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  })
}

export async function fetchRemoteIdeas(userId) {
  if (!supabase || !userId) return []

  const [{ data: ideas, error: ideasError }, { data: inputs, error: inputsError }] = await Promise.all([
    supabase
      .from('ideas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('build_inputs')
      .select('build_id, block_id')
      .eq('user_id', userId),
  ])

  if (ideasError) throw ideasError
  if (inputsError) throw inputsError

  const inputsByBuild = new Map()
  for (const input of inputs ?? []) {
    const current = inputsByBuild.get(input.build_id) ?? []
    current.push(input.block_id)
    inputsByBuild.set(input.build_id, current)
  }

  return (ideas ?? []).map(row => fromDbIdea(row, inputsByBuild.get(row.id) ?? []))
}

export async function saveRemoteIdea(idea, userId) {
  if (!supabase || !userId) return

  const nextIdea = { ...idea, userId, updatedAt: idea.updatedAt ?? Date.now() }
  const { error } = await supabase
    .from('ideas')
    .upsert(toDbIdea(nextIdea, userId), { onConflict: 'user_id,id' })

  if (error) throw error
  await saveRemoteBuildInputs(nextIdea, userId)
}

export async function saveRemoteIdeas(ideas, userId) {
  if (!supabase || !userId || ideas.length === 0) return

  const rows = ideas.map(idea => toDbIdea({ ...idea, userId }, userId))
  const { error } = await supabase
    .from('ideas')
    .upsert(rows, { onConflict: 'user_id,id' })

  if (error) throw error

  for (const idea of ideas) {
    await saveRemoteBuildInputs({ ...idea, userId }, userId)
  }
}

export async function saveRemoteBuildInputs(idea, userId) {
  if (!supabase || !userId || idea.type !== 'build') return

  const { error: deleteError } = await supabase
    .from('build_inputs')
    .delete()
    .eq('user_id', userId)
    .eq('build_id', idea.id)

  if (deleteError) throw deleteError

  const sourceBlockIds = Array.isArray(idea.sourceBlockIds) ? [...new Set(idea.sourceBlockIds)] : []
  if (sourceBlockIds.length === 0) return

  const rows = sourceBlockIds.map(blockId => ({
    user_id: userId,
    build_id: idea.id,
    block_id: blockId,
  }))

  const { error: insertError } = await supabase.from('build_inputs').insert(rows)
  if (insertError) throw insertError
}

export async function deleteRemoteIdea(id, userId) {
  if (!supabase || !userId) return

  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)

  if (error) throw error
}
