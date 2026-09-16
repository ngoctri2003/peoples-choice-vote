import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#0b0620', light: '#ffffff' } }).then(
      (url) => {
        if (!cancelled) setDataUrl(url)
      },
    )
    return () => {
      cancelled = true
    }
  }, [value, size])

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 20,
        background: '#fff',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
      }}
    >
      {dataUrl && <img src={dataUrl} alt="QR quét để bình chọn" style={{ width: '100%', height: '100%' }} />}
    </div>
  )
}
