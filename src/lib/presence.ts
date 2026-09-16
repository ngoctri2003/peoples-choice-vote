import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getVoterToken } from './voterToken'

const WAITING_ROOM_CHANNEL = 'waiting_room'

// Call on /vote so this visitor is counted while their tab is open. Uses the
// same stable voter token as voting itself, so a refresh doesn't inflate
// the count with a second presence entry.
export function useReportPresence() {
  useEffect(() => {
    const channel = supabase.channel(WAITING_ROOM_CHANNEL, {
      config: { presence: { key: getVoterToken() } },
    })
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() })
      }
    })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

// Call on /display to read the live count without joining as a participant.
export function useOnlineCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const channel = supabase.channel(WAITING_ROOM_CHANNEL)
    channel
      .on('presence', { event: 'sync' }, () => {
        setCount(Object.keys(channel.presenceState()).length)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}
