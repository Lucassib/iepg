import { useMemo } from 'react'
import type { SeedSummary, SeedStatus } from '../api/types'
import { SCALE_GRID, TreeView } from './TreeView'
import { Tex } from './Tex'
import { StatusBadge, STATUS_TEXT } from './ui/badge'
import { cn } from '../lib/cn'

export function seedNumber(name: string): number {
  const m = /_(\d+)$/.exec(name)
  return m ? Number(m[1]) : 0
}

export function pairOf(name: string): [number, number] | null {
  const m = /^R(\d+)xR(\d+)$/i.exec(name)
  return m ? [Number(m[1]), Number(m[2])] : null
}

export function SeedCard({ seed, onSelect, selected }: { seed: SeedSummary; onSelect: (name: string) => void; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(seed.name)}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-1 rounded-md border bg-surface p-2 text-left transition-colors hover:border-ink',
        selected ? 'border-ink' : 'border-line',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <Tex tex={seed.label} className="font-serif" />
        <StatusBadge status={seed.status} focusable={false} />
      </span>
      <TreeView tree={seed.tree} scale={SCALE_GRID} className="rounded bg-paper p-1" />
      <span className="font-sans text-xs text-muted">n = {seed.tree.n}</span>
    </button>
  )
}

/** Diameter 6: two rows of six cards (diminimal on top, defective below). */
export function SeedCardGrid({ seeds, onSelect, selected }: { seeds: SeedSummary[]; onSelect: (name: string) => void; selected?: string | null }) {
  const sorted = useMemo(() => [...seeds].sort((a, b) => seedNumber(a.name) - seedNumber(b.name)), [seeds])
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {sorted.map((s) => (
        <SeedCard key={s.name} seed={s} onSelect={onSelect} selected={selected === s.name} />
      ))}
    </div>
  )
}

const CELL = 38

/** Diameter 7: the 12 × 12 upper-triangular matrix of R_i ⊙ R_j, with the 6 × 6 block of the 21 diminimal seeds outlined. */
export function SeedMatrix({
  seeds,
  onSelect,
  selected,
  size = 12,
  cell = CELL,
  hint = 'Click a cell to open the seed.',
}: {
  seeds: SeedSummary[]
  onSelect: (name: string) => void
  selected?: string | null
  size?: number
  /** the side of a cell in pixels */
  cell?: number
  /** the last sentence of the legend, what a click does */
  hint?: string
}) {
  const CELL = cell
  const GAP = cell < 32 ? 3 : 4
  const HEAD = cell < 32 ? 34 : 44
  // the row headers need room for R_{10}, R_{11}, R_{12}
  const HEAD_X = cell < 32 ? 40 : 44
  const headFont = cell < 32 ? 'text-xs' : 'text-sm'
  const byPair = useMemo(() => {
    const m = new Map<string, SeedSummary>()
    for (const s of seeds) {
      const p = pairOf(s.name)
      if (p) m.set(`${Math.min(...p)}-${Math.max(...p)}`, s)
    }
    return m
  }, [seeds])
  const counts = useMemo(() => {
    const c: Record<SeedStatus, number> = { diminimal: 0, defective: 0, unknown: 0 }
    for (const s of seeds) c[s.status]++
    return c
  }, [seeds])
  const idx = Array.from({ length: size }, (_, i) => i + 1)
  const step = CELL + GAP

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="relative inline-block" style={{ paddingLeft: HEAD_X, paddingTop: HEAD }}>
          {/* column headers */}
          {idx.map((j) => (
            <div key={'c' + j} className={cn('absolute flex items-end justify-center font-serif', headFont)} style={{ left: HEAD_X + (j - 1) * step, top: 0, width: CELL, height: HEAD - 6 }}>
              <Tex tex={`R_{${j}}`} />
            </div>
          ))}
          {/* row headers */}
          {idx.map((i) => (
            <div key={'r' + i} className={cn('absolute flex items-center justify-end pr-1.5 font-serif', headFont)} style={{ left: 0, top: HEAD + (i - 1) * step, width: HEAD_X - 2, height: CELL }}>
              <Tex tex={`R_{${i}}`} />
            </div>
          ))}
          <div role="grid" aria-label="Seeds of diameter 7" style={{ display: 'grid', gridTemplateColumns: `repeat(${size}, ${CELL}px)`, gap: GAP }}>
            {idx.map((i) =>
              idx.map((j) => {
                if (j < i) return <div key={`${i}-${j}`} aria-hidden style={{ width: CELL, height: CELL }} />
                const s = byPair.get(`${i}-${j}`)
                const label = `R_{${i}} \\odot R_{${j}}`
                const text = `R${i} ⊙ R${j}`
                if (!s)
                  return (
                    <div key={`${i}-${j}`} role="gridcell" title={`${text}: not in the catalog`} className="rounded border border-dashed border-line" style={{ width: CELL, height: CELL }} />
                  )
                const color = `var(--state-${s.status})`
                return (
                  <button
                    key={`${i}-${j}`}
                    type="button"
                    role="gridcell"
                    onClick={() => onSelect(s.name)}
                    title={`${text}: ${STATUS_TEXT[s.status]}`}
                    aria-label={`${text}, ${STATUS_TEXT[s.status]}`}
                    aria-pressed={selected === s.name}
                    className={cn('rounded border font-mono transition-transform hover:scale-110 focus-visible:scale-110', cell < 32 ? 'text-[7.5px]' : 'text-[9px]', selected === s.name && 'ring-2 ring-ink')}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderColor: color,
                      color,
                      background: `color-mix(in srgb, ${color} 22%, transparent)`,
                    }}
                  >
                    <span className="sr-only">
                      <Tex tex={label} />
                    </span>
                    {cell >= 22 && (
                      <span aria-hidden>
                        {i},{j}
                      </span>
                    )}
                  </button>
                )
              }),
            )}
          </div>
          {/* the 6 × 6 block of diminimal seeds */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded border-2 border-ink"
            style={{ left: HEAD_X - 3, top: HEAD - 3, width: 6 * step - GAP + 6, height: 6 * step - GAP + 6 }}
          />
        </div>
      </div>
      <p className="font-sans text-xs text-muted">
        {(['diminimal', 'defective', 'unknown'] as SeedStatus[])
          .filter((k) => counts[k] > 0)
          .map((k, i) => (
            <span key={k}>
              {i > 0 && ' · '}
              <span className="inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: `var(--state-${k})` }} /> {k === 'unknown' ? 'undetermined' : k} ({counts[k]})
            </span>
          ))}
        . The outlined block holds the seeds built from the six good rooted seeds. {hint}
      </p>
    </div>
  )
}
