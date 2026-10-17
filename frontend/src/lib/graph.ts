import type { Layout } from '../api/types'
import { edgeKey } from './tree'

export type Edge = [number, number]

/** Union-find over arbitrary vertex ids. */
export class UnionFind {
  private parent = new Map<number, number>()
  find(x: number): number {
    let p = this.parent.get(x) ?? x
    if (p === x) {
      this.parent.set(x, x)
      return x
    }
    p = this.find(p)
    this.parent.set(x, p)
    return p
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    this.parent.set(ra, rb)
    return true
  }
}

/** The connected components (lists of ids, in the order of `ids`). */
export function components(ids: number[], edges: Edge[]): number[][] {
  const uf = new UnionFind()
  for (const v of ids) uf.find(v)
  for (const [a, b] of edges) uf.union(a, b)
  const byRoot = new Map<number, number[]>()
  for (const v of ids) {
    const r = uf.find(v)
    if (!byRoot.has(r)) byRoot.set(r, [])
    byRoot.get(r)!.push(v)
  }
  return Array.from(byRoot.values())
}

export function sameComponent(ids: number[], edges: Edge[], a: number, b: number): boolean {
  const uf = new UnionFind()
  for (const v of ids) uf.find(v)
  for (const [x, y] of edges) uf.union(x, y)
  return uf.find(a) === uf.find(b)
}

/** Number of independent cycles: m − n + c. */
export function cyclomatic(ids: number[], edges: Edge[]): number {
  return edges.length - ids.length + components(ids, edges).length
}

/**
 * The vertices of the cycle of a graph with exactly one cycle, in cyclic order (leaves are pruned until only the
 * cycle is left); null when there is no cycle.
 */
export function uniqueCycle(ids: number[], edges: Edge[]): number[] | null {
  const adj = new Map<number, Set<number>>()
  for (const v of ids) adj.set(v, new Set())
  for (const [a, b] of edges) {
    adj.get(a)?.add(b)
    adj.get(b)?.add(a)
  }
  const deg = new Map<number, number>()
  for (const [v, s] of adj) deg.set(v, s.size)
  const removed = new Set<number>()
  const queue = ids.filter((v) => (deg.get(v) ?? 0) <= 1)
  while (queue.length > 0) {
    const v = queue.pop()!
    if (removed.has(v)) continue
    removed.add(v)
    for (const w of adj.get(v) ?? []) {
      if (removed.has(w)) continue
      const d = (deg.get(w) ?? 0) - 1
      deg.set(w, d)
      if (d <= 1) queue.push(w)
    }
  }
  const rest = ids.filter((v) => !removed.has(v))
  if (rest.length < 3) return null
  const inRest = new Set(rest)
  const order = [rest[0]]
  const seen = new Set(order)
  for (;;) {
    const cur = order[order.length - 1]
    const next = Array.from(adj.get(cur) ?? []).find((w) => inRest.has(w) && !seen.has(w))
    if (next === undefined) break
    order.push(next)
    seen.add(next)
  }
  return order
}

/** Edges of a cycle given in cyclic order. */
export function cycleEdges(cycle: number[]): Edge[] {
  return cycle.map((v, i) => [v, cycle[(i + 1) % cycle.length]] as Edge)
}

/** Renumbers ids to 0..n−1 (in the order of `ids`), as the backend expects. */
export function compactGraph(ids: number[], edges: Edge[]) {
  const toCompact = new Map<number, number>()
  ids.forEach((v, i) => toCompact.set(v, i))
  const cEdges: Edge[] = edges.map(([a, b]) => [toCompact.get(a)!, toCompact.get(b)!])
  return { n: ids.length, edges: cEdges, toCompact, fromCompact: ids }
}

/** "0-1, 1-2, 1-3": the edge-list format of the analyze page. */
export function edgeListText(edges: Edge[]): string {
  return edges.map(([a, b]) => `${a}-${b}`).join(', ')
}

export function hasEdge(edges: Edge[], a: number, b: number): boolean {
  const k = edgeKey(a, b)
  return edges.some(([x, y]) => edgeKey(x, y) === k)
}

/** n points on a circle of the given radius (units), vertex 0 at the top, clockwise. */
export function circleLayout(n: number, radius = 1.6): Layout {
  const out: Layout = {}
  if (n === 1) {
    out['0'] = [0, 0]
    return out
  }
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n
    out[String(i)] = [radius * Math.cos(t), radius * Math.sin(t)]
  }
  return out
}

/** Radius (units) that keeps neighbouring points on a circle about `gap` units apart. */
export function circleRadius(n: number, gap = 0.9, min = 1): number {
  if (n <= 1) return 0
  return Math.max(min, (gap * n) / (2 * Math.PI))
}
