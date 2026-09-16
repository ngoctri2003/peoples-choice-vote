// Soft ambient blurred shapes drifting behind page content for visual depth.
export default function Blobs() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,93,162,0.35), transparent 70%)',
          filter: 'blur(40px)',
          animation: 'blob-drift-1 16s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: '55vw',
          height: '55vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,209,255,0.3), transparent 70%)',
          filter: 'blur(40px)',
          animation: 'blob-drift-2 20s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '55%',
          width: '35vw',
          height: '35vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(199,146,255,0.25), transparent 70%)',
          filter: 'blur(50px)',
          animation: 'blob-drift-1 24s ease-in-out infinite reverse',
        }}
      />
    </div>
  )
}

export const GRADIENT_TEXT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, #ff5da2, #ffd166, #5ad1ff, #c792ff, #ff5da2)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  animation: 'shimmer 6s linear infinite',
}
