import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Email không hợp lệ' })
    return
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )

  const { data: allowed } = await supabase
    .from('allowed_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (!allowed) {
    res.status(403).json({ error: 'Email này không có trong danh sách được phép bình chọn' })
    return
  }

  // Upserting by email keeps the same voter_token across repeat verifications
  // (new device, cleared browser data, etc.) so one email can't vote twice.
  const { data: voter, error } = await supabase
    .from('voters')
    .upsert({ email }, { onConflict: 'email' })
    .select('voter_token')
    .single()

  if (error || !voter) {
    res.status(500).json({ error: error?.message ?? 'Không thể xác thực email' })
    return
  }

  res.status(200).json({ email, voterToken: voter.voter_token })
}
