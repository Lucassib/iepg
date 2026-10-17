/**
 * Splits backend prose into segments so that the first occurrence of each glossary term (outside math) can be
 * rendered as a Term. Pure, so that a page can decide "first occurrence on the page" in one pass over its texts.
 */
export type GlossSegment = { text: string; term?: string }

const MATH = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The segments of `text`, where the first occurrence of each key of `keys` not yet in `used` (a word or phrase,
 * case-insensitive, singular or plural) becomes a term segment; `used` is updated. Math segments are left whole.
 */
export function glossSegments(text: string, keys: string[], used: Set<string>): GlossSegment[] {
  const out: GlossSegment[] = []
  for (const part of text.split(MATH)) {
    if (part === '') continue
    if (MATH.test(part)) {
      MATH.lastIndex = 0
      out.push({ text: part })
      continue
    }
    MATH.lastIndex = 0
    let rest = part
    for (;;) {
      const open = keys.filter((k) => !used.has(k)).sort((a, b) => b.length - a.length)
      if (open.length === 0) break
      const re = new RegExp(`\\b(${open.map(escapeRe).join('|')})s?\\b`, 'i')
      const m = re.exec(rest)
      if (!m) break
      const key = open.find((k) => k.toLowerCase() === m[1].toLowerCase()) ?? m[1]
      if (m.index > 0) out.push({ text: rest.slice(0, m.index) })
      out.push({ text: m[0], term: key })
      used.add(key)
      rest = rest.slice(m.index + m[0].length)
    }
    if (rest) out.push({ text: rest })
  }
  return out
}
