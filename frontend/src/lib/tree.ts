import type { Layout, TreeInfo } from '../api/types'

/** Key of an edge in Matrix.w2: "u-v" with u < v. */
export function edgeKey(u: number, v: number): string {
  return u < v ? `${u}-${v}` : `${v}-${u}`
}

export function sortedEdges(tree: TreeInfo): [number, number][] {
  return tree.edges.map(([u, v]) => (u < v ? [u, v] : [v, u]))
}

export function vertexIds(tree: TreeInfo): number[] {
  return Array.from({ length: tree.n }, (_, i) => i)
}

export function adjacency(tree: TreeInfo): Map<number, number[]> {
  const adj = new Map<number, number[]>()
  for (let i = 0; i < tree.n; i++) adj.set(i, [])
  for (const [u, v] of tree.edges) {
    adj.get(u)?.push(v)
    adj.get(v)?.push(u)
  }
  return adj
}

/** Simple layered layout used only when the API sends no coordinates for some vertex. */
export function fallbackLayout(tree: TreeInfo): Layout {
  const adj = adjacency(tree)
  const root = tree.main_roots[0] ?? 0
  const depth = new Map<number, number>([[root, 0]])
  const order: number[] = [root]
  for (let i = 0; i < order.length; i++) {
    const u = order[i]
    for (const v of adj.get(u) ?? []) {
      if (!depth.has(v)) {
        depth.set(v, (depth.get(u) ?? 0) + 1)
        order.push(v)
      }
    }
  }
  const byLevel = new Map<number, number[]>()
  for (const v of order) {
    const d = depth.get(v) ?? 0
    if (!byLevel.has(d)) byLevel.set(d, [])
    byLevel.get(d)!.push(v)
  }
  const layout: Layout = {}
  for (const [d, vs] of byLevel) {
    vs.forEach((v, i) => {
      layout[String(v)] = [i - (vs.length - 1) / 2, d]
    })
  }
  // vertices unreachable from the root (should not happen for a tree)
  for (let v = 0; v < tree.n; v++) if (!layout[String(v)]) layout[String(v)] = [v, -1]
  return layout
}

export function completeLayout(tree: TreeInfo): Layout {
  const l = tree.layout ?? {}
  for (let v = 0; v < tree.n; v++) if (!l[String(v)]) return { ...fallbackLayout(tree), ...l }
  return l
}

/** Default matrix for a tree: zero diagonal and unit squared weights. */
export function defaultMatrix(tree: TreeInfo): { diag: Record<string, string>; w2: Record<string, string> } {
  const diag: Record<string, string> = {}
  const w2: Record<string, string> = {}
  for (let v = 0; v < tree.n; v++) diag[String(v)] = '0'
  for (const [u, v] of sortedEdges(tree)) w2[edgeKey(u, v)] = '1'
  return { diag, w2 }
}

export const KIND_LABEL: Record<TreeInfo['kind'], string> = {
  path: 'path',
  star: 'star',
  generalized_star: 'generalized star',
  double_generalized_star: 'double generalized star',
  caterpillar: 'caterpillar',
  other: 'general tree',
}
