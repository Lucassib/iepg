import { useMemo, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { TreeInfo } from '../api/types'
import { completeLayout, edgeKey } from '../lib/tree'
import { cn } from '../lib/cn'
import { FloatingTip, TipTitle, type FloatingTipHandle } from './ui/tooltip'
import { Tex } from './Tex'

/** Fixed drawing constants: every figure keeps the same proportions (thesis convention). */
export const SCALE_GRID = 26
export const SCALE_CARD = 40
const R = 4
const R_ROOT = 5
const STROKE = 1.2

export type TreeViewProps = {
  tree: TreeInfo
  /** pixels per unit edge length; SCALE_GRID in grids, SCALE_CARD (default) in cards and in the lab */
  scale?: number
  /** vertices drawn in red; defaults to tree.main_roots. The first one is the root of the depths in the tooltips. */
  roots?: number[]
  /** vertices (and their incident edges) drawn in the muted color */
  grayVertices?: number[]
  /** text drawn beside a vertex (monospace) */
  labels?: Record<string, string>
  /** TeX of the name of the vertex labels in the tooltip, e.g. v => `m_{v,v}` or `\hat d_v`; "label" when absent */
  labelName?: (v: number) => string
  /** text drawn on an edge, keyed "u-v" with u < v */
  edgeLabels?: Record<string, string>
  /** vertices with a solid ring */
  highlight?: number[]
  /** vertices with a dashed ring */
  secondary?: number[]
  /** extra dashed edges, added to tree.dashed_edges */
  dashedEdges?: [number, number][]
  showIds?: boolean
  /** fill and stroke color per vertex (copies of a composition); never used for roots, which stay red */
  vertexColors?: Record<string, string>
  /** when given, only these vertices react to clicks and hovers (with a larger hit area) */
  clickable?: number[]
  /** an extra line in the tooltip of a vertex */
  vertexInfo?: (v: number) => ReactNode
  /** the tooltip of an edge; edges get a wider hover area when it is given */
  edgeInfo?: (u: number, v: number) => ReactNode
  className?: string
  alt?: string
  onVertexClick?: (v: number) => void
  onVertexEnter?: (v: number) => void
  onVertexLeave?: (v: number) => void
}

/** Degree of every vertex and depth from the root, for the tooltips. */
function degreesAndDepths(tree: TreeInfo, root: number): { deg: number[]; depth: number[] } {
  const adj: number[][] = Array.from({ length: tree.n }, () => [])
  for (const [u, v] of tree.edges) {
    adj[u]?.push(v)
    adj[v]?.push(u)
  }
  const deg = adj.map((a) => a.length)
  const depth = new Array<number>(tree.n).fill(-1)
  if (root >= 0 && root < tree.n) {
    depth[root] = 0
    const queue = [root]
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i]
      for (const w of adj[u]) {
        if (depth[w] === -1) {
          depth[w] = depth[u] + 1
          queue.push(w)
        }
      }
    }
  }
  return { deg, depth }
}

/**
 * Draws a TreeInfo from its API layout at a fixed scale. The SVG has explicit pixel dimensions, is centered in
 * its container and overflows horizontally (scroll) instead of shrinking, so trees in a grid share one scale.
 * Events are delegated to the SVG and a single tooltip follows the pointer (vertex, degree, depth, label; the
 * matrix entry of an edge when `edgeInfo` is given), so large trees stay fast.
 */
