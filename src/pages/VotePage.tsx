import { useEffect, useMemo, useState } from 'react'
import { supabase, type Team } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import { getVoterToken, getVotedTeamIds, saveVotedTeamIds } from '../lib/voterToken'
import Blobs, { GRADIENT_TEXT } from '../components/Blobs'

const MAX_PICKS = 3
const TEAM_EMOJI = ['🚀', '🎯', '🔥', '🌟', '💡', '🎮', '🧠', '⚡']
const TEAM_COLORS = ['#ff5da2', '#5ad1ff', '#ffd166', '#7bf1a8', '#c792ff']

export default function VotePage() {
  const { session, loading: sessionLoading } = useActiveSession()
  const { label, isOver } = useCountdown(session?.ends_at)
  const [teams, setTeams] = useState<Team[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [votedTeamIds, setVotedTeamIds] = useState<string[]>([])

  const basePhase = sessionPhase(session)
  const phase = basePhase === 'open' && isOver ? 'closed' : basePhase

  useEffect(() => {
    supabase
      .from('teams')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => setTeams((data as Team[]) ?? []))
  }, [])

  useEffect(() => {
    if (session) setVotedTeamIds(getVotedTeamIds(session.id))
  }, [session])

  const alreadyVoted = votedTeamIds.length > 0
  const voterToken = useMemo(() => getVoterToken(), [])

  function toggleTeam(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id)
      if (prev.length >= MAX_PICKS) return prev
      return [...prev, id]
    })
  }

  async function submit() {
    if (!session || selected.length === 0) return
    setSubmitting(true)
    setError(null)
    const rows = selected.map((teamId) => ({
      session_id: session.id,
      team_id: teamId,
      voter_token: voterToken,
    }))
    const { error: insertError } = await supabase.from('votes').insert(rows)
    setSubmitting(false)
    if (insertError) {
      setError('Vote không thành công (có thể vote đã đóng). Vui lòng thử lại.')
      return
    }
    saveVotedTeamIds(session.id, selected)
    setVotedTeamIds(selected)
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

  if (phase === 'idle') {
    return (
      <Shell>
        <Card>
          <Centered>
            <div style={{ fontSize: 64, animation: 'float 3s ease-in-out infinite' }}>🗳️</div>
            <h2 style={{ margin: '18px 0 6px', fontSize: 22 }}>Bình chọn chưa bắt đầu</h2>
            <p style={{ opacity: 0.65, margin: 0, fontSize: 15 }}>Vui lòng chờ MC thông báo bắt đầu nhé!</p>
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
            <p style={{ opacity: 0.65, margin: 0, fontSize: 15 }}>Cảm ơn bạn đã tham gia!</p>
          </Centered>
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
            <p style={{ opacity: 0.65, margin: 0, fontSize: 15 }}>
              Cảm ơn bạn 💜 Còn lại <strong style={{ color: '#ffd166' }}>{label}</strong>
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
              background: 'rgba(255,209,102,0.14)',
              border: '1px solid rgba(255,209,102,0.4)',
              color: '#ffd166',
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
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontSize: 15 }}>
            Chọn tối đa <strong style={{ color: '#fff' }}>3 đội</strong> yêu thích nhất
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {teams.map((team, i) => {
            const isSelected = selected.includes(team.id)
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
                  border: isSelected ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
                  background: isSelected
                    ? `linear-gradient(135deg, ${accent}2e, ${accent}12)`
                    : 'rgba(255,255,255,0.04)',
                  textAlign: 'left',
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  transform: isSelected ? 'scale(1.015)' : 'scale(1)',
                  boxShadow: isSelected ? `0 6px 18px ${accent}33` : 'none',
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
                    background: `${accent}26`,
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
                    border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.22)',
                    background: isSelected ? accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    color: '#0b0620',
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

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '22px 0 4px' }}>
          {Array.from({ length: MAX_PICKS }, (_, i) => (
            <span
              key={i}
              style={{
                width: i < selected.length ? 22 : 9,
                height: 9,
                borderRadius: 999,
                background: i < selected.length ? '#ffd166' : 'rgba(255,255,255,0.18)',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>

        {error && (
          <p style={{ color: '#ff8a8a', textAlign: 'center', marginTop: 10, fontSize: 14 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={selected.length === 0 || submitting}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '17px 0',
            borderRadius: 16,
            border: 'none',
            background:
              selected.length === 0
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #ff5da2, #c792ff)',
            color: selected.length === 0 ? 'rgba(255,255,255,0.4)' : '#fff',
            fontSize: 18,
            fontWeight: 800,
            cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
            boxShadow: selected.length === 0 ? 'none' : '0 10px 28px rgba(199,146,255,0.4)',
            transition: 'transform 0.15s ease, box-shadow 0.2s ease',
          }}
        >
          {submitting ? 'Đang gửi…' : `Gửi bình chọn (${selected.length}/${MAX_PICKS})`}
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
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 28,
        padding: '30px 24px',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        color: '#fff',
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
