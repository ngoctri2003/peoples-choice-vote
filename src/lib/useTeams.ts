import { useEffect, useState } from 'react'
import { supabase, type Team } from './supabase'

// Keeps team names live: if the BTC edits a name on /mc while this page is
// already open, it updates here too instead of needing a manual reload.
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('teams').select('*').order('sort_order', { ascending: true })
      if (!cancelled) setTeams((data as Team[]) ?? [])
    }
    load()

    const channel = supabase
      .channel('teams_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => load())
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return teams
}
