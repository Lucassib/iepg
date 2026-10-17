import { useMemo, useState } from 'react'
import type { Tower, TowerLevel } from '../api/types'
import { SCALE_CARD, SCALE_GRID, TreeView } from './TreeView'
import { PhiStepView } from './PhiStepView'
import { copyColor, tint } from '../lib/colors'
import { Tooltip } from './ui/tooltip'
import { Term } from './ThesisTips'

const UNIT = 54
const RC = 17

/** "R_2" → R with subscript 2; "S_{11}" → S with subscript 11. */
function SubText({ label, x, y, size = 12 }: { label: string; x: number; y: number; size?: number }) {
  const m = /^([^_]+)_\{?([^}]*)\}?$/.exec(label)
  return (
    <text x={x} y={y} fontSize={size} textAnchor="middle" fontFamily="var(--font-serif)" fontStyle="italic" fill="currentColor" style={{ pointerEvents: 'none' }}>
      {m ? (
        <>
          {m[1]}
          <tspan fontSize={size * 0.72} dy={size * 0.28} fontStyle="normal">
            {m[2]}
          </tspan>
        </>
      ) : (
        label
      )}
    </text>
  )
}

/** "H_5" as H with subscript 5, in HTML. */
export function LabelSub({ label }: { label: string }) {
  const m = /^([^_]+)_\{?([^}]*)\}?$/.exec(label)
  if (!m) return <span className="font-serif italic">{label}</span>
  return (
    <span className="font-serif">
      <span className="italic">{m[1]}</span>
      <sub>{m[2]}</sub>
    </span>
  )
}

/** Copy index of every vertex, from `origin` ("baseLevel:copy"). */
export function copyOfVertices(level: TowerLevel): number[] {
  return level.origin.map((o) => Number(o.split(':')[1] ?? 0))
}

/**
 * The compact view of a level: one circle per copy of a base level, labelled by its base (P_3, S_3, R_i, S_d), placed
 * by `block_layout`, seams dashed, the copy that contains the root outlined. Hover a copy for its realized set.
 */
export function TowerBlocks({ level }: { level: TowerLevel }) {
  const [hover, setHover] = useState<number | null>(null)
  const pos = (i: number): [number, number] => {
    const p = level.block_layout[String(i)] ?? [i, 0]
    return [p[0] * UNIT, p[1] * UNIT]
  }
  const rootCopy = level.copies.findIndex((c) => c.vertices.includes(0))
  const pts = level.copies.map((_, i) => pos(i))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const pad = RC + 10
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w = Math.max(...xs) - Math.min(...xs) + 2 * pad
  const h = Math.max(...ys) - Math.min(...ys) + 2 * pad
  const shown = hover !== null ? level.copies[hover] : null
  return (
    <div className="space-y-1">
      <div className="overflow-x-auto rounded-md border border-line bg-paper p-2">
        <svg viewBox={`${minX} ${minY} ${w} ${h}`} width={w} height={h} className="mx-auto block text-ink" role="img" aria-label={`Blocks of ${level.label}`}>
          <title>{`${level.label}: ${level.copies.length} copies`}</title>
          {level.seams.map((s, i) => {
            const [x1, y1] = pos(s.a)
            const [x2, y2] = pos(s.b)
            return (
              <g key={i}>
                <title>{`seam created at level ${s.level}`}</title>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--edge-dashed)" strokeWidth={1.3} strokeDasharray="4 3" />
              </g>
            )
          })}
          {level.copies.map((c, i) => {
            const [x, y] = pos(i)
            const col = copyColor(i)
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
                <title>{`${c.label}: {${c.set.join(', ')}}`}</title>
                {i === rootCopy && <circle cx={x} cy={y} r={RC + 4} fill="none" stroke="currentColor" strokeWidth={2} />}
                <circle cx={x} cy={y} r={RC} fill={tint(col, 26)} stroke={col} strokeWidth={hover === i ? 2.4 : 1.5} />
                <SubText label={c.label} x={x} y={y + 3} />
              </g>
            )
          })}
        </svg>
      </div>
      <p className="min-h-8 font-sans text-xs text-muted" aria-live="polite">
        {shown ? (
          <>
            {shown.label}, realized set <span className="mono text-ink">{`{${shown.set.join(', ')}}`}</span>
          </>
        ) : (
          `${level.copies.length} ${level.copies.length === 1 ? 'copy' : 'copies'} of the base levels; seams dashed, the copy with the root outlined. Hover a copy for its realized set.`
        )}
      </p>
    </div>
  )
}

/** The tree of a level with every vertex colored by its copy; seams dashed; the root 0 red. */
export function TowerLevelTree({ level }: { level: TowerLevel }) {
  const { colors, dashed } = useMemo(() => {
    const copy = copyOfVertices(level)
    const colors: Record<string, string> = {}
    copy.forEach((c, v) => {
      colors[String(v)] = copyColor(c)
    })
    const dashed: [number, number][] = (level.tree?.edges ?? []).filter(([a, b]) => copy[a] !== copy[b])
    return { colors, dashed }
  }, [level])
  if (!level.draw || !level.tree) {
    return <p className="rounded-md border border-dashed border-line bg-paper px-3 py-2 font-sans text-sm text-muted">{level.n} vertices: too many to draw, see the compact view.</p>
  }
  return (
    <div className="rounded-md border border-line bg-paper p-2">
      <TreeView tree={level.tree} roots={[0]} vertexColors={colors} dashedEdges={dashed} scale={level.n > 40 ? SCALE_GRID : SCALE_CARD} alt={`${level.label} with its copies colored`} />
    </div>
  )
}

/** One tower with a level slider: the compact view and the tree view of the chosen level. */
export function TowerPanel({ tower }: { tower: Tower }) {
  const last = tower.levels.length - 1
  const [idx, setIdx] = useState(last)
  const i = Math.min(idx, last)
  const level = tower.levels[i]
  if (!level) return null
  const seams = level.seams.length
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-serif text-lg font-semibold">{tower.name}</h3>
        <span className="font-sans text-sm">
          <Term k="levels">level</Term> <span className="mono">j = {level.j}</span>: <LabelSub label={level.label} />
        </span>
        <span className="mono font-sans text-xs text-muted">
          n = {level.n}, {level.copies.length} copies, {seams} seams
        </span>
        {!tower.ok && <span className="font-sans text-xs text-defective">{tower.fail}</span>}
      </div>
      {last > 0 && (
        <div className="flex items-center gap-2 font-sans text-xs text-muted">
          <span className="mono">j = {tower.levels[0].j}</span>
          <Tooltip content={`Chooses the level H_j of ${tower.name} shown below, from the base pair to the last level; after the base pair, H_j = H_{j−2} ⊙ H_{j−1}.`}>
            <input type="range" min={0} max={last} value={i} onChange={(e) => setIdx(Number(e.target.value))} aria-label={`Level of ${tower.name}`} />
          </Tooltip>
          <span className="mono">{tower.levels[last].j}</span>
        </div>
      )}
      <p className="font-sans text-xs text-muted">
        <span className="text-ink">
          <span className="font-serif italic">A</span>
          <sub>{level.j}</sub>
        </span>{' '}
        = <span className="mono text-ink">{`{${level.A.join(', ')}}`}</span>
        {level.built_from && ` · composed of the levels ${level.built_from[0]} and ${level.built_from[1]}`}
      </p>
      <TowerBlocks level={level} />
      <TowerLevelTree level={level} />
      {level.phi && <PhiStepView phi={level.phi} first={`X_{${level.j - 2}}`} second={`X_{${level.j - 1}}`} />}
    </div>
  )
}
