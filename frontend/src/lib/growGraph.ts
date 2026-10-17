import { uniqueCycle, type Edge } from './graph'

/**
 * The graph of the drawing on the analysis page: a tree, or a tree with one cycle (a unicyclic graph), always
 * connected, on the vertices 0, …, n − 1. It grows by hanging leaves on vertices, so a drawing can never be
 * disconnected or have a second cycle. `closing` is the edge that closed the cycle (removed by "open the cycle").
 */
export type Grown = { n: number; edges: Edge[]; closing?: Edge }

export const MAX_VERTICES = 200 // as the backend

const norm = (a: number, b: number): Edge => (a < b ? [a, b] : [b, a])

export const ONE_VERTEX: Grown = { n: 1, edges: [] }

export function fromEdges(n: number, edges: Edge[]): Grown {
  const g: Grown = { n, edges: edges.map(([a, b]) => norm(a, b)) }
  const c = cycleOf(g)
  return c ? { ...g, closing: norm(c.at(-1)!, c[0]) } : g
}

export function hasCycle(g: Grown): boolean {
  return g.edges.length >= g.n && g.n >= 3
}

/** The vertices of the cycle in cyclic order, or null for a tree. */
export function cycleOf(g: Grown): number[] | null {
  if (g.edges.length < g.n) return null
  return uniqueCycle(range(g.n), g.edges)
}

export function adjacency(g: Grown): number[][] {
  const adj: number[][] = Array.from({ length: g.n }, () => [])
  for (const [a, b] of g.edges) {
    adj[a].push(b)
    adj[b].push(a)
  }
  for (const l of adj) l.sort((x, y) => x - y)
  return adj
}

export function adjacent(g: Grown, a: number, b: number): boolean {
  const [x, y] = norm(a, b)
  return g.edges.some(([p, q]) => p === x && q === y)
}

/** A new leaf hanging on v. */
export function addLeaf(g: Grown, v: number): Grown {
  return { ...g, n: g.n + 1, edges: [...g.edges, norm(v, g.n)] }
}

/**
 * Removes v and everything that hangs from it: the components of G − v that do not reach the anchor. The anchor is
 * the cycle (without v) in a unicyclic graph, and the vertex 0 in a tree. The result is renumbered in order.
 */
export function removeHanging(g: Grown, v: number): Grown {
  const cycle = cycleOf(g)
  const anchor = new Set(cycle ? cycle.filter((c) => c !== v) : v === 0 ? [] : [0])
  if (anchor.size === 0 || g.n <= 1) return g
  const adj = adjacency(g)
  const keep = new Set<number>()
  const stack = [...anchor]
  for (const a of stack) keep.add(a)
  while (stack.length) {
    const x = stack.pop()!
    for (const y of adj[x]) {
      if (y !== v && !keep.has(y)) {
        keep.add(y)
        stack.push(y)
      }
    }
  }
  return induced(g, keep)
}

function induced(g: Grown, keep: Set<number>): Grown {
  const order = range(g.n).filter((x) => keep.has(x))
  const id = new Map(order.map((x, i) => [x, i]))
  const edges = g.edges.filter(([a, b]) => keep.has(a) && keep.has(b)).map(([a, b]) => norm(id.get(a)!, id.get(b)!))
  const out: Grown = { n: order.length, edges }
  if (g.closing && keep.has(g.closing[0]) && keep.has(g.closing[1]) && edges.length >= out.n) {
    out.closing = norm(id.get(g.closing[0])!, id.get(g.closing[1])!)
  }
  return out
}

/** Joins two non-adjacent vertices of a tree: the new edge closes the only cycle. */
export function closeCycle(g: Grown, a: number, b: number): Grown | string {
  if (hasCycle(g)) return 'The graph already has its cycle.'
  if (a === b) return 'Pick two different vertices.'
  if (adjacent(g, a, b)) return 'These two vertices are already joined; pick two that are not.'
  const e = norm(a, b)
  return { n: g.n, edges: [...g.edges, e], closing: e }
}

