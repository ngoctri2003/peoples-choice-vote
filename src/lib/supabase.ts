import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars')
}

export const supabase = createClient(url, anonKey)

export type Team = {
  id: string
  code: string
  name: string
  sort_order: number
}

export type VotingSession = {
  id: string
  started_at: string
  ends_at: string
  status: 'open' | 'closed'
  revealed: boolean
  paused: boolean
  paused_at: string | null
}

export type VoteCount = {
  team_id: string
  code: string
  name: string
  sort_order: number
  votes: number
}
