import { useMemo } from 'react'
import type { Cotree } from '../api/types'
import { JOIN, UNION } from '../lib/cograph'

const DX = 30
const DY = 46
const R_OP = 11
const R_LEAF = 8

type Placed = { x: number; y: number; text: string; leaf: boolean; kids: Placed[] }

function place(t: Cotree, depth: number, next: { i: number }): Placed {
  if (t.op === 'v') return { x: next.i++ * DX, y: depth * DY, text: String(t.vertex), leaf: true, kids: [] }
  const kids = t.children.map((c) => place(c, depth + 1, next))
  const x = kids.reduce((s, k) => s + k.x, 0) / kids.length
  return { x, y: depth * DY, text: t.op === 'union' ? UNION : JOIN, leaf: false, kids }
}

function flatten(p: Placed, out: Placed[] = []): Placed[] {
  out.push(p)
  for (const k of p.kids) flatten(k, out)
  return out
}

/** The cotree: internal nodes ∪ (union) and ⊕ (join), leaves labelled by the vertex ids of the graph. */
export function CotreeView({ cotree, className }: { cotree: Cotree; className?: string }) {
  const nodes = useMemo(() => flatten(place(cotree, 0, { i: 0 })), [cotree])
  const maxX = Math.max(...nodes.map((p) => p.x))
  const maxY = Math.max(...nodes.map((p) => p.y))
  const pad = 16
  const w = maxX + 2 * pad
  const h = maxY + 2 * pad
  return (
    <span className={className ?? 'block overflow-x-auto'}>
      <svg viewBox={`${-pad} ${-pad} ${w} ${h}`} width={w} height={h} className="mx-auto block text-ink" role="img" aria-label="Cotree">
        <title>Cotree</title>
        {nodes.map((p, i) =>
          p.kids.map((k, j) => <line key={`${i}-${j}`} x1={p.x} y1={p.y} x2={k.x} y2={k.y} stroke="currentColor" strokeWidth={1.1} opacity={0.8} />),
        )}
        {nodes.map((p, i) => (
          <g key={i}>
            <title>{p.leaf ? `vertex ${p.text}` : p.text === UNION ? 'union' : 'join'}</title>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.leaf ? R_LEAF : R_OP}
              fill={p.leaf ? 'var(--vertex-fill)' : 'var(--bg)'}
              stroke="currentColor"
              strokeWidth={p.leaf ? 1.2 : 1.4}
            />
            <text
              x={p.x}
              y={p.y + (p.leaf ? 3.2 : 4.5)}
              fontSize={p.leaf ? 9 : 13}
              textAnchor="middle"
              fontFamily={p.leaf ? 'var(--font-mono)' : 'var(--font-serif)'}
              fill="currentColor"
            >
              {p.text}
            </text>
          </g>
        ))}
      </svg>
    </span>
  )
}
