import type { CographExpr } from '../api/types'
import type { Edge } from './graph'

export const UNION = '∪'
export const JOIN = '⊕'

/** Text of an expression, e.g. (v ∪ v) ⊕ v. Compound operands are parenthesized. */
export function exprText(e: CographExpr): string {
  if (e.op === 'v') return 'v'
  const sym = e.op === 'union' ? UNION : JOIN
  return e.children.map((c) => (c.op === 'v' ? 'v' : `(${exprText(c)})`)).join(` ${sym} `)
}

export function exprSize(e: CographExpr): number {
  return e.op === 'v' ? 1 : e.children.reduce((s, c) => s + exprSize(c), 0)
}

/**
 * The graph of an expression. Leaves are numbered 0, 1, … from left to right, as the backend numbers them;
 * a join adds every edge between vertices of different operands.
 */
export function exprGraph(e: CographExpr): { n: number; edges: Edge[] } {
  const edges: Edge[] = []
  let next = 0
  const walk = (x: CographExpr): number[] => {
    if (x.op === 'v') return [next++]
    const parts = x.children.map(walk)
    if (x.op === 'join') {
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) for (const a of parts[i]) for (const b of parts[j]) edges.push([a, b])
    }
    return parts.flat()
  }
  walk(e)
  return { n: next, edges }
}
