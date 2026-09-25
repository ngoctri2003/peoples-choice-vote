import { useLayoutEffect, useRef, useState } from 'react'

export type CloudItem = { id: string; name: string; votes: number }

type Props = {
  // Already in the order the caller wants rendered (e.g. shuffled per
  // session) — this component never reorders items itself, so a name
  // reveal (hidden -> real name) can't cause a reflow.
  items: CloudItem[]
  colors: string[]
  // Per-id overrides applied on the results screen (gold for winners etc.).
  colorOverride?: Record<string, string>
  highlightIds?: Set<string>
  dimOthers?: boolean
  pulseIds?: Set<string>
}

// Font size range as a fraction of the cloud container's height, before the
// fit-to-box scale is applied.
const MIN_FONT_RATIO = 0.06
const MAX_FONT_RATIO = 0.2

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function wobble(id: string) {
  const h = hash(id)
  return { rotation: ((h % 1000) / 1000 - 0.5) * 10, delay: (h % 400) / 100 }
}

// Auto-fits the whole cloud to its box (measuring real rendered widths, not
// an approximate char-width guess), so long names can never overflow the
// screen the way a fixed vh/vw split can once names are revealed.
export default function WordCloud({ items, colors, colorOverride, highlightIds, dimOthers, pulseIds }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxVotes = Math.max(1, ...items.map((i) => i.votes))

  // Size depends on votes only (no per-name length cap, which would shrink a
  // long-named team below ones with fewer votes); a name too wide for the
  // box is handled by the global fit scale below instead.
  function baseSize(item: CloudItem) {
    const ratio = Math.pow(item.votes / maxVotes, 0.8)
    return (MIN_FONT_RATIO + ratio * (MAX_FONT_RATIO - MIN_FONT_RATIO)) * box.height
  }

  // Binary-search the largest scale at which the whole cloud fits (height and
  // width, since names are nowrap), on a hidden transition-free copy —
  // measuring the visible layer would read mid-transition font sizes and
  // settle on the wrong scale.
  const sizesKey = items.map((i) => `${i.id}:${i.votes}`).join('|')
  useLayoutEffect(() => {
    const m = measureRef.current
    if (!m || box.width === 0) return
    const fits = (s: number) => {
      m.style.setProperty('--s', String(s))
      return m.scrollHeight <= box.height && m.scrollWidth <= box.width
    }
    let lo = 0.15
    let hi = 1
    if (fits(hi)) lo = hi
    else {
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
    }
    setScale(lo)
  }, [sizesKey, box.width, box.height])

  const layer = (measure: boolean) => (
    <div
      ref={measure ? measureRef : undefined}
      aria-hidden={measure || undefined}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        alignContent: 'center',
        justifyContent: 'center',
        gap: '0.4em 1.1em',
        padding: '1vh 1vw',
        fontSize: measure ? 'calc(var(--s, 1) * 20px)' : `${scale * 20}px`,
        visibility: measure ? 'hidden' : undefined,
        overflow: measure ? 'visible' : 'hidden',
        height: measure ? 'auto' : undefined,
        bottom: measure ? 'auto' : 0,
      }}
    >
      {items.map((item, i) => {
        const size = baseSize(item)
        const color = colorOverride?.[item.id] ?? colors[i % colors.length]
        const highlighted = highlightIds?.has(item.id) ?? false
        const dimmed = dimOthers && !highlighted
        const { rotation, delay } = wobble(item.id)
        const fontSize = measure ? `calc(var(--s, 1) * ${size}px)` : `${scale * size}px`
        return (
          <div
            key={item.id}
            style={
              {
                '--rot': `${rotation}deg`,
                fontSize,
                fontWeight: 800,
                lineHeight: 1.05,
                whiteSpace: 'nowrap',
                color,
                transform: `rotate(${rotation}deg)`,
                opacity: dimmed ? 0.28 : 1,
                ...(measure
                  ? {}
                  : {
                      transition:
                        'font-size 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.5s ease, opacity 0.6s ease',
                      animation: [
                        'pop-in 0.5s ease-out',
                        `float ${5 + delay}s ease-in-out ${delay}s infinite`,
                        pulseIds?.has(item.id) ? 'pulse-glow 0.9s ease-out' : null,
                        highlighted ? 'crown-glow 1.6s ease-in-out infinite' : null,
                      ]
                        .filter(Boolean)
                        .join(', '),
                    }),
              } as React.CSSProperties
            }
          >
            {item.name}
          </div>
        )
      })}
    </div>
  )

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {box.width > 0 && layer(true)}
      {box.width > 0 && layer(false)}
    </div>
  )
}
