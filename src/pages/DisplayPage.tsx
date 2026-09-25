import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type VoteCount } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import { useOnlineCount } from '../lib/presence'
import { GRADIENT_TEXT } from '../components/Blobs'
import QrCode from '../components/QrCode'
import WordCloud from '../components/WordCloud'

// This screen sits on top of the event's own "People's Choice Award" banner
// artwork (dark navy), so it uses its own light-on-dark palette instead of
// the rest of the app's light theme, which would wash out against it.
const TEXT = '#ffffff'
const TEXT_MUTED = 'rgba(255,255,255,0.78)'
const TEAM_COLORS = ['#ff5da2', '#5ad1ff', '#ffd166', '#7bf1a8', '#c792ff']
const GOLD = '#ffd166'
// A dark glow behind every foreground text/number, so it stays readable
// against the banner artwork now that the vignette no longer blacks the
// middle of it out — a lighter overlay alone would wash text out.
const TEXT_SHADOW = '0 2px 10px rgba(0,0,0,0.9), 0 0 22px rgba(0,0,0,0.55)'

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

type Ranked = VoteCount & { rank: number }

// Competition ranking (1, 2, 2, 4…) so a tie shares a rank instead of one
// team being arbitrarily placed above the other. Sorting the already
// session-shuffled array (not sort_order) keeps ties from leaking /vote's
// fixed team order while names are still hidden.
function rankCounts(counts: VoteCount[]): Ranked[] {
  const sorted = [...counts].sort((a, b) => b.votes - a.votes)
  return sorted.map((c) => ({ ...c, rank: sorted.findIndex((x) => x.votes === c.votes) + 1 }))
}

