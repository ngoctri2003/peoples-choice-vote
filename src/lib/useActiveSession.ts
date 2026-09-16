import { useEffect, useState } from 'react'
import { supabase, type VotingSession } from './supabase'

export function useActiveSession() {
  const [session, setSession] = useState<VotingSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data } = await supabase
          .from('voting_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled) setSession(data as VotingSession | null)
      } catch (err) {
        console.error('Failed to load voting session', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    const channel = supabase
      .channel('voting_sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voting_sessions' },
        () => load(),
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { session, loading }
}

export function sessionPhase(session: VotingSession | null): 'idle' | 'open' | 'closed' {
  if (!session) return 'idle'
  if (session.status === 'closed') return 'closed'
  if (new Date(session.ends_at).getTime() <= Date.now()) return 'closed'
  return 'open'
}
