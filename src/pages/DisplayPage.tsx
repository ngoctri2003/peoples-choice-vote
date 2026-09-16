import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type VoteCount } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import { GRADIENT_TEXT } from '../components/Blobs'

const COLORS = ['#ff5da2', '#5ad1ff', '#ffd166', '#7bf1a8', '#c792ff']
const GOLD = '#ffd166'

// Sizes are viewport-height-relative (not px) so the cloud always fits the
// screen without scrolling, no matter how lopsided the vote counts get —
// a projector screen has no scrollbar.
const MIN_FONT_VH = 3.5
const MAX_FONT_VH = 13

// A small deterministic wobble per team so the cloud feels organic
// instead of a perfect grid, without jittering on every re-render.
function seededWobble(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const rotation = ((hash % 900) / 100 - 4.5) * 2 // -9deg .. 9deg
  const delay = (hash % 400) / 100 // 0s .. 4s
  return { rotation, delay }
}

export default function DisplayPage() {
  const { session } = useActiveSession()
  const { label, isOver, msLeft } = useCountdown(session?.ends_at, session?.paused ? session.paused_at : null)
  const [counts, setCounts] = useState<VoteCount[]>([])
  const [pulseId, setPulseId] = useState<string | null>(null)

  const basePhase = sessionPhase(session)
  const phase = basePhase === 'open' && isOver ? 'closed' : basePhase
  const paused = session?.paused ?? false

  const loadCounts = useCallback(async () => {
    if (!session) {
      setCounts([])
      return
    }
    const { data } = await supabase.rpc('get_vote_counts', { p_session_id: session.id })
    setCounts((data as VoteCount[]) ?? [])
  }, [session])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  useEffect(() => {
    if (!session) return
    const channel = supabase
      .channel(`votes_${session.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes', filter: `session_id=eq.${session.id}` },
        (payload) => {
          setPulseId(payload.new.team_id as string)
          loadCounts()
          setTimeout(() => setPulseId(null), 900)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session, loadCounts])

  // Team names come through get_vote_counts, so a name edit on /mc needs its
  // own trigger to refetch — a vote INSERT alone wouldn't pick it up.
  useEffect(() => {
    const channel = supabase
      .channel('teams_changes_display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => loadCounts())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadCounts])

  const revealed = session?.revealed ?? false

  const totalVotes = counts.reduce((sum, c) => sum + c.votes, 0)
  const maxVotes = Math.max(1, ...counts.map((c) => c.votes))
  const winner =
    phase === 'closed' && counts.length > 0 && totalVotes > 0
      ? counts.reduce((a, b) => (b.votes > a.votes ? b : a))
      : null

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2.5,
        color: [...COLORS, GOLD][i % (COLORS.length + 1)],
        size: 6 + Math.random() * 8,
      })),
    [winner?.team_id],
  )

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        color: '#fff',
        fontFamily: 'inherit',
        background:
          'radial-gradient(circle at 15% 20%, rgba(255,93,162,0.35), transparent 45%), ' +
          'radial-gradient(circle at 85% 75%, rgba(90,209,255,0.3), transparent 45%), ' +
          'linear-gradient(135deg, #180b33, #0b0620 60%)',
        backgroundSize: '160% 160%, 160% 160%, 100% 100%',
        animation: 'bg-drift 18s ease-in-out infinite',
      }}
    >
      {winner && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                top: 0,
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 0.4,
                background: p.color,
                borderRadius: 2,
                animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <div style={{ position: 'relative', padding: '36px 5vw', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              margin: 0,
              fontWeight: 900,
              letterSpacing: -0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '1.1em' }}>🏆</span>
            <span style={GRADIENT_TEXT}>People's Choice Award</span>
          </h1>
          <div
            style={{
              fontSize: 'clamp(20px, 3vw, 34px)',
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              padding: '10px 26px',
              borderRadius: 999,
              background: paused
                ? 'rgba(148,163,184,0.18)'
                : phase === 'open'
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,209,102,0.15)',
              border: `2px solid ${paused ? '#94a3b8' : phase === 'open' ? 'rgba(255,255,255,0.25)' : GOLD}`,
              color: paused ? '#cbd5e1' : phase === 'closed' ? GOLD : '#fff',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              animation:
                phase === 'open' && !paused && msLeft <= 30000
                  ? 'ring-pulse 1.4s ease-out infinite'
                  : undefined,
            }}
          >
            {phase === 'idle'
              ? '--:--'
              : phase === 'closed'
                ? '🎉 ĐÃ KẾT THÚC'
                : paused
                  ? `⏸ TẠM DỪNG (${label})`
                  : `⏳ ${label}`}
          </div>
        </div>

        {phase === 'idle' && (
          <Centered>
            <div style={{ fontSize: 'clamp(24px, 3vw, 36px)', opacity: 0.85 }}>
              Đang chờ MC bắt đầu bình chọn…
            </div>
          </Centered>
        )}

        {phase !== 'idle' && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              alignContent: 'center',
              gap: '1.5vh 3vw',
              padding: '2vh 2vw',
            }}
          >
            {counts.map((c, i) => {
              const isWinner = winner?.team_id === c.team_id
              const fontSize = `${MIN_FONT_VH + (c.votes / maxVotes) * (MAX_FONT_VH - MIN_FONT_VH)}vh`
              const color = isWinner ? GOLD : COLORS[i % COLORS.length]
              const { rotation, delay } = seededWobble(c.team_id)
              const dimmed = phase === 'closed' && !isWinner && totalVotes > 0

              const displayName = revealed ? c.name : 'Đội ẩn danh'

              return (
                <div
                  key={c.team_id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    opacity: dimmed ? 0.45 : 1,
                    transition: 'opacity 0.6s ease',
                  }}
                >
                  <div
                    key={revealed ? 'revealed' : 'hidden'}
                    style={
                      {
                        '--rot': `${rotation}deg`,
                        fontSize,
                        fontWeight: 800,
                        color,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        transform: `rotate(${rotation}deg)`,
                        animation: `pop-in 0.5s ease-out, float ${5 + delay}s ease-in-out ${delay}s infinite`,
                        ...(pulseId === c.team_id
                          ? { animation: `pulse-glow 0.9s ease-out` }
                          : isWinner
                            ? { animation: `crown-bounce 1.4s ease-in-out infinite` }
                            : {}),
                      } as unknown as React.CSSProperties
                    }
                  >
                    {isWinner ? '👑 ' : ''}
                    {displayName}
                  </div>
                  <div style={{ fontSize: 16, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
                    {c.votes} vote{c.votes === 1 ? '' : 's'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 15, opacity: 0.5 }}>
          {totalVotes} lượt bình chọn đã ghi nhận
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  )
}
