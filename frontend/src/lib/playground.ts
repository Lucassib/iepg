import type { PlaygroundOp } from '../api/types'

/** Ops in the URL: "y-u" pairs joined by "_", e.g. [[0,1],[0,12]] → "0-1_0-12" (no character needs escaping). */
export function encodeOps(ops: PlaygroundOp[]): string {
  return ops.map(([y, u]) => `${y}-${u}`).join('_')
}

export function decodeOps(text: string | null): PlaygroundOp[] {
  if (!text) return []
  const out: PlaygroundOp[] = []
  for (const part of text.split('_')) {
    const m = /^(\d+)-(\d+)$/.exec(part.trim())
    if (m) out.push([Number(m[1]), Number(m[2])])
  }
  return out
}

/** The vertices of the branch rooted at u when the edge u–y is removed (u's side). */
export function branchVertices(edges: [number, number][], u: number, y: number): number[] {
  const adj = new Map<number, number[]>()
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a)!.push(b)
    adj.get(b)!.push(a)
  }
  const seen = new Set<number>([u, y])
  const out = [u]
  for (let i = 0; i < out.length; i++) {
    for (const w of adj.get(out[i]) ?? []) {
      if (!seen.has(w)) {
        seen.add(w)
        out.push(w)
      }
    }
  }
  return out
}

/**
 * The Playground seed that realizes a diminimal catalog seed, when the thesis builds one: S6_1, …, S6_6 are the six
 * diminimal seeds of diameter 6, and R_i ⊙ R_j with i ≤ j ≤ 6 is the tower seed T_i_j of diameter 7 (checked against the
 * canonical forms of the API on 2026-10-11). Defective seeds have no realization, hence null.
 */
export function playgroundSeedFor(catalogName: string): { d: number; id: string } | null {
  const six = /^S6_([1-6])$/.exec(catalogName)
  if (six) return { d: 6, id: `S6_${six[1]}` }
  const seven = /^R(\d+)xR(\d+)$/.exec(catalogName)
  if (seven) {
    const i = Number(seven[1]), j = Number(seven[2])
    if (i >= 1 && j >= 1 && i <= 6 && j <= 6) return { d: 7, id: `T_${Math.min(i, j)}_${Math.max(i, j)}` }
  }
  return null
}

export function playgroundHref(d: number, id: string): string {
  return `/playground?d=${d}&seed=${encodeURIComponent(id)}`
}
