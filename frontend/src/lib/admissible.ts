/**
 * Definition def:admissible on the client, in exact integer arithmetic (BigInt), ported from the backend
 * (`realize.admissible`): for a sorted list S of 2m+1 distinct values, S is admissible if m ≤ 1; otherwise the outer
 * gaps γL = S[1] − S[0] and γR = S[2m] − S[2m−1] must differ, the interior S[1..2m−1] must be admissible, and so must
 * the lateral set: S[2..2m−1] followed by μ+ = S[0] + S[2m] − S[1] when γR > γL, and μ− = S[0] + S[2m] − S[2m−1]
 * followed by S[1..2m−2] otherwise.
 *
 * Returns null when S is admissible, and otherwise the tuple of the recursion whose first and last gaps coincide.
 */
export function nonAdmissibleWitness(S: bigint[]): bigint[] | null {
  const m = (S.length - 1) / 2
  if (m <= 1) return null
  const top = 2 * m
  const gL = S[1] - S[0]
  const gR = S[top] - S[top - 1]
  if (gL === gR) return S
  const inner = nonAdmissibleWitness(S.slice(1, top))
  if (inner) return inner
  const lateral = gR > gL ? [...S.slice(2, top), S[0] + S[top] - S[1]] : [S[0] + S[top] - S[top - 1], ...S.slice(1, top - 1)]
  return nonAdmissibleWitness(lateral)
}

export type SampleMode = 'real' | 'small'

const TWO32 = 4294967296n
const HI_MASK = (1 << 21) - 1 // 21 + 32 = 53 bits

/** Fills `buf` with cryptographic random 32-bit words (in chunks of 16384, the Web Crypto limit). */
function fillRandom(buf: Uint32Array<ArrayBuffer>) {
  for (let i = 0; i < buf.length; i += 16384) crypto.getRandomValues(buf.subarray(i, Math.min(buf.length, i + 16384)))
}

/**
 * A generator of sorted random sets of `size` distinct values: uniform integers in [0, 2^53) ("real numbers", an exact
 * lattice in a huge box standing for random reals) or a uniform `size`-subset of {0, …, 30} ("small integers").
 */
export function makeSampler(size: number, mode: SampleMode) {
  const perSet = mode === 'real' ? 2 * size : 31
  const batch = 512
  const buf = new Uint32Array(perSet * batch)
  let at = buf.length
  const next = () => {
    if (at >= buf.length) {
      fillRandom(buf)
      at = 0
    }
    return buf[at++]
  }
  const pool = Array.from({ length: 31 }, (_, i) => i)
  return (): bigint[] => {
    if (mode === 'small') {
      // partial Fisher–Yates on 0..30
      for (let i = 0; i < size; i++) {
        const j = i + (next() % (31 - i))
        const t = pool[i]
        pool[i] = pool[j]
        pool[j] = t
      }
      return pool
        .slice(0, size)
        .sort((a, b) => a - b)
        .map((v) => BigInt(v))
    }
    for (;;) {
      const out: bigint[] = []
      for (let i = 0; i < size; i++) out.push(BigInt(next() & HI_MASK) * TWO32 + BigInt(next()))
      out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      let distinct = true
      for (let i = 1; i < size; i++) if (out[i] === out[i - 1]) distinct = false
      if (distinct) return out
    }
  }
}
