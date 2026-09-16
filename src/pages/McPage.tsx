import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useActiveSession, sessionPhase } from '../lib/useActiveSession'
import { useCountdown } from '../lib/useCountdown'
import Blobs, { GRADIENT_TEXT } from '../components/Blobs'

export default function McPage() {
  const [params] = useSearchParams()
  const key = params.get('key') ?? ''
  const { session } = useActiveSession()
  const { label, isOver } = useCountdown(session?.ends_at)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const basePhase = sessionPhase(session)
  const phase = basePhase === 'open' && isOver ? 'closed' : basePhase

  async function call(path: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  const statusColor = phase === 'open' ? '#7bf1a8' : phase === 'closed' ? '#ff8a8a' : 'rgba(255,255,255,0.6)'

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Blobs />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          padding: 28,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          color: '#fff',
        }}
      >
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, ...GRADIENT_TEXT }}>
          🎛️ Điều khiển bình chọn
        </h1>
        <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>People's Choice Award</p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            marginBottom: 20,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {phase === 'idle' && 'Chưa bắt đầu'}
            {phase === 'open' && `Đang mở — còn ${label}`}
            {phase === 'closed' && 'Đã đóng'}
          </span>
        </div>

        {!key && (
          <p style={{ color: '#ff8a8a', fontSize: 13, marginBottom: 16 }}>
            Thiếu tham số <code>?key=...</code> trên URL — không thể gọi API điều khiển.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            disabled={busy || phase === 'open'}
            onClick={() => call('/api/start-session')}
            style={btnStyle('linear-gradient(135deg, #16a34a, #7bf1a8)', busy || phase === 'open')}
          >
            ▶ Bắt đầu (5:00)
          </button>
          <button
            disabled={busy || phase !== 'open'}
            onClick={() => call('/api/stop-session')}
            style={btnStyle('linear-gradient(135deg, #dc2626, #ff8a8a)', busy || phase !== 'open')}
          >
            ⏹ Dừng ngay
          </button>
        </div>

        {error && <p style={{ color: '#ff8a8a', marginTop: 16, fontSize: 14 }}>{error}</p>}
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
    background: disabled ? 'rgba(255,255,255,0.1)' : gradient,
    color: disabled ? 'rgba(255,255,255,0.4)' : '#0b0620',
    fontSize: 15,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
