import { useEffect, useState } from 'react'

export function useCountdown(endsAt: string | null | undefined) {
  const [msLeft, setMsLeft] = useState(() =>
    endsAt ? new Date(endsAt).getTime() - Date.now() : 0,
  )

  useEffect(() => {
    if (!endsAt) {
      setMsLeft(0)
      return
    }
    const tick = () => setMsLeft(new Date(endsAt).getTime() - Date.now())
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt])

  const clamped = Math.max(0, msLeft)
  const totalSeconds = Math.ceil(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const label = `${minutes}:${seconds.toString().padStart(2, '0')}`

  return { msLeft: clamped, label, isOver: clamped <= 0 }
}
