import { supabase } from '@/lib/supabase'

export async function fetchRemoteSettings(userId) {
  if (!supabase || !userId) return null

  const { data, error } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.settings ?? null
}

export async function saveRemoteSettings(settings, userId) {
  if (!supabase || !userId) return

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: userId,
      settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw error
}
