import { useMemo } from 'react'
import type { Graph } from '../api/types'
import { edgeKey } from '../lib/tree'
import { tint } from '../lib/colors'
import { cn } from '../lib/cn'

const STROKE = 1.2

/**
 * A general graph (threshold graphs, cographs, unicyclic graphs) from its layout, at a fixed scale like TreeView.
 * No vertex is red: red is reserved for the roots of trees.
 */
export function GraphView({
  graph,
  scale = 40,
  radius,
  vertexColor,
  labels,
  highlightEdges,
  highlightVertices,
  className,
  alt,
}: {
  graph: Graph
  /** pixels per layout unit */
  scale?: number
  /** vertex radius in pixels; labels are drawn inside when it is at least 7 */
  radius?: number
  vertexColor?: (v: number) => string | undefined
  /** 'ids' draws the vertex ids; a record gives one text per vertex */
  labels?: 'ids' | Record<string, string>
  /** edges drawn thicker in the accent color (e.g. the cycle) */
  highlightEdges?: [number, number][]
  highlightVertices?: number[]
  className?: string
  alt?: string
}) {
  const r = radius ?? (labels ? 8 : 4)
  const inside = r >= 7
  const hiE = useMemo(() => new Set((highlightEdges ?? []).map(([a, b]) => edgeKey(a, b))), [highlightEdges])
  const hiV = useMemo(() => new Set(highlightVertices ?? []), [highlightVertices])
  const pt = (v: number): [number, number] => {
    const p = graph.layout[String(v)] ?? [v, 0]
    return [p[0] * scale, p[1] * scale]
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let v = 0; v < graph.n; v++) {
    const [x, y] = pt(v)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) minX = maxX = minY = maxY = 0
  const pad = r + 10 + (labels && !inside ? 12 : 0)
  const w = Math.ceil(maxX - minX + 2 * pad)
  const h = Math.ceil(maxY - minY + 2 * pad)
  const text = (v: number) => (labels === 'ids' ? String(v) : labels?.[String(v)])

  return (
    <span className={cn('block overflow-x-auto', className)}>
      <svg viewBox={`${minX - pad} ${minY - pad} ${w} ${h}`} width={w} height={h} className="mx-auto block text-ink" role="img" aria-label={alt ?? `Graph with ${graph.n} vertices`}>
        <title>{alt ?? `Graph with ${graph.n} vertices`}</title>
        <g strokeLinecap="round">
          {graph.edges.map(([a, b]) => {
            const [x1, y1] = pt(a)
            const [x2, y2] = pt(b)
            const hot = hiE.has(edgeKey(a, b))
            return (
              <line
                key={edgeKey(a, b)}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={hot ? 'var(--copy-a)' : 'currentColor'}
                strokeWidth={hot ? 2.6 : STROKE}
                opacity={hot ? 1 : 0.85}
              />
            )
          })}
        </g>
        {Array.from({ length: graph.n }, (_, v) => {
          const [x, y] = pt(v)
          const c = vertexColor?.(v)
          const t = text(v)
          return (
            <g key={v}>
              <title>{`vertex ${v}`}</title>
              {hiV.has(v) && <circle cx={x} cy={y} r={r + 3.5} fill="none" stroke="var(--copy-a)" strokeWidth={1.6} />}
              <circle cx={x} cy={y} r={r} fill={c ? tint(c, 30) : 'var(--vertex-fill)'} stroke={c ?? 'currentColor'} strokeWidth={c ? 1.6 : STROKE} />
              {t !== undefined && (
                <text
                  x={inside ? x : x + r + 2}
                  y={inside ? y + 3.3 : y - r - 1}
                  fontSize={inside ? 9 : 9.5}
                  textAnchor={inside ? 'middle' : 'start'}
                  fontFamily="var(--font-mono)"
                  fill="currentColor"
                  style={{ pointerEvents: 'none' }}
                >
                  {t}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </span>
  )
}
