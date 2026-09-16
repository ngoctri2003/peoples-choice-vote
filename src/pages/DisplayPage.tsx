import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type VoteCount } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import { useOnlineCount } from '../lib/presence'
import { GRADIENT_TEXT } from '../components/Blobs'
import QrCode from '../components/QrCode'

const COLORS = ['#ff5da2', '#5ad1ff', '#ffd166', '#7bf1a8', '#c792ff']
const GOLD = '#ffd166'

// Sizes are viewport-height-relative (not px) so the cloud always fits the
// screen without scrolling, no matter how lopsided the vote counts get —
// a projector screen has no scrollbar.
const MIN_FONT_VH = 5.5
const MAX_FONT_VH = 17

// A small deterministic wobble per team so the cloud feels organic
// instead of a perfect grid, without jittering on every re-render.
function seededWobble(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const rotation = ((hash % 900) / 100 - 4.5) * 2 // -9deg .. 9deg
  const delay = (hash % 400) / 100 // 0s .. 4s
  return { rotation, delay }
}

function stringHash(s: string) {
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return hash
}

// Positions here are deliberately shuffled relative to /vote's fixed
// sort_order, so the audience can't match a big-screen bar to a team just by
// its position while names are still hidden. The order is stable for a given
// session (same shuffle on every re-render/reload) but differs per round.
function shuffleForSession<T extends { team_id: string }>(items: T[], sessionId: string): T[] {
  return [...items].sort(
    (a, b) => stringHash(sessionId + a.team_id) - stringHash(sessionId + b.team_id),
  )
}

// Approximate average glyph width as a fraction of font-size for this bold
// rounded font — used to cap font-size by actual text length so a long real
// team name can't overflow the screen the way a fixed vw fraction would.
const AVG_CHAR_WIDTH_RATIO = 0.62

function useViewportSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

export default function DisplayPage() {
  const { session } = useActiveSession()
  const { label, isOver, msLeft } = useCountdown(session?.ends_at, session?.paused ? session.paused_at : null)
  const [counts, setCounts] = useState<VoteCount[]>([])
  const [pulseId, setPulseId] = useState<string | null>(null)
  const onlineCount = useOnlineCount()
  const voteUrl = `${window.location.origin}/vote`
  const viewport = useViewportSize()

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
  const shuffledCounts = session ? shuffleForSession(counts, session.id) : counts

  const totalVotes = counts.reduce((sum, c) => sum + c.votes, 0)
  const maxVotes = Math.max(1, ...counts.map((c) => c.votes))
  const minVotes = counts.length > 0 ? Math.min(...counts.map((c) => c.votes)) : 0
  // Sized by where each team sits between the current lowest and highest
  // count, not vote-count-vs-max alone — vs-max alone compresses toward the
  // top once every team has racked up a lot of votes (e.g. 32 vs 51 is a
  // big lead, but 32/51 and 51/51 look nearly identical as raw ratios).
  const voteSpread = Math.max(1, maxVotes - minVotes)
  // All teams tied for first place are winners, not just the first one found —
  // a 3-way tie should crown all 3, not arbitrarily pick one.
  const winnerIds = new Set(
    phase === 'closed' && counts.length > 0 && totalVotes > 0
      ? counts.filter((c) => c.votes === maxVotes).map((c) => c.team_id)
      : [],
  )
  const winnerKey = [...winnerIds].sort().join(',')

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
    [winnerKey],
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
      {winnerIds.size > 0 && (
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
          <div style={{ flex: 1, minHeight: 0, display: 'flex', marginTop: '2vh' }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1vh 2vw',
              }}
            >
              <QrCode value={voteUrl} size="min(80vh, 40vw)" />
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3vh',
                padding: '2vh 2vw',
              }}
            >
              <div
                style={{
                  width: 'min(70vh, 40vw)',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  border: `3px solid ${GOLD}`,
                  boxShadow: `0 0 60px ${GOLD}55`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,209,102,0.06)',
                  animation: 'ring-pulse 2.2s ease-out infinite',
                }}
              >
                <div style={{ fontSize: 'min(18vh, 12vw)', fontWeight: 900, color: GOLD, lineHeight: 1 }}>
                  {onlineCount}
                </div>
                <div style={{ fontSize: 'clamp(16px, 2vw, 26px)', opacity: 0.8, marginTop: '1.5vh' }}>
                  người đang chờ
                </div>
              </div>
              <div style={{ fontSize: 'clamp(18px, 2.4vw, 32px)', opacity: 0.8, fontWeight: 700, textAlign: 'center' }}>
                Đang chờ MC bắt đầu bình chọn…
              </div>
            </div>
          </div>
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
            {shuffledCounts.map((c, i) => {
              const isWinner = winnerIds.has(c.team_id)
              const displayName = revealed ? c.name : 'Đội ẩn danh'

              const sizeRatio = (c.votes - minVotes) / voteSpread
              const idealPx = ((MIN_FONT_VH + sizeRatio * (MAX_FONT_VH - MIN_FONT_VH)) / 100) * viewport.height
              // Capped by the name's actual length too, so a long real team
              // name can't overflow the screen the way a fixed vh/vw split
              // would once revealed — vh scaling alone doesn't know text length.
              const maxWidthPx = viewport.width * 0.88
              const widthCappedPx = maxWidthPx / (displayName.length * AVG_CHAR_WIDTH_RATIO)
              const fontSize = `${Math.min(idealPx, widthCappedPx)}px`
              const color = isWinner ? GOLD : COLORS[i % COLORS.length]
              const { rotation, delay } = seededWobble(c.team_id)
              const dimmed = phase === 'closed' && !isWinner && totalVotes > 0

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
                        transition: 'font-size 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.4s ease',
                        // float only ever touches `transform`, and pulse-glow /
                        // crown-glow only ever touch `filter` — layered together
                        // like this, a new vote's glow can't interrupt or snap
                        // the gentle wobble the way overriding `animation` did.
                        animation: [
                          'pop-in 0.5s ease-out',
                          `float ${5 + delay}s ease-in-out ${delay}s infinite`,
                          pulseId === c.team_id ? 'pulse-glow 0.9s ease-out' : null,
                          isWinner ? 'crown-glow 1.6s ease-in-out infinite' : null,
                        ]
                          .filter(Boolean)
                          .join(', '),
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
