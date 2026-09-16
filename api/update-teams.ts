import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type TeamUpdate = { id: string; name: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (req.body?.key !== process.env.MC_CONTROL_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const teams = req.body?.teams as TeamUpdate[] | undefined
  if (!Array.isArray(teams) || teams.some((t) => !t.id || typeof t.name !== 'string')) {
    res.status(400).json({ error: 'Invalid teams payload' })
    return
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )

  for (const team of teams) {
    const { error } = await supabase.from('teams').update({ name: team.name.trim() }).eq('id', team.id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }
  }

  res.status(200).json({ ok: true })
}
