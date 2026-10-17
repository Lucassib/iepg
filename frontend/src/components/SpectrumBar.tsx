import { useMemo } from 'react'
import type { Num } from '../api/types'
import { formatApprox, numText } from '../lib/exact'
import { cn } from '../lib/cn'
import { SymbolTip, Term } from './ThesisTips'

/** A number line with the eigenvalues (filled) and the latent values (hollow, dashed, muted). Red stays reserved for root vertices. */
export function SpectrumBar({
  values,
  latent = [],
  confined = [],
  marker = null,
  onHover,
  className,
  showList = false,
}: {
  values: Num[]
  latent?: Num[]
  confined?: Num[]
  marker?: number | null
  onHover?: (v: Num | null) => void
  className?: string
  /** print the exact eigenvalues, comma separated, above the bar */
  showList?: boolean
}) {
  const W = 640
  const H = 74
  const Y = 30
  const all = [...values, ...latent].map((v) => v.approx).filter(Number.isFinite)
  if (marker !== null && Number.isFinite(marker)) all.push(marker)
  let lo = -1
  let hi = 1
  if (all.length > 0) {
    lo = Math.min(...all)
    hi = Math.max(...all)
    if (lo === hi) {
      lo -= 1
      hi += 1
    }
    const p = (hi - lo) * 0.08
    lo -= p
    hi += p
  }
  const x = (v: number) => 24 + ((v - lo) / (hi - lo)) * (W - 48)
  const confinedSet = useMemo(() => new Set(confined.map((c) => c.exact)), [confined])
  const sortedValues = useMemo(() => [...values].sort((a, b) => a.approx - b.approx), [values])
  const sortedLatent = useMemo(() => [...latent].sort((a, b) => a.approx - b.approx), [latent])

  return (
    <div className={cn('space-y-1', className)}>
      {showList && (
        <p className="font-sans text-xs text-muted">
          <SymbolTip s="DSpec(M)">DSpec</SymbolTip> ({sortedValues.length}): <span className="mono text-ink">{sortedValues.map((v) => numText(v)).join(', ')}</span>
          {sortedLatent.length > 0 && (
            <>
              {' '}
              · <SymbolTip s="Δ(M)">latent</SymbolTip>: <span className="mono text-ink">{sortedLatent.map((v) => numText(v)).join(', ')}</span>
            </>
          )}
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spectrum on the real line" className="text-ink" style={{ maxHeight: 96 }}>
        <title>Spectrum: {sortedValues.map((v) => numText(v)).join(', ')}</title>
        <line x1={12} y1={Y} x2={W - 12} y2={Y} stroke="currentColor" strokeWidth={1} />
        {marker !== null && Number.isFinite(marker) && (
          <g>
            <line x1={x(marker)} y1={Y - 16} x2={x(marker)} y2={Y + 16} stroke="var(--muted)" strokeDasharray="3 3" />
            <text x={x(marker)} y={Y - 19} fontSize={10} textAnchor="middle" fontFamily="var(--font-sans)" fill="var(--muted)">
              λ
            </text>
          </g>
        )}
        {sortedValues.map((v, i) => (
          <g key={'e' + i} onMouseEnter={() => onHover?.(v)} onMouseLeave={() => onHover?.(null)}>
            <title>{v.exact}</title>
            <circle cx={x(v.approx)} cy={Y} r={4} fill="currentColor" />
            <text
              x={x(v.approx)}
              y={Y + (i % 2 === 0 ? 20 : 34)}
              fontSize={10}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fill="var(--muted)"
              stroke="var(--bg)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {numText(v)}
            </text>
          </g>
        ))}
        {sortedLatent.map((v, i) => (
          <g key={'l' + i} onMouseEnter={() => onHover?.(v)} onMouseLeave={() => onHover?.(null)}>
            <title>{`latent ${v.exact}`}</title>
            <circle cx={x(v.approx)} cy={Y} r={5} fill="var(--bg)" stroke="var(--muted)" strokeWidth={1.4} strokeDasharray="2.5 2" />
            {confinedSet.has(v.exact) && <circle cx={x(v.approx)} cy={Y} r={2} fill="var(--muted)" />}
            <text
              x={x(v.approx)}
              y={Y - (i % 2 === 0 ? 11 : 22)}
              fontSize={10}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fill="var(--muted)"
              stroke="var(--bg)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {numText(v)}
            </text>
          </g>
        ))}
      </svg>
      <p className="font-sans text-xs text-muted">
        <span aria-hidden>●</span> eigenvalue{latent.length > 0 && (
          <>
            {' '}
            · <span aria-hidden className="text-muted">◌</span> <Term k="latent value">latent value</Term>
          </>
        )}
        {confined.length > 0 && (
          <>
            {' '}
            · <span aria-hidden className="text-muted">◍</span> <Term k="confined">confined</Term> latent value
          </>
        )}
        . Hover a point for the exact value.
      </p>
    </div>
  )
}

/** Exact values as chips (the backend's display text), with the exact expression and the approximation in the tooltip. */
export function NumList({
  values,
  emptyText = '∅',
  onHover,
  active,
  hollow = false,
}: {
  values: Num[]
  emptyText?: string
  onHover?: (v: Num | null) => void
  active?: string | null
  /** latent values: dashed chip, matching the hollow circles of the spectrum bar */
  hollow?: boolean
}) {
  if (values.length === 0) return <span className="font-sans text-sm text-muted">{emptyText}</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          title={`${v.exact} ≈ ${formatApprox(v.approx, 6)}`}
          onMouseEnter={() => onHover?.(v)}
          onMouseLeave={() => onHover?.(null)}
          onFocus={() => onHover?.(v)}
          onBlur={() => onHover?.(null)}
          tabIndex={onHover ? 0 : undefined}
          className={cn(
            'rounded border px-1.5 py-0.5 font-mono text-xs',
            active === v.exact ? 'border-ink bg-paper' : 'border-line bg-surface',
            hollow && 'border-dashed',
          )}
        >
          {numText(v)}
        </span>
      ))}
    </span>
  )
}
