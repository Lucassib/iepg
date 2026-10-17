import { useLayoutEffect, useMemo, useRef } from 'react'
import type { AdmissibleNode, Rational } from '../api/types'
import { tint } from '../lib/colors'

/**
 * The recursion tree of the admissibility test, top-down. Each box shows the tuple, γ_L, γ_R and the lateral chosen;
 * the edges go to the interior and to the lateral child, the lateral not taken is dashed and muted, the untested
 * 3-element sets are muted, and the set whose first and last gaps coincide is drawn in the amber state color.
 */

type Kind = 'ok' | 'cause' | 'fail' | 'untested' | 'alternative'
type Box = { lines: string[]; kind: Kind; w: number; h: number; kids: { role: string; box: Box }[] }
type Placed = { box: Box; x: number; y: number; kids: { role: string; p: Placed }[] }

const CHAR = 6.25
const LINE = 14
const PAD_X = 9
const PAD_Y = 7
const GAP_X = 14
const GAP_Y = 40
const FONT = 10.5

const tuple = (s: Rational[]) => `(${s.join(', ')})`

function sizeOf(lines: string[]): { w: number; h: number } {
  const chars = Math.max(...lines.map((l) => l.length))
  return { w: Math.ceil(chars * CHAR + 2 * PAD_X), h: lines.length * LINE + 2 * PAD_Y - 2 }
}

function isCause(n: AdmissibleNode): boolean {
  return n.tested && !n.ok && n.gammaL !== null && n.gammaL === n.gammaR
}

function toBox(n: AdmissibleNode): Box {
  const lines = [tuple(n.set)]
  let kind: Kind = 'ok'
  if (!n.tested) {
    lines.push(`k = ${n.k} · not tested`)
    kind = 'untested'
  } else {
    lines.push(`k = ${n.k} · γL = ${n.gammaL ?? '–'} · γR = ${n.gammaR ?? '–'}`)
    if (isCause(n)) {
      lines.push('the first and last gaps coincide')
      kind = 'cause'
    } else if (n.choice) {
      lines.push(`lateral Λ${n.choice === '+' ? '₊' : '₋'}, μ${n.choice === '+' ? '₊' : '₋'} = ${n.mu}`)
      if (!n.ok) {
        lines.push('not admissible: a set below fails')
        kind = 'fail'
      }
    } else if (!n.ok) {
      lines.push(n.fail || 'not admissible')
      kind = n.children.length === 0 ? 'cause' : 'fail'
    }
  }
  const kids = n.children.map((c) => ({ role: c.role === 'lateral' ? `lateral ${n.choice ?? ''}`.trim() : 'interior', box: toBox(c.node) }))
  if (n.alternative) {
    const other = n.choice === '+' ? '−' : '+'
    const alt = [tuple(n.alternative), `lateral ${other} not taken`]
    kids.push({ role: 'not taken', box: { lines: alt, kind: 'alternative', ...sizeOf(alt), kids: [] } })
  }
  return { lines, kind, ...sizeOf(lines), kids }
}

function subtreeWidth(b: Box, memo: Map<Box, number>): number {
  const m = memo.get(b)
  if (m !== undefined) return m
  const kidsW = b.kids.reduce((s, k) => s + subtreeWidth(k.box, memo), 0) + GAP_X * Math.max(0, b.kids.length - 1)
  const w = Math.max(b.w, kidsW)
  memo.set(b, w)
  return w
}

function levelHeights(b: Box, depth: number, out: number[]) {
  out[depth] = Math.max(out[depth] ?? 0, b.h)
  for (const k of b.kids) levelHeights(k.box, depth + 1, out)
}

function place(b: Box, cx: number, depth: number, rowY: number[], memo: Map<Box, number>): Placed {
  const total = b.kids.reduce((s, k) => s + subtreeWidth(k.box, memo), 0) + GAP_X * Math.max(0, b.kids.length - 1)
  let x = cx - total / 2
  const kids = b.kids.map((k) => {
    const w = subtreeWidth(k.box, memo)
    const p = place(k.box, x + w / 2, depth + 1, rowY, memo)
    x += w + GAP_X
    return { role: k.role, p }
  })
  return { box: b, x: cx, y: rowY[depth], kids }
}

