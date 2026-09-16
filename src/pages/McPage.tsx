import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, type Team } from '../lib/supabase'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import Blobs, { GRADIENT_TEXT } from '../components/Blobs'
import { TEXT, TEXT_MUTED, CARD_BG, CARD_BORDER, CARD_SHADOW, DANGER, SUCCESS, INPUT_BG, INPUT_BORDER, SUBTLE_BG } from '../lib/theme'

export default function McPage() {
  const [params] = useSearchParams()
  const key = params.get('key') ?? ''
  const { session } = useActiveSession()
  const { label, isOver } = useCountdown(session?.ends_at, session?.paused ? session.paused_at : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<Team[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [teamsSaved, setTeamsSaved] = useState(false)

  const basePhase = sessionPhase(session)
  const phase = basePhase === 'open' && isOver ? 'closed' : basePhase
  const revealed = session?.revealed ?? false
  const paused = session?.paused ?? false

  useEffect(() => {
    supabase
      .from('teams')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const list = (data as Team[]) ?? []
        setTeams(list)
        setNames(Object.fromEntries(list.map((t) => [t.id, t.name])))
      })
  }, [])

  async function call(path: string, extraBody?: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...extraBody }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveTeamNames() {
    const payload = teams.map((t) => ({ id: t.id, name: names[t.id] ?? t.name }))
    const ok = await call('/api/update-teams', { teams: payload })
    if (ok) {
      setTeams((prev) => prev.map((t) => ({ ...t, name: payload.find((p) => p.id === t.id)?.name ?? t.name })))
      setTeamsSaved(true)
      setTimeout(() => setTeamsSaved(false), 2000)
    }
  }

  const statusColor = phase === 'open' ? SUCCESS : phase === 'closed' ? DANGER : TEXT_MUTED

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Blobs />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 460,
          padding: 28,
          borderRadius: 28,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          backdropFilter: 'blur(16px)',
          boxShadow: CARD_SHADOW,
          color: TEXT,
        }}
      >
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, ...GRADIENT_TEXT }}>
          🎛️ Điều khiển bình chọn
        </h1>
        <p style={{ margin: '0 0 20px', color: TEXT_MUTED, fontSize: 14 }}>People's Choice Award</p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 14,
            background: SUBTLE_BG,
            marginBottom: 20,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {phase === 'idle' && 'Chưa bắt đầu'}
            {phase === 'open' && (paused ? `Đang tạm dừng — còn ${label}` : `Đang mở — còn ${label}`)}
            {phase === 'closed' && (revealed ? 'Đã đóng — đã hiển thị kết quả' : 'Đã đóng — chưa hiển thị tên đội')}
          </span>
        </div>

        {!key && (
          <p style={{ color: DANGER, fontSize: 13, marginBottom: 16 }}>
            Thiếu tham số <code>?key=...</code> trên URL — không thể gọi API điều khiển.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button
            disabled={busy || phase === 'open'}
            onClick={() => call('/api/start-session')}
            style={btnStyle('linear-gradient(135deg, #16a34a, #4ade80)', busy || phase === 'open')}
          >
            ▶ Bắt đầu (5:00)
          </button>
          <button
            disabled={busy || phase !== 'open'}
            onClick={() => call('/api/stop-session')}
            style={btnStyle('linear-gradient(135deg, #dc2626, #f87171)', busy || phase !== 'open')}
          >
            ⏹ Dừng ngay
          </button>
        </div>

        <button
          disabled={busy || phase !== 'open'}
          onClick={() => call(paused ? '/api/resume-session' : '/api/pause-session')}
          style={{
            ...btnStyle(
              paused ? 'linear-gradient(135deg, #16a34a, #4ade80)' : 'linear-gradient(135deg, #d97706, #fbbf24)',
              busy || phase !== 'open',
            ),
            width: '100%',
            marginBottom: 12,
          }}
        >
          {paused ? '▶️ Tiếp tục' : '⏸ Tạm dừng'}
        </button>

        <button
          disabled={busy || phase !== 'closed' || revealed}
          onClick={() => call('/api/reveal-results')}
          style={{
            ...btnStyle('linear-gradient(135deg, #c7860a, #e0367a)', busy || phase !== 'closed' || revealed),
            width: '100%',
            marginBottom: 12,
          }}
        >
          🏆 {revealed ? 'Đã hiển thị tên đội' : 'Hiển thị kết quả (lộ tên đội)'}
        </button>

        <button
          disabled={busy || phase === 'idle'}
          onClick={() => call('/api/reset')}
          style={{
            ...btnStyle('linear-gradient(135deg, #64748b, #94a3b8)', busy || phase === 'idle'),
            width: '100%',
            marginBottom: 20,
          }}
        >
          🔄 Đặt lại (xoá phiên, quay về màn hình chờ)
        </button>

        {error && <p style={{ color: DANGER, marginBottom: 16, fontSize: 14 }}>{error}</p>}

        <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 18 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14, color: TEXT }}>
            Tên 5 đội (ẩn khỏi màn hình chính đến khi hiển thị kết quả)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {teams.map((t, i) => (
              <input
                key={t.id}
                value={names[t.id] ?? ''}
                onChange={(e) => setNames((prev) => ({ ...prev, [t.id]: e.target.value }))}
                placeholder={`Đội ${t.sort_order || i + 1}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${INPUT_BORDER}`,
                  background: INPUT_BG,
                  color: TEXT,
                  fontSize: 14,
                }}
              />
            ))}
          </div>
          <button
            disabled={busy || teams.length === 0}
            onClick={saveTeamNames}
            style={{
              ...btnStyle('linear-gradient(135deg, #0f8fd1, #8a3ff0)', busy || teams.length === 0),
              width: '100%',
              marginTop: 12,
            }}
          >
            {teamsSaved ? '✓ Đã lưu' : 'Lưu tên đội'}
          </button>
        </div>
      </div>
    </div>
  )
}

function btnStyle(gradient: string, disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '14px 0',
    borderRadius: 14,
    border: 'none',
    background: disabled ? SUBTLE_BG : gradient,
    color: disabled ? TEXT_MUTED : '#fff',
    fontSize: 15,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
