import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const RENDER_RESOLUTION = 720 // px the QR bitmap is generated at; CSS `size` scales the box independently

export default function QrCode({ value, size }: { value: string; size: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: RENDER_RESOLUTION,
      margin: 1,
      color: { dark: '#0b0620', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
        borderRadius: '3%',
        background: '#fff',
        padding: '4%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}
    >
      {dataUrl && <img src={dataUrl} alt="QR quét để bình chọn" style={{ width: '100%', height: '100%' }} />}
    </div>
  )
}