function flatten(p: Placed, out: Placed[] = []): Placed[] {
  out.push(p)
  for (const k of p.kids) flatten(k.p, out)
  return out
}

const STYLE: Record<Kind, { stroke: string; fill: string; text: string; dash?: string; width: number; opacity: number }> = {
  ok: { stroke: 'var(--border)', fill: 'var(--surface)', text: 'var(--text)', width: 1.1, opacity: 1 },
  fail: { stroke: 'var(--state-defective)', fill: 'var(--surface)', text: 'var(--text)', width: 1.1, opacity: 1 },
  cause: { stroke: 'var(--state-defective)', fill: tint('var(--state-defective)', 16), text: 'var(--text)', width: 2, opacity: 1 },
  untested: { stroke: 'var(--border)', fill: 'var(--bg)', text: 'var(--muted)', dash: '3 3', width: 1, opacity: 0.85 },
  alternative: { stroke: 'var(--muted)', fill: 'var(--bg)', text: 'var(--muted)', dash: '4 3', width: 1, opacity: 0.6 },
}

export function AdmissibleTree({ root }: { root: AdmissibleNode }) {
  const { nodes, width, height } = useMemo(() => {
    const box = toBox(root)
    const memo = new Map<Box, number>()
    const heights: number[] = []
    levelHeights(box, 0, heights)
    const rowY: number[] = []
    let y = 0
    for (const h of heights) {
      rowY.push(y)
      y += h + GAP_Y
    }
    const w = subtreeWidth(box, memo)
    const placed = place(box, w / 2, 0, rowY, memo)
    return { nodes: flatten(placed), width: w, height: y - GAP_Y }
  }, [root])
  const pad = 8
  const scroller = useRef<HTMLDivElement>(null)
  // the root sits in the middle of a wide drawing: open the scroll area centered on it
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
  }, [width])
  return (
    <div ref={scroller} className="max-w-full overflow-x-auto rounded-md border border-line bg-paper p-2">
      <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} width={width + 2 * pad} height={height + 2 * pad} className="mx-auto block text-ink" role="img" aria-label="Recursion tree of the admissibility test">
        <title>Recursion tree of the admissibility test</title>
        {nodes.map((p, i) =>
          p.kids.map((k, j) => {
            const x1 = p.x
            const y1 = p.y + p.box.h
            const x2 = k.p.x
            const y2 = k.p.y
            const alt = k.p.box.kind === 'alternative'
            return (
              <g key={`${i}-${j}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={alt ? 'var(--muted)' : 'currentColor'} strokeWidth={1} strokeDasharray={alt ? '4 3' : undefined} opacity={alt ? 0.6 : 0.8} />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 3}
                  fontSize={9}
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fill="var(--muted)"
                  stroke="var(--bg)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  opacity={alt ? 0.8 : 1}
                >
                  {k.role}
                </text>
              </g>
            )
          }),
        )}
        {nodes.map((p, i) => {
          const s = STYLE[p.box.kind]
          const left = p.x - p.box.w / 2
          return (
            <g key={i} opacity={s.opacity}>
              <rect x={left} y={p.y} width={p.box.w} height={p.box.h} rx={6} fill={s.fill} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
              {p.box.lines.map((l, j) => (
                <text
                  key={j}
                  x={left + PAD_X}
                  y={p.y + PAD_Y + 9 + j * LINE}
                  fontSize={FONT}
                  fontFamily="var(--font-mono)"
                  fill={(p.box.kind === 'cause' || p.box.kind === 'fail') && j >= 2 && j === p.box.lines.length - 1 ? 'var(--state-defective)' : j === 0 ? s.text : 'var(--muted)'}
                  fontWeight={j === 0 ? 500 : 400}
                >
                  {l}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
