import type { Exact, Num, Rational } from '../api/types'

/** Exact rationals as BigInt pairs; only used for display simplification. */
export type Frac = { p: bigint; q: bigint }

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a
}

export function parseRational(s: Rational): Frac | null {
  const m = /^\s*([+-]?\d+)\s*(?:\/\s*([+-]?\d+))?\s*$/.exec(s)
  if (!m) return null
  let p = BigInt(m[1])
  let q = m[2] ? BigInt(m[2]) : 1n
  if (q === 0n) return null
  if (q < 0n) {
    p = -p
    q = -q
  }
  const g = gcd(p, q) || 1n
  return { p: p / g, q: q / g }
}

export function isValidRational(s: string): boolean {
  return parseRational(s) !== null
}

/** A positive rational, as the square of the weight of an edge must be. */
export function isPositiveRational(s: string): boolean {
  const f = parseRational(s)
  return f !== null && f.p > 0n && f.q > 0n
}

export function fracToString(f: Frac): string {
  return f.q === 1n ? f.p.toString() : `${f.p}/${f.q}`
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('negative')
  if (n < 2n) return n
  let x = BigInt(Math.floor(Math.sqrt(Number(n))))
  while (x * x > n) x -= 1n
  while ((x + 1n) * (x + 1n) <= n) x += 1n
  return x
}

/** n = a^2 * b with b square-free (trial division, capped for very large n). */
function squareFree(n: bigint): [bigint, bigint] {
  if (n < 0n) n = -n
  if (n > 1_000_000_000_000n) {
    const r = isqrt(n)
    return r * r === n ? [r, 1n] : [1n, n]
  }
  let a = 1n
  let b = 1n
  let m = n
  for (let d = 2n; d * d <= m; d += 1n) {
    let e = 0
    while (m % d === 0n) {
      m /= d
      e++
    }
    if (e > 0) {
      a *= d ** BigInt(e >> 1)
      if (e % 2 === 1) b *= d
    }
  }
  b *= m
  return [a, b]
}

export type Shown = { text: string; tex: string }

/** Display of sqrt(p/q) with the largest square factor pulled out of the radical. */
export function formatSqrt(r: Rational): Shown {
  const f = parseRational(r)
  if (!f) return { text: `√(${r})`, tex: `\\sqrt{${r}}` }
  if (f.p < 0n) return { text: `√(${fracToString(f)})`, tex: `\\sqrt{${fracToString(f)}}` }
  // sqrt(p/q) = sqrt(p q) / q
  const [a, b] = squareFree(f.p * f.q)
  // value = a * sqrt(b) / q
  const g = gcd(a, f.q)
  const num = a / g
  const den = f.q / g
  if (b === 1n) {
    const t = den === 1n ? num.toString() : `${num}/${den}`
    return { text: t, tex: den === 1n ? num.toString() : `\\tfrac{${num}}{${den}}` }
  }
  const coef = num === 1n ? '' : num.toString()
  const text = den === 1n ? `${coef}√${b}` : `${coef}√${b}/${den}`
  const tex = den === 1n ? `${coef}\\sqrt{${b}}` : `\\tfrac{${coef}\\sqrt{${b}}}{${den}}`
  return { text, tex }
}

export function formatRational(r: Rational): Shown {
  const f = parseRational(r)
  if (!f) return { text: r, tex: r }
  const text = fracToString(f)
  const tex = f.q === 1n ? f.p.toString() : `${f.p < 0n ? '-' : ''}\\tfrac{${f.p < 0n ? -f.p : f.p}}{${f.q}}`
  return { text, tex }
}

export function formatExact(e: Exact): Shown {
  if (typeof e === 'string') return formatRational(e)
  return formatSqrt(e.sqrt)
}

export function formatApprox(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return String(x)
  const s = x.toFixed(digits)
  return s.replace(/\.?0+$/, '') || '0'
}

/** Short exact text of a Num: the backend's `display`, else a short `exact`, else the approximation. */
export function numText(v: Num): string {
  if (v.display) return v.display
  if (v.exact && v.exact.length <= 12 && !/[A-Za-z]\(/.test(v.exact)) return v.exact
  return formatApprox(v.approx)
}

/** Float value of an exact rational string ("-93/16" → -5.8125); NaN when it is not a rational. */
export function rationalToNumber(s: Rational): number {
  const f = parseRational(s)
  if (!f) return Number.NaN
  return Number(f.p) / Number(f.q)
}

/** A rational string as a Num, so it can go to SpectrumBar and NumList. */
export function rationalNum(s: Rational): Num {
  const f = parseRational(s)
  const text = f ? fracToString(f) : s
  return { exact: text, approx: rationalToNumber(s), display: text }
}

/** Sorted by value. */
export function sortRationals(list: Rational[]): Rational[] {
  return [...list].sort((a, b) => rationalToNumber(a) - rationalToNumber(b))
}

/** Parses "0, 1, 3/2, -4" (commas, semicolons or spaces) into rational strings; null when some item is not a rational. */
export function parseRationalList(text: string): Rational[] | null {
  const items = text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (items.length === 0) return null
  const out: Rational[] = []
  for (const it of items) {
    const f = parseRational(it)
    if (!f) return null
    out.push(fracToString(f))
  }
  return out
}

/** TeX of a rational with its multiplicity as in the thesis: 3^{[2]}, {-93/16}^{[1]}. */
export function multiplicityTex(value: Rational, m: number): string {
  const f = parseRational(value)
  const t = f ? fracToString(f) : value
  return t.includes('/') ? `{${t}}^{[${m}]}` : `${t}^{[${m}]}`
}
