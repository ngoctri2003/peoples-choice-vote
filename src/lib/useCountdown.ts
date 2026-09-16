import { useEffect, useState } from 'react'

// When pausedAt is set, the countdown freezes at (endsAt - pausedAt) instead
// of continuing to tick down against the real clock, so a pause visibly
// stops the clock rather than just delaying when it hits zero.
export function useCountdown(endsAt: string | null | undefined, pausedAt?: string | null) {
  const anchor = pausedAt ? new Date(pausedAt).getTime() : null

  const [msLeft, setMsLeft] = useState(() =>
    endsAt ? new Date(endsAt).getTime() - (anchor ?? Date.now()) : 0,
  )

  useEffect(() => {
    if (!endsAt) {
      setMsLeft(0)
      return
    }
    if (anchor !== null) {
      setMsLeft(new Date(endsAt).getTime() - anchor)
      return
    }
    const tick = () => setMsLeft(new Date(endsAt).getTime() - Date.now())
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt, anchor])

  const clamped = Math.max(0, msLeft)
  const totalSeconds = Math.ceil(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const label = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return { msLeft: clamped, label, isOver: clamped <= 0 }
}