export default function DisplayPage() {
  const { session } = useActiveSession()
  const { label, isOver, msLeft } = useCountdown(session?.ends_at, session?.paused ? session.paused_at : null)
  const [counts, setCounts] = useState<VoteCount[]>([])
  const [pulseId, setPulseId] = useState<string | null>(null)
  const onlineCount = useOnlineCount()
  const voteUrl = `${window.location.origin}/vote`

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

  // Names stay hidden while voting is open (so the audience can't match a
  // big-screen bar to a team), but always show once results are in — there's
  // no separate "reveal" step for the MC to trigger anymore.
  const revealed = phase === 'closed'
  const shuffledCounts = session ? shuffleForSession(counts, session.id) : counts

  const totalVotes = counts.reduce((sum, c) => sum + c.votes, 0)
  const maxVotes = Math.max(1, ...counts.map((c) => c.votes))
  // All teams tied for first place are winners, not just the first one found —
  // a 3-way tie should crown all 3, not arbitrarily pick one.
  const winnerIds = new Set(
    phase === 'closed' && counts.length > 0 && totalVotes > 0
      ? counts.filter((c) => c.votes === maxVotes).map((c) => c.team_id)
      : [],
  )
  const winnerKey = [...winnerIds].sort().join(',')
  const goldOverride = Object.fromEntries([...winnerIds].map((id) => [id, GOLD]))

  const cloudItems = shuffledCounts.map((c) => ({
    id: c.team_id,
    name: revealed ? c.name : 'Đội ẩn danh',
    votes: c.votes,
  }))
  const ranked = phase === 'closed' ? rankCounts(shuffledCounts) : []

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2.5,
        color: [...TEAM_COLORS, GOLD][i % (TEAM_COLORS.length + 1)],
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
        color: TEXT,
        fontFamily: 'inherit',
        // A light vignette, not a near-opaque one — the banner artwork stays
        // visible everywhere (including the middle); foreground text relies
        // on TEXT_SHADOW for contrast instead of blacking out the art behind it.
        background:
          'radial-gradient(ellipse at center, rgba(5,10,26,0.6) 0%, rgba(5,10,26,0.55) 35%, rgba(5,10,26,0.45) 72%, rgba(5,10,26,0.35) 100%), url(/pca-banner.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
        {phase === 'idle' ? (
          // Bigger, centered hero title with the sponsor logo — the countdown
          // pill is skipped here since it has nothing meaningful to show
          // ("--:--") before the BTC starts a session. The logo is
          // absolutely positioned at the far left so it can't compete with
          // the title for space — a shared-row layout (e.g. a grid column)
          // would either crowd the two together or shrink to fit, neither of
          // which is "pushed apart" the way this needs to look.
          <div
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              // Reserves room for the logo so the centered title is shifted
              // just enough to clear it, instead of overlapping when the
              // title itself is wide.
              paddingLeft: 'clamp(150px, 17vw, 260px)',
            }}
          >
            <img
              src="/dss-logo.png"
              alt="DSS"
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 'clamp(40px, 5.5vw, 72px)',
                width: 'auto',
              }}
            />
            <h1
              style={{
                fontSize: 'clamp(34px, 5.4vw, 68px)',
                margin: 0,
                fontWeight: 900,
                letterSpacing: -0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '1.1em' }}>🏆</span>
              <span style={GRADIENT_TEXT}>People's Choice Award</span>
            </h1>
          </div>
        ) : (
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
                  ? 'rgba(30,35,50,0.55)'
                  : phase === 'open'
                    ? 'rgba(20,24,40,0.5)'
                    : 'rgba(40,32,10,0.55)',
                border: `2px solid ${paused ? '#94a3b8' : phase === 'open' ? 'rgba(255,255,255,0.3)' : GOLD}`,
                color: paused ? '#cbd5e1' : phase === 'closed' ? GOLD : TEXT,
                textShadow: TEXT_SHADOW,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                animation:
                  phase === 'open' && !paused && msLeft <= 30000
                    ? 'ring-pulse 1.4s ease-out infinite'
                    : undefined,
              }}
            >
              {phase === 'closed'
                ? '🎉 ĐÃ KẾT THÚC'
                : paused
                  ? `⏸ TẠM DỪNG (${label})`
                  : `⏳ ${label}`}
            </div>
          </div>
        )}

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
              <QrCode value={voteUrl} size="min(68vh, 34vw)" />
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
                  boxShadow: `0 0 50px ${GOLD}33`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(20,16,8,0.45)',
                  animation: 'ring-pulse 2.2s ease-out infinite',
                }}
              >
                <div style={{ fontSize: 'min(18vh, 12vw)', fontWeight: 900, color: GOLD, lineHeight: 1, textShadow: TEXT_SHADOW }}>
                  {onlineCount}
                </div>
                <div style={{ fontSize: 'clamp(16px, 2vw, 26px)', color: TEXT_MUTED, marginTop: '1.5vh', textShadow: TEXT_SHADOW }}>
                  người đang chờ
                </div>
              </div>
              <div style={{ fontSize: 'clamp(18px, 2.4vw, 32px)', color: TEXT_MUTED, fontWeight: 700, textAlign: 'center', textShadow: TEXT_SHADOW }}>
                Đang chờ BTC bắt đầu bình chọn…
              </div>
            </div>
          </div>
        )}

        {phase === 'open' && (
          <div style={{ flex: 1, minHeight: 0, marginTop: '2vh' }}>
            <WordCloud items={cloudItems} colors={TEAM_COLORS} pulseIds={pulseId ? new Set([pulseId]) : undefined} />
          </div>
        )}

        {phase === 'closed' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '3vw', marginTop: '2vh' }}>
            <div style={{ flex: 1.2, minWidth: 0 }}>
              <WordCloud
                items={cloudItems}
                colors={TEAM_COLORS}
                colorOverride={goldOverride}
                highlightIds={winnerIds}
                dimOthers
              />
            </div>
            <div
              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.4vh' }}
            >
              <div style={{ fontSize: 'clamp(16px, 2vw, 28px)', fontWeight: 800, color: GOLD, marginBottom: '0.4vh', textShadow: TEXT_SHADOW }}>
                🏆 Kết quả bình chọn
              </div>
              {totalVotes === 0 && (
                <div style={{ color: TEXT_MUTED, fontSize: 'clamp(16px, 1.8vw, 24px)', textShadow: TEXT_SHADOW }}>Chưa có phiếu bầu nào.</div>
              )}
              {ranked.map((t, i) => {
                const isWinner = t.rank === 1 && totalVotes > 0
                const pct = (t.votes / maxVotes) * 100
                const accent = isWinner ? GOLD : TEAM_COLORS[i % TEAM_COLORS.length]
                return (
                  <div
                    key={t.team_id}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1vw',
                      padding: '1.2vh 1.2vw',
                      borderRadius: 16,
                      background: isWinner ? 'rgba(40,32,10,0.55)' : 'rgba(10,12,22,0.5)',
                      border: `1px solid ${isWinner ? 'rgba(255,209,102,0.45)' : 'rgba(255,255,255,0.14)'}`,
                      animation: `pop-in 0.5s ease-out ${i * 0.1}s both`,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: `${pct}%`,
                        background: isWinner
                          ? 'linear-gradient(90deg, rgba(255,209,102,0.2), rgba(255,209,102,0.03))'
                          : `linear-gradient(90deg, ${accent}26, transparent)`,
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        width: '2em',
                        textAlign: 'center',
                        fontSize: 'clamp(16px, 1.8vw, 26px)',
                        fontWeight: 900,
                        color: accent,
                        textShadow: TEXT_SHADOW,
                      }}
                    >
                      {isWinner ? '👑' : `#${t.rank}`}
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        minWidth: 0,
                        fontSize: 'clamp(14px, 1.6vw, 24px)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: TEXT_SHADOW,
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        fontSize: 'clamp(14px, 1.5vw, 22px)',
                        fontWeight: 800,
                        color: accent,
                        fontVariantNumeric: 'tabular-nums',
                        textShadow: TEXT_SHADOW,
                      }}
                    >
                      {t.votes}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 15, color: TEXT_MUTED, textShadow: TEXT_SHADOW }}>
          {totalVotes} lượt bình chọn đã ghi nhận
        </div>
      </div>
    </div>
  )
}
