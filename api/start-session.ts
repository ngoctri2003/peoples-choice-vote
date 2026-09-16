import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const VOTE_DURATION_MS = 5 * 60 * 1000

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

  // Close any still-open sessions before starting a new one.
  await supabase.from('voting_sessions').update({ status: 'closed' }).eq('status', 'open')

  const startedAt = new Date()
  const endsAt = new Date(startedAt.getTime() + VOTE_DURATION_MS)

  const { data, error } = await supabase
    .from('voting_sessions')
    .insert({ started_at: startedAt.toISOString(), ends_at: endsAt.toISOString(), status: 'open' })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(200).json({ session: data })
}