/** Removes the edge that closed the cycle (or, for a graph that came whole, one edge of the cycle). */
export function openCycle(g: Grown): Grown {
  const c = cycleOf(g)
  if (!c) return g
  const e = g.closing ?? norm(c.at(-1)!, c[0])
  return { n: g.n, edges: g.edges.filter(([a, b]) => !(a === e[0] && b === e[1])) }
}

/**
 * The tree coalesced with the cycle C_k at the vertex `attach`: one copy (mode 'one') or a copy at every cycle vertex
 * (mode 'all'). The same construction as couple() of the backend, so the cycle is 0, …, k − 1.
 */
export function attachToCycle(g: Grown, attach: number, k: number, mode: 'one' | 'all'): Grown {
  const edges: Edge[] = range(k).map((i) => norm(i, (i + 1) % k))
  let n = k
  for (const c of mode === 'all' ? range(k) : [0]) {
    const ids = new Map<number, number>([[attach, c]])
    for (let v = 0; v < g.n; v++) if (v !== attach) ids.set(v, n++)
    for (const [a, b] of g.edges) edges.push(norm(ids.get(a)!, ids.get(b)!))
  }
  return { n, edges, closing: norm(k - 1, 0) }
}

export function path(n: number): Grown {
  return { n, edges: range(n - 1).map((i) => norm(i, i + 1)) }
}

export function star(leaves: number): Grown {
  return { n: leaves + 1, edges: range(leaves).map((i) => norm(0, i + 1)) }
}

/** The diameter of a tree (in edges), by two breadth-first searches. */
export function treeDiameter(g: Grown): number {
  if (g.n <= 1) return 0
  const adj = adjacency(g)
  const far = (s: number) => {
    const dist = new Array(g.n).fill(-1)
    dist[s] = 0
    const q = [s]
    for (const x of q) for (const y of adj[x]) if (dist[y] < 0) ((dist[y] = dist[x] + 1), q.push(y))
    let best = s
    for (let v = 0; v < g.n; v++) if (dist[v] > dist[best]) best = v
    return { v: best, d: dist[best] }
  }
  return far(far(0).v).d
}

export function edgesText(g: Grown): string {
  return g.edges.map(([a, b]) => `${a}-${b}`).join(', ')
}

// ---- the address of a drawing: g=<n>.<a>-<b>_<a>-<b>…, c=<a>-<b> for the closing edge ---------------------------

export function encode(g: Grown): URLSearchParams {
  const s = new URLSearchParams({ g: `${g.n}.${g.edges.map(([a, b]) => `${a}-${b}`).join('_')}` })
  if (g.closing) s.set('c', `${g.closing[0]}-${g.closing[1]}`)
  return s
}

export function decode(g: string | null, c: string | null): Grown | null {
  const m = g ? /^(\d+)\.(.*)$/.exec(g) : null
  if (!m) return null
  const n = Number(m[1])
  if (!(n >= 1 && n <= MAX_VERTICES)) return null
  const edges: Edge[] = []
  for (const part of m[2] ? m[2].split('_') : []) {
    const e = /^(\d+)-(\d+)$/.exec(part)
    if (!e) return null
    const a = Number(e[1]), b = Number(e[2])
    if (a >= n || b >= n || a === b) return null
    edges.push(norm(a, b))
  }
  // connected, and a tree or one cycle
  if (edges.length !== n - 1 && edges.length !== n) return null
  if (!connected(n, edges)) return null
  const out = fromEdges(n, edges)
  const ce = c ? /^(\d+)-(\d+)$/.exec(c) : null
  if (ce && out.closing) {
    const e = norm(Number(ce[1]), Number(ce[2]))
    const cyc = cycleOf(out)!
    const onCycle = cyc.some((x, i) => norm(x, cyc[(i + 1) % cyc.length]).join() === e.join())
    if (onCycle) out.closing = e
  }
  return out
}

