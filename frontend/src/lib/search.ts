import type { SeedSummary } from '../api/types'

/** One suggestion of the header search. */
export type Hit =
  | { kind: 'seed'; name: string; label: string; d: number; status?: string }
  | { kind: 'page'; to: string; label: string; tip: string }
  | { kind: 'edges'; data: string }
  | { kind: 'more'; label: string; to: string }

export type PageEntry = { to: string; label: string; tip: string }

const MAX_D = 15

function seedHit(s: SeedSummary, d: number): Hit {
  return { kind: 'seed', name: s.name, label: s.label, d, status: s.status }
}

/**
 * The suggestions for a query, best first. Understands a diameter ("6", "d 6", "diameter 6"), a seed of diameter at
 * most 6 ("S6_3", "s6 3", "S_6^(3)", "s6(3)"), all the seeds of a diameter ("s6"), a seed of diameter 7 ("R2xR5",
 * "r2 r5", "2 5"), all the seeds with a given rooted seed ("r2"), the seeds S_d ("S9", "S_9"), an edge list, and
 * the names and descriptions of the pages.
 */
export function search(q: string, seedsByD: Map<number, SeedSummary[]>, pages: PageEntry[]): Hit[] {
  const raw = q.trim()
  const t = raw.toLowerCase()
  if (!t) return []
  const out: Hit[] = []
  const seen = new Set<string>()
  const push = (h: Hit) => {
    const key = h.kind === 'seed' ? `s:${h.name}` : h.kind === 'page' ? `p:${h.to}` : h.kind === 'more' ? `m:${h.to}` : 'e'
    if (!seen.has(key)) {
      seen.add(key)
      out.push(h)
    }
  }
  const sd = (d: number): Hit => ({ kind: 'seed', name: `S_${d}`, label: `S_{${d}}`, d, status: 'diminimal' })
  const ofDiameter = (d: number, limit = 12) => {
    const list = seedsByD.get(d) ?? []
    list.slice(0, limit).forEach((s) => push(seedHit(s, d)))
    if (list.length > limit) push({ kind: 'more', label: `all ${list.length} seeds of diameter ${d}`, to: d === 7 ? '/trees/d7' : `/trees/d${d}` })
    if (d >= 1 && d <= MAX_D) push(sd(d))
  }

  // an edge list
  if (/\d+\s*-\s*\d+/.test(raw) && /^[\d\s,;\-()[\]]+$/.test(raw)) push({ kind: 'edges', data: raw })

  let m: RegExpExecArray | null
  // a diameter
  if ((m = /^(?:d|diam|diameter)?\s*=?\s*(\d{1,2})$/.exec(t))) {
    const d = Number(m[1])
    if (d >= 1 && d <= 7) ofDiameter(d, d === 7 ? 8 : 12)
    else if (d <= MAX_D) push(sd(d))
  }
  // one seed of diameter at most 6: s6_3, s6 3, s_6^(3), s6(3)
  if ((m = /^s\s*_?\s*([1-6])\s*(?:\^|_|\s|,|-)?\s*\{?\s*\(?\s*(\d{1,2})\s*\)?\s*\}?$/.exec(t))) {
    const d = Number(m[1]), i = Number(m[2])
    const s = (seedsByD.get(d) ?? []).find((x) => x.name === `S${d}_${i}`)
    if (s) push(seedHit(s, d))
  }
  // the seeds S_d, and all the seeds of a small diameter: s9, s_9, s6
  if ((m = /^s\s*_?\s*\{?\s*(\d{1,2})\s*\}?$/.exec(t))) {
    const d = Number(m[1])
    if (d >= 1 && d <= MAX_D) push(sd(d))
    if (d <= 6) ofDiameter(d)
  }
  // a seed of diameter 7: r2xr5, r2 r5, r_2 ⊙ r_5, 2 5, 2x5
  if ((m = /^r?\s*_?\s*\{?(\d{1,2})\}?\s*(?:x|⊙|\\odot|o|\*|,|-|\s)+\s*r?\s*_?\s*\{?(\d{1,2})\}?$/.exec(t))) {
    const a = Number(m[1]), b = Number(m[2])
    if (a >= 1 && b >= 1 && a <= 12 && b <= 12) {
      const name = `R${Math.min(a, b)}xR${Math.max(a, b)}`
      const s = (seedsByD.get(7) ?? []).find((x) => x.name === name)
      if (s) push(seedHit(s, 7))
    }
  }
  // the seeds of diameter 7 with a given rooted seed: r2
  if ((m = /^r\s*_?\s*\{?(\d{1,2})\}?$/.exec(t))) {
    const a = Number(m[1])
    ;(seedsByD.get(7) ?? []).filter((s) => s.name.split('x').includes(`R${a}`)).forEach((s) => push(seedHit(s, 7)))
  }
  // pages: the name first, then the description
  const words = t.split(/\s+/).filter(Boolean)
  const byName = pages.filter((p) => p.label.toLowerCase().includes(t) || words.every((w) => p.label.toLowerCase().split(/\W+/).some((x) => x.startsWith(w))))
  const byTip = pages.filter((p) => !byName.includes(p) && words.every((w) => p.tip.toLowerCase().includes(w)))
  byName.forEach((p) => push({ kind: 'page', ...p }))
  byTip.forEach((p) => push({ kind: 'page', ...p }))
  return out
}

/** What the search shows before anything is typed. */
export function starters(seedsByD: Map<number, SeedSummary[]>, pages: PageEntry[]): Hit[] {
  const out: Hit[] = []
  const s6 = (seedsByD.get(6) ?? []).find((s) => s.name === 'S6_3')
  if (s6) out.push(seedHit(s6, 6))
  const s7 = (seedsByD.get(7) ?? []).find((s) => s.name === 'R2xR5')
  if (s7) out.push(seedHit(s7, 7))
  out.push({ kind: 'seed', name: 'S_9', label: 'S_{9}', d: 9, status: 'diminimal' })
  for (const to of ['/playground', '/trees/d6', '/lab/towers']) {
    const p = pages.find((x) => x.to === to)
    if (p) out.push({ kind: 'page', ...p })
  }
  return out
}
