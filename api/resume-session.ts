import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (req.body?.key !== process.env.MC_CONTROL_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )

  const { data: session, error: findError } = await supabase
    .from('voting_sessions')
    .select('id, ends_at, paused_at')
    .eq('status', 'open')
    .eq('paused', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    res.status(500).json({ error: findError.message })
    return
  }
  if (!session || !session.paused_at) {
    res.status(404).json({ error: 'No paused session found' })
    return
  }

  // Shift the deadline forward by however long the pause lasted, so the
  // remaining vote time is preserved instead of lost.
  const pausedMs = Date.now() - new Date(session.paused_at).getTime()
  const newEndsAt = new Date(new Date(session.ends_at).getTime() + pausedMs)

  const { error } = await supabase
    .from('voting_sessions')
    .update({ paused: false, paused_at: null, ends_at: newEndsAt.toISOString() })
    .eq('id', session.id)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ ok: true })
}