function connected(n: number, edges: Edge[]): boolean {
  const g: Grown = { n, edges }
  const adj = adjacency(g)
  const seen = new Set([0])
  const q = [0]
  for (const x of q) for (const y of adj[x]) if (!seen.has(y)) (seen.add(y), q.push(y))
  return seen.size === n
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

// ---- layout ------------------------------------------------------------------------------------------------------

export type Point = { x: number; y: number }
export type GrownLayout = { pos: Point[]; width: number; height: number; center?: Point }

const GAP_X = 46
const GAP_Y = 58
const MARGIN = 34

/**
 * Where each vertex is drawn. A tree hangs from the vertex 0, each level a row, each parent centred over its
 * children, so a new leaf appears under the vertex that was clicked. A unicyclic graph has its cycle in the middle and
 * each pendant tree spreading outwards in its own sector, as wide as its number of leaves.
 */
export function layoutOf(g: Grown): GrownLayout {
  const cycle = cycleOf(g)
  return cycle ? radial(g, cycle) : tidy(g)
}

function tidy(g: Grown): GrownLayout {
  const adj = adjacency(g)
  const children: number[][] = Array.from({ length: g.n }, () => [])
  const depth = new Array(g.n).fill(0)
  const seen = new Set([0])
  const q = [0]
  for (const x of q) {
    for (const y of adj[x]) {
      if (!seen.has(y)) {
        seen.add(y)
        children[x].push(y)
        depth[y] = depth[x] + 1
        q.push(y)
      }
    }
  }
  const xs = new Array(g.n).fill(0)
  let slot = 0
  const place = (v: number) => {
    if (children[v].length === 0) {
      xs[v] = slot++
      return
    }
    for (const c of children[v]) place(c)
    xs[v] = (xs[children[v][0]] + xs[children[v].at(-1)!]) / 2
  }
  place(0)
  const maxDepth = Math.max(...depth)
  const pos = range(g.n).map((v) => ({ x: MARGIN + xs[v] * GAP_X, y: MARGIN + depth[v] * GAP_Y }))
  return { pos, width: 2 * MARGIN + Math.max(0, slot - 1) * GAP_X, height: 2 * MARGIN + maxDepth * GAP_Y + GAP_Y * 0.7 }
}

function radial(g: Grown, cycle: number[]): GrownLayout {
  const adj = adjacency(g)
  const onCycle = new Set(cycle)
  // the pendant tree of each cycle vertex
  const children: number[][] = Array.from({ length: g.n }, () => [])
  const depth = new Array(g.n).fill(0)
  for (const c of cycle) {
    const q = [c]
    for (const x of q) {
      for (const y of adj[x]) {
        if (!onCycle.has(y) && y !== c && depth[y] === 0 && !q.includes(y)) {
          children[x].push(y)
          depth[y] = depth[x] + 1
          q.push(y)
        }
      }
    }
  }
  const leaves = (v: number): number => (children[v].length === 0 ? 1 : children[v].reduce((s, c) => s + leaves(c), 0))
  const weight = cycle.map((c) => Math.max(1, children[c].length === 0 ? 1 : leaves(c)))
  const total = weight.reduce((a, b) => a + b, 0)
  const maxDepth = Math.max(0, ...depth)
  // the inner radius leaves room for the cycle and for the leaves of the first ring
  const r0 = Math.max(64, (40 * cycle.length) / (2 * Math.PI), (34 * total) / (2 * Math.PI) - GAP_Y + 8)
  const polar: { a: number; r: number }[] = new Array(g.n)
  let start = -Math.PI / 2 - (Math.PI * weight[0]) / total
  cycle.forEach((c, i) => {
    const span = (2 * Math.PI * weight[i]) / total
    let slot = 0
    const place = (v: number): number => {
      let a: number
      if (children[v].length === 0 || (v === c && children[v].length === 0)) {
        a = start + ((slot + 0.5) / weight[i]) * span
        slot++
      } else {
        const as = children[v].map(place)
        a = (as[0] + as.at(-1)!) / 2
      }
      polar[v] = { a, r: r0 + depth[v] * GAP_Y }
      return a
    }
    place(c)
    polar[c] = { a: start + span / 2, r: r0 }
    start += span
  })
  const R = r0 + maxDepth * GAP_Y
  const cx = MARGIN + R + 14, cy = MARGIN + R + 14
  const pos = polar.map(({ a, r }) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }))
  return { pos, width: 2 * (R + MARGIN + 14), height: 2 * (R + MARGIN + 14), center: { x: cx, y: cy } }
}
