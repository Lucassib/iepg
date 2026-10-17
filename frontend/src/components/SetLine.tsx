import type { Rational } from '../api/types'
import { rationalToNumber } from '../lib/exact'

/**
 * A finite set on the real line: filled points, the `highlight` values in the amber note color, and optional hollow
 * markers (e.g. μ₊) with a label. Labels alternate above and below so neighbours do not collide.
 */
export function SetLine({
  values,
  highlight = [],
  markers = [],
  className,
}: {
  values: Rational[]
  highlight?: Rational[]
  markers?: { value: Rational; label: string }[]
  className?: string
}) {
  const W = 640
  const H = 62
  const Y = 30
  const all = [...values, ...markers.map((m) => m.value)].map(rationalToNumber).filter(Number.isFinite)
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (!Number.isFinite(lo) || lo === hi) {
    lo = (Number.isFinite(lo) ? lo : 0) - 1
    hi = (Number.isFinite(hi) ? hi : 0) + 1
  }
  const p = (hi - lo) * 0.06
  const x = (v: Rational) => 20 + ((rationalToNumber(v) - (lo - p)) / (hi - lo + 2 * p)) * (W - 40)
  const hi2 = new Set(highlight)
  const sorted = [...values].sort((a, b) => rationalToNumber(a) - rationalToNumber(b))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className={className ?? 'block text-ink'} style={{ maxHeight: 80 }} role="img" aria-label={`Set {${sorted.join(', ')}}`}>
      <title>{`{${sorted.join(', ')}}`}</title>
      <line x1={8} y1={Y} x2={W - 8} y2={Y} stroke="currentColor" strokeWidth={1} opacity={0.7} />
      {markers.map((m) => (
        <g key={'m' + m.label}>
          <title>{`${m.label} = ${m.value}`}</title>
          <circle cx={x(m.value)} cy={Y} r={5} fill="var(--bg)" stroke="var(--muted)" strokeWidth={1.3} strokeDasharray="2.5 2" />
          <text x={x(m.value)} y={Y - 11} fontSize={10} textAnchor="middle" fontFamily="var(--font-mono)" fill="var(--muted)">
            {m.label}
          </text>
        </g>
      ))}
      {sorted.map((v, i) => {
        const hot = hi2.has(v)
        return (
          <g key={v + ':' + i}>
            <title>{v}</title>
            {hot && <circle cx={x(v)} cy={Y} r={7} fill="none" stroke="var(--note)" strokeWidth={1.6} />}
            <circle cx={x(v)} cy={Y} r={hot ? 4.5 : 3.8} fill={hot ? 'var(--note)' : 'currentColor'} />
            <text
              x={x(v)}
              y={Y + (i % 2 === 0 ? 19 : 30)}
              fontSize={10}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fill={hot ? 'var(--note)' : 'var(--muted)'}
              fontWeight={hot ? 600 : 400}
              stroke="var(--bg)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {v}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
