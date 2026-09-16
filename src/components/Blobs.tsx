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
          background: 'radial-gradient(circle, rgba(224,54,122,0.16), transparent 70%)',
          filter: 'blur(50px)',
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
          background: 'radial-gradient(circle, rgba(15,143,209,0.14), transparent 70%)',
          filter: 'blur(50px)',
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
          background: 'radial-gradient(circle, rgba(138,63,240,0.12), transparent 70%)',
          filter: 'blur(55px)',
          animation: 'blob-drift-1 24s ease-in-out infinite reverse',
        }}
      />
    </div>
  )
}

export const GRADIENT_TEXT: React.CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, #e0367a, #c7860a, #0f8fd1, #8a3ff0, #e0367a)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  animation: 'shimmer 6s linear infinite',
}
