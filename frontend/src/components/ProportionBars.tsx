import type { Column } from '../lib/history'
import { COLUMNS } from '../lib/history'

/**
 * The share of diminimal seeds in each diameter, one horizontal bar per column of the history table, top to bottom,
 * so the fall reads downwards. A value that is only a bound or a claim is drawn as a dashed outline with its relation
 * written out, so the bar never carries it by color alone. The table above is the exact view of the same numbers.
 */
type Bar = { f: number | null; kind: 'exact' | 'atleast' | 'atmost' | 'claimed' | 'below' | 'limit' | 'unknown'; text: string }

function parse(v: string): Bar {
  const frac = (t: string) => {
    const [a, b] = t.split('/').map(Number)
    return b ? a / b : a
  }
  // three significant digits, rounded down for a lower bound and up for an upper bound, so the text stays true
  const pct = (x: number, dir: 'near' | 'down' | 'up' = 'near') => {
    const v = x * 100
    if (v === 0) return '0%'
    const step = 10 ** (Math.floor(Math.log10(v)) - 2)
    const r = (dir === 'down' ? Math.floor(v / step) : dir === 'up' ? Math.ceil(v / step) : Math.round(v / step)) * step
    return `${Number(r.toPrecision(3))}%`
  }
  const t = v.trim()
  if (t === '?' || t === '') return { f: null, kind: 'unknown', text: '?' }
  if (t === '→ 0') return { f: 0, kind: 'limit', text: '→ 0' }
  if (t === '< 1') return { f: 1, kind: 'below', text: '< 100%' }
  if (t.endsWith('claimed')) {
    const x = frac(t.replace('claimed', '').trim())
    return { f: x, kind: 'claimed', text: `${pct(x)} claimed` }
  }
  if (t.startsWith('≥')) {
    const x = frac(t.slice(1).trim())
    return { f: x, kind: 'atleast', text: `≥ ${pct(x, 'down')}` }
  }
  if (t.startsWith('≤') || t.startsWith('<')) {
    const x = frac(t.slice(1).trim())
    return { f: x, kind: 'atmost', text: `${t[0]} ${pct(x, 'up')}` }
  }
  const x = frac(t)
  return { f: x, kind: 'exact', text: pct(x) }
}

const W = 340
const LABEL = 58 // room for "d → ∞" at the left
const LEN = 190 // length of a full bar
const ROW = 24
const BAR_H = 13

export function ProportionBars({ pd, changed }: { pd: Record<Column, string>; changed: (c: Column) => boolean }) {
  const bars = COLUMNS.map((c) => ({ ...c, bar: parse(pd[c.key]) }))
  const height = bars.length * ROW + 6
  const summary = bars.map((b) => `${b.label}: ${b.bar.text}`).join(', ')
  return (
    <figure className="space-y-1">
      <figcaption className="font-sans text-xs text-muted">Share of diminimal seeds in each diameter</figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} className="block w-full max-w-[22rem]" role="img" aria-label={`Share of diminimal seeds: ${summary}`}>
        <line x1={LABEL} x2={LABEL} y1={0} y2={height} stroke="var(--border)" strokeWidth={1} />
        {bars.map((b, i) => {
          const cy = i * ROW + ROW / 2 + 3
          const y = cy - BAR_H / 2
          const len = b.bar.f === null ? 0 : Math.max(b.bar.f * LEN, b.bar.f > 0 ? 3 : 0)
          const solid = b.bar.kind === 'exact' || b.bar.kind === 'atleast' || b.bar.kind === 'atmost'
          const dashed = b.bar.kind === 'claimed' || b.bar.kind === 'below'
          const hot = changed(b.key)
          const r = Math.min(4, len / 2)
          // a bar anchored on the axis, with a rounded end
          const path =
            len > 0 ? `M${LABEL} ${y}H${LABEL + len - r}Q${LABEL + len} ${y} ${LABEL + len} ${y + r}V${y + BAR_H - r}Q${LABEL + len} ${y + BAR_H} ${LABEL + len - r} ${y + BAR_H}H${LABEL}Z` : ''
          return (
            <g key={b.key}>
              <title>{`${b.label}: ${b.bar.text}`}</title>
              <rect x={0} y={i * ROW + 3} width={W} height={ROW} fill="transparent" />
              {hot && <rect x={2} y={y - 5} width={W - 4} height={BAR_H + 10} rx={5} fill="none" stroke="var(--note)" strokeWidth={2} />}
              <text x={LABEL - 8} y={cy + 4} textAnchor="end" fontSize={11.5} fill="var(--muted)" className="font-sans">
                {b.label}
              </text>
              {len > 0 && (
                <path
                  d={path}
                  fill={solid ? 'var(--state-diminimal)' : 'color-mix(in srgb, var(--state-diminimal) 12%, transparent)'}
                  fillOpacity={solid ? 0.85 : 1}
                  stroke={dashed ? (b.bar.kind === 'below' ? 'var(--muted)' : 'var(--state-diminimal)') : 'none'}
                  strokeWidth={dashed ? 1.5 : 0}
                  strokeDasharray={dashed ? '4 3' : undefined}
                />
              )}
              <text x={LABEL + len + 7} y={cy + 4} fontSize={11.5} fontWeight={hot ? 700 : 500} fill={b.bar.kind === 'unknown' ? 'var(--muted)' : 'var(--text)'} className="font-mono">
                {b.bar.text}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
