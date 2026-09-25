import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import { useTeams } from '../lib/useTeams'
import { useReportPresence } from '../lib/presence'
import { getVoterAuth, saveVoterAuth, type VoterAuth } from '../lib/voterToken'
import Blobs, { GRADIENT_TEXT } from '../components/Blobs'
import { TEXT, TEXT_MUTED, CARD_BG, CARD_BORDER, CARD_SHADOW, TEAM_COLORS, GOLD, DANGER, SUBTLE_BG, SUBTLE_BORDER } from '../lib/theme'

const TEAM_EMOJI = ['🚀', '🎯', '🔥', '🌟', '💡', '🎮', '🧠', '⚡']

export default function VotePage() {
  const { session, loading: sessionLoading } = useActiveSession()
  const { label, isOver } = useCountdown(session?.ends_at, session?.paused ? session.paused_at : null)
  const paused = session?.paused ?? false
  const teams = useTeams()
  useReportPresence()
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [votedTeamIds, setVotedTeamIds] = useState<string[]>([])
  const [votesLoaded, setVotesLoaded] = useState(false)

  const [voterAuth, setVoterAuth] = useState<VoterAuth | null>(() => getVoterAuth())
  const [emailInput, setEmailInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)

  const basePhase = sessionPhase(session)
  const phase = basePhase === 'open' && isOver ? 'closed' : basePhase

  // voter_token is now issued per verified email (see /api/verify-voter), so
  // whether this voter already voted has to come from the server — the same
  // email opened on a different device must still show "already voted".
  useEffect(() => {
    if (!session || !voterAuth) {
      setVotesLoaded(false)
      return
    }
    let cancelled = false
    setVotesLoaded(false)
    supabase
      .from('votes')
      .select('team_id')
      .eq('session_id', session.id)
      .eq('voter_token', voterAuth.voterToken)
      .then(({ data }) => {
        if (cancelled) return
        setVotedTeamIds((data ?? []).map((v) => v.team_id))
        setVotesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [session, voterAuth])

  const alreadyVoted = votedTeamIds.length > 0

  function toggleTeam(id: string) {
    setSelected((prev) => (prev === id ? null : id))
  }

  async function verifyEmail() {
    const email = emailInput.trim()
    if (!email || verifying) return
    setVerifying(true)
    setGateError(null)
    try {
      const res = await fetch('/api/verify-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json()
      if (!res.ok) {
        setGateError(body.error ?? 'Xác thực thất bại, vui lòng thử lại.')
        return
      }
      const auth: VoterAuth = { email: body.email, voterToken: body.voterToken }
      saveVoterAuth(auth)
      setVoterAuth(auth)
    } catch {
      setGateError('Lỗi kết nối, vui lòng thử lại.')
    } finally {
      setVerifying(false)
    }
  }

  async function submit() {
    if (!session || !voterAuth || !selected) return
    setSubmitting(true)
    setError(null)
    const { error: insertError } = await supabase.from('votes').insert({
      session_id: session.id,
      team_id: selected,
      voter_token: voterAuth.voterToken,
    })
    setSubmitting(false)
    if (insertError) {
      setError('Vote không thành công (có thể vote đã đóng). Vui lòng thử lại.')
      return
    }
    setVotedTeamIds([selected])
  }

  if (sessionLoading) {
    return (
      <Shell>
        <Card>
          <Centered>Đang tải…</Centered>
        </Card>
      </Shell>
    )
  }

  if (!voterAuth) {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64 }}>📧</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Nhập email để bình chọn</h2>
            <p style={{ color: TEXT_MUTED, margin: '0 0 20px', fontSize: 15, maxWidth: 340 }}>
              Chỉ những email trong danh sách được mời mới có thể tham gia bình chọn.
            </p>
            <input
              type="email"
              inputMode="email"
              autoFocus
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') verifyEmail()
              }}
              placeholder="ban@dssolution.jp"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 14,
                border: `2px solid ${gateError ? DANGER : SUBTLE_BORDER}`,
                background: SUBTLE_BG,
                color: TEXT,
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {gateError && (
              <p style={{ color: DANGER, textAlign: 'center', marginTop: 10, fontSize: 14 }}>{gateError}</p>
            )}
            <button
              onClick={verifyEmail}
              disabled={!emailInput.trim() || verifying}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '15px 0',
                borderRadius: 16,
                border: 'none',
                background:
                  !emailInput.trim() || verifying
                    ? SUBTLE_BG
                    : `linear-gradient(135deg, ${TEAM_COLORS[0]}, ${TEAM_COLORS[4]})`,
                color: !emailInput.trim() || verifying ? TEXT_MUTED : '#fff',
                fontSize: 17,
                fontWeight: 800,
                cursor: !emailInput.trim() || verifying ? 'not-allowed' : 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.2s ease',
              }}
            >
              {verifying ? 'Đang kiểm tra…' : 'Tiếp tục'}
            </button>
          </Centered>
        </Card>
      </Shell>
    )
  }

  if (phase === 'idle') {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64, animation: 'float 3s ease-in-out infinite' }}>🗳️</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Bình chọn chưa bắt đầu</h2>
            <p style={{ color: TEXT_MUTED, margin: 0, fontSize: 15 }}>Vui lòng chờ BTC thông báo bắt đầu nhé!</p>
          </Centered>
        </Card>
      </Shell>
    )
  }

  if (phase === 'closed') {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64 }}>⏱️</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Bình chọn đã kết thúc</h2>
            <p style={{ color: TEXT_MUTED, margin: 0, fontSize: 15 }}>Cảm ơn bạn đã tham gia!</p>
          </Centered>
        </Card>
      </Shell>
    )
  }

  if (phase === 'open' && paused) {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64 }}>⏸️</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Đang tạm dừng bình chọn</h2>
            <p style={{ color: TEXT_MUTED, margin: 0, fontSize: 15 }}>BTC sẽ tiếp tục trong giây lát, vui lòng chờ…</p>
          </Centered>
        </Card>
      </Shell>
    )
  }

  if (!votesLoaded) {
    return (
      <Shell>
        <Card>
          <Centered>Đang tải…</Centered>
        </Card>
      </Shell>
    )
  }

  if (alreadyVoted) {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64, animation: 'pop-in 0.5s ease-out' }}>✅</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Bạn đã bình chọn rồi!</h2>
            <p style={{ color: TEXT_MUTED, margin: 0, fontSize: 15 }}>
              Cảm ơn bạn 💜 Còn lại <strong style={{ color: GOLD }}>{label}</strong>
            </p>
          </Centered>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 800,
              padding: '7px 18px',
              borderRadius: 999,
              background: 'rgba(199,134,10,0.12)',
              border: `1px solid rgba(199,134,10,0.35)`,
              color: GOLD,
              marginBottom: 16,
              letterSpacing: 0.3,
            }}
          >
            ⏳ CÒN LẠI {label}
          </div>
          <h1
            style={{
              fontSize: 30,
              margin: '0 0 8px',
              fontWeight: 900,
              letterSpacing: -0.5,
              ...GRADIENT_TEXT,
            }}
          >
            🏆 People's Choice Award
          </h1>
          <p style={{ color: TEXT_MUTED, margin: 0, fontSize: 15 }}>
            Chọn <strong style={{ color: TEXT }}>1 đội</strong> yêu thích nhất
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {teams.map((team, i) => {
            const isSelected = selected === team.id
            const accent = TEAM_COLORS[i % TEAM_COLORS.length]
            return (
              <button
                key={team.id}
                onClick={() => toggleTeam(team.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '15px 16px',
                  borderRadius: 18,
                  border: isSelected ? `2px solid ${accent}` : `2px solid ${SUBTLE_BORDER}`,
                  background: isSelected
                    ? `linear-gradient(135deg, ${accent}22, ${accent}0d)`
                    : SUBTLE_BG,
                  textAlign: 'left',
                  fontSize: 17,
                  fontWeight: 700,
                  color: TEXT,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  transform: isSelected ? 'scale(1.015)' : 'scale(1)',
                  boxShadow: isSelected ? `0 6px 18px ${accent}2e` : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    background: `${accent}1f`,
                    flexShrink: 0,
                  }}
                >
                  {TEAM_EMOJI[i % TEAM_EMOJI.length]}
                </span>
                <span style={{ flex: 1 }}>{team.name}</span>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: isSelected ? 'none' : `2px solid ${CARD_BORDER}`,
                    background: isSelected ? accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: '#fff',
                    flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <p style={{ color: DANGER, textAlign: 'center', marginTop: 10, fontSize: 14 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={!selected || submitting}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '17px 0',
            borderRadius: 16,
            border: 'none',
            background: !selected
              ? SUBTLE_BG
              : `linear-gradient(135deg, ${TEAM_COLORS[0]}, ${TEAM_COLORS[4]})`,
            color: !selected ? TEXT_MUTED : '#fff',
            fontSize: 18,
            fontWeight: 800,
            cursor: !selected ? 'not-allowed' : 'pointer',
            boxShadow: !selected ? 'none' : `0 10px 28px ${TEAM_COLORS[4]}40`,
            transition: 'transform 0.15s ease, box-shadow 0.2s ease',
          }}
        >
          {submitting ? 'Đang gửi…' : 'Gửi bình chọn'}
        </button>
      </Card>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <Blobs />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 480 }}>{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 28,
        padding: '30px 24px',
        backdropFilter: 'blur(16px)',
        boxShadow: CARD_SHADOW,
        color: TEXT,
      }}
    >
      {children}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px 8px',
      }}
    >
      {children}
    </div>
  )
}