export function TreeView({
  tree,
  scale = SCALE_CARD,
  roots,
  grayVertices,
  labels,
  labelName,
  edgeLabels,
  highlight,
  secondary,
  dashedEdges,
  showIds = false,
  vertexColors,
  clickable,
  vertexInfo,
  edgeInfo,
  className,
  alt,
  onVertexClick,
  onVertexEnter,
  onVertexLeave,
}: TreeViewProps) {
  const layout = useMemo(() => completeLayout(tree), [tree])
  const rootList = roots ?? tree.main_roots
  const rootSet = useMemo(() => new Set(rootList), [rootList])
  const depthRoot = rootList[0] ?? 0
  const info = useMemo(() => degreesAndDepths(tree, depthRoot), [tree, depthRoot])
  const gray = useMemo(() => new Set(grayVertices ?? []), [grayVertices])
  const hi = useMemo(() => new Set(highlight ?? []), [highlight])
  const hi2 = useMemo(() => new Set(secondary ?? []), [secondary])
  const clickSet = useMemo(() => (clickable ? new Set(clickable) : null), [clickable])
  const dashed = useMemo(() => {
    const s = new Set<string>()
    for (const [u, v] of tree.dashed_edges ?? []) s.add(edgeKey(u, v))
    for (const [u, v] of dashedEdges ?? []) s.add(edgeKey(u, v))
    return s
  }, [tree.dashed_edges, dashedEdges])

  const svgRef = useRef<SVGSVGElement>(null)
  const tip = useRef<FloatingTipHandle>(null)
  const hovered = useRef<string | null>(null)
  const pointer = useRef('mouse')

  const pt = (v: number): [number, number] => {
    const p = layout[String(v)] ?? [0, 0]
    return [p[0] * scale, p[1] * scale]
  }

  const hasLabels = !!labels && Object.keys(labels).length > 0
  const hasEdgeLabels = !!edgeLabels && Object.keys(edgeLabels).length > 0
  const pad = 12 + (hasLabels || hasEdgeLabels || showIds ? 26 : 0)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let v = 0; v < tree.n; v++) {
    const [x, y] = pt(v)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) minX = maxX = minY = maxY = 0
  const w = Math.ceil(maxX - minX + 2 * pad)
  const h = Math.ceil(maxY - minY + 2 * pad)
  const title = alt ?? `Tree ${tree.canonical}`
  const interactive = !!(onVertexClick || onVertexEnter)
  const isActive = (v: number) => interactive && (clickSet === null || clickSet.has(v))

  // --- delegated events -------------------------------------------------------------------------------------------

  const keyOf = (t: EventTarget | null): string | null => {
    const el = (t as Element | null)?.closest?.('[data-v],[data-e]')
    if (!el) return null
    const v = el.getAttribute('data-v')
    return v !== null ? `v:${v}` : `e:${el.getAttribute('data-e')}`
  }

  const vertexContent = (v: number): ReactNode => {
    const label = labels?.[String(v)]
    const extra = vertexInfo?.(v)
    const d = info.depth[v]
    return (
      <div className="space-y-0.5">
        <TipTitle className="font-medium">
          vertex {v} <span className="font-normal text-muted">·</span> <span className="font-normal">degree {info.deg[v] ?? 0}</span>
          {d !== undefined && d >= 0 && (
            <>
              {' '}
              <span className="font-normal text-muted">·</span> <span className="font-normal">depth {d}</span>
            </>
          )}
        </TipTitle>
        {label !== undefined && (
          <div>
            {labelName ? <Tex tex={labelName(v)} /> : 'label'} = <span className="mono">{label}</span>
          </div>
        )}
        {extra && <div>{extra}</div>}
      </div>
    )
  }

  const showFor = (key: string, target: Element, immediate: boolean) => {
    const svg = svgRef.current
    if (!svg) return
    if (key.startsWith('v:')) {
      const v = Number(key.slice(2))
      const owner = target.closest('[data-v]') ?? target
      const anchor = owner.querySelector('[data-dot]') ?? owner
      tip.current?.show(anchor, vertexContent(v), immediate, owner)
    } else if (edgeInfo) {
      const [u, v] = key.slice(2).split('-').map(Number)
      const content = edgeInfo(u, v)
      const owner = target.closest('[data-e]') ?? target
      if (content) tip.current?.show(owner, content, immediate, owner)
    }
  }

  const leave = () => {
    const k = hovered.current
    hovered.current = null
    if (k?.startsWith('v:')) {
      const v = Number(k.slice(2))
      if (isActive(v)) onVertexLeave?.(v)
    }
    tip.current?.hide()
  }

  const onPointerOver = (e: PointerEvent<SVGSVGElement>) => {
    pointer.current = e.pointerType
    if (e.pointerType === 'touch') return
    const key = keyOf(e.target)
    if (key === hovered.current) return
    leave()
    if (!key) return
    hovered.current = key
    if (key.startsWith('v:')) {
      const v = Number(key.slice(2))
      if (isActive(v)) onVertexEnter?.(v)
    }
    showFor(key, e.target as Element, false)
  }

  const onPointerLeave = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') return
    leave()
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    pointer.current = e.pointerType
  }

  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const key = keyOf(e.target)
    if (key?.startsWith('v:')) {
      const v = Number(key.slice(2))
      if (isActive(v) && onVertexClick) {
        tip.current?.hide(true)
        onVertexClick(v)
        return
      }
    }
    if (pointer.current !== 'touch') return
    // touch: a tap toggles the tooltip of a vertex or an edge
    if (!key || (tip.current?.isOpen() && hovered.current === key)) {
      hovered.current = null
      tip.current?.hide(true)
      return
    }
    hovered.current = key
    showFor(key, e.target as Element, true)
  }

  return (
    <span className={cn('block overflow-x-auto', className)}>
      <svg
        ref={svgRef}
        viewBox={`${minX - pad} ${minY - pad} ${w} ${h}`}
        width={w}
        height={h}
        className="mx-auto block text-ink"
        role="img"
        aria-label={title}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <g strokeWidth={STROKE} strokeLinecap="round">
          {tree.edges.map(([u, v]) => {
            const [x1, y1] = pt(u)
            const [x2, y2] = pt(v)
            const k = edgeKey(u, v)
            const isGray = gray.has(u) || gray.has(v)
            const isDashed = dashed.has(k)
            return (
              <line
                key={k}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isGray ? 'var(--muted)' : isDashed ? 'var(--edge-dashed)' : 'currentColor'}
                strokeDasharray={isDashed ? '4 3' : undefined}
                opacity={isGray ? 0.7 : 1}
              />
            )
          })}
        </g>
        {edgeInfo && (
          <g stroke="transparent" strokeWidth={9} strokeLinecap="round">
            {tree.edges.map(([u, v]) => {
              const [x1, y1] = pt(u)
              const [x2, y2] = pt(v)
              const k = edgeKey(u, v)
              return <line key={k} data-e={k} x1={x1} y1={y1} x2={x2} y2={y2} style={{ cursor: 'help' }} />
            })}
          </g>
        )}
        {edgeLabels &&
          tree.edges.map(([u, v]) => {
            const t = edgeLabels[edgeKey(u, v)]
            if (t === undefined) return null
            const [x1, y1] = pt(u)
            const [x2, y2] = pt(v)
            return (
              <text
                key={'el' + edgeKey(u, v)}
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 3}
                fontSize={9}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fill="var(--muted)"
                stroke="var(--bg)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {t}
              </text>
            )
          })}
        {Array.from({ length: tree.n }, (_, v) => {
          const [x, y] = pt(v)
          const isRoot = rootSet.has(v)
          const isGray = gray.has(v)
          const r = isRoot ? R_ROOT : R
          const color = !isRoot && !isGray ? vertexColors?.[String(v)] : undefined
          const active = isActive(v)
          return (
            <g key={v} data-v={v} style={active ? { cursor: 'pointer' } : undefined}>
              <circle cx={x} cy={y} r={r + (active && clickSet !== null ? 7 : 3)} fill="transparent" />
              {hi.has(v) && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="currentColor" strokeWidth={1.6} />}
              {hi2.has(v) && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="2.5 2.5" />}
              <circle
                data-dot
                cx={x}
                cy={y}
                r={r}
                fill={isRoot && !isGray ? 'var(--root-red)' : color ?? 'var(--vertex-fill)'}
                stroke={isGray ? 'var(--muted)' : isRoot ? 'var(--root-red)' : color ?? 'currentColor'}
                strokeWidth={STROKE}
                opacity={isGray ? 0.7 : 1}
              />
              {showIds && (
                <text
                  x={x + r + 2}
                  y={y + r + 7}
                  fontSize={8}
                  fontFamily="var(--font-mono)"
                  fill="var(--muted)"
                  stroke="var(--bg)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {v}
                </text>
              )}
              {labels && labels[String(v)] !== undefined && (
                <text
                  x={x + r + 2}
                  y={y - r - 1}
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  fill="currentColor"
                  stroke="var(--bg)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {labels[String(v)]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <FloatingTip ref={tip} />
    </span>
  )
}
