import type { ReactNode } from 'react'
import { Tex } from '../components/Tex'
import { Term } from '../components/ThesisTips'

/** What was known about the seeds of diameter 6, one entry per seed S_6^(i), i = 1, …, 12, in the numbering of the thesis. */
export type SeedState = 'unknown' | 'claimed' | 'diminimal' | 'defective'

/** The columns of the "what is known" strip: the proportion p_d of diminimal seeds by diameter, and the limit. */
export type Column = '4' | '5' | '6' | '7' | '8' | '9' | 'inf'
export const COLUMNS: { key: Column; label: string }[] = [
  { key: '4', label: 'd ≤ 4' },
  { key: '5', label: 'd = 5' },
  { key: '6', label: 'd = 6' },
  { key: '7', label: 'd = 7' },
  { key: '8', label: 'd = 8' },
  { key: '9', label: 'd = 9' },
  { key: 'inf', label: 'd → ∞' },
]

export type Step = {
  year: string
  title: string
  who: string
  /** our joint works: Allem, Hoppen, Sibemberg and coauthors */
  ours?: boolean
  status?: string
  cite: string[]
  body: ReactNode
  /** what this step changes in the panel; later steps keep it */
  seeds?: Partial<Record<number, SeedState>>
  pd?: Partial<Record<Column, string>>
  /** what is known about r_d, the number of diminimal seeds */
  rd?: Partial<Record<Column, string>>
  /** the number of seeds s_d, once counted */
  counts?: Partial<Record<Column, string>>
  /** the full reference of a work that is not in the bibliography of the thesis */
  reference?: string
  /** the grid under the table: the seeds of diameter 6, then the 78 seeds R_i ⊙ R_j of diameter 7 */
  grid?: 'd6' | 'd7'
  /** what is known about the seeds of diameter 7: the 21 of the 6 × 6 block, and the other 57 */
  seeds7?: { block?: SeedState; others?: SeedState }
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/**
 * The history of the question "which trees have q(T) = d(T) + 1?", told as in the introduction of the thesis
 * (dated chronology), up to our works on bricks, towers and defective seeds.
 */
export const STEPS: Step[] = [
  {
    year: '2002',
    title: 'The lower bound and a conjecture',
    who: 'Leal-Duarte and Johnson',
    cite: ['leal2002minimum'],
    body: (
      <>
        <p>
          Every matrix <Tex tex="M" /> whose graph is a tree <Tex tex="T" /> has at least <Tex tex="d(T)+1" /> distinct eigenvalues, because along a longest path the
          powers <Tex tex="I,M,\ldots,M^{d(T)}" /> are linearly independent: <Tex tex="q(T)\geq d(T)+1" />.
        </p>
        <p>Equality holds for paths and for every tree with at most seven vertices, and the authors suspected that it holds for every tree.</p>
      </>
    ),
  },
  {
    year: '2003',
    title: 'The conjecture holds for generalized stars',
    who: 'Johnson, Leal-Duarte and Saiago',
    cite: ['johnson2003inverse'],
    body: (
      <p>
        Their solution of the inverse eigenvalue problem for generalized stars, and their description of the ordered multiplicity lists of double generalized stars,
        imply that these trees attain the bound.
      </p>
    ),
  },
  {
    year: '2004',
    title: 'The conjecture is false',
    who: 'Barioli and Fallat',
    cite: ['barioli2004two'],
    body: (
      <>
        <p>
          A tree with sixteen vertices and diameter 6 has <Tex tex="q(T)=8=d(T)+2" />: no multiplicity list of length seven is compatible with its Parter vertices.
        </p>
        <p>
          In the language that came later, it is an <Term k="unfolding">unfolding</Term> of <Tex tex="S_6^{(11)}" />, the path with seven vertices, which is therefore
          a <Term k="defective seed">defective seed</Term>.
        </p>
      </>
    ),
    seeds: { 11: 'defective' },
    pd: { '6': '< 1' },
  },
  {
    year: '2008',
    title: 'Branch duplication',
    who: 'Johnson and Saiago',
    cite: ['JS08'],
    body: (
      <>
        <p>
          Duplicating a branch of a tree keeps the eigenvalues of a matrix and adds those of the branch. If the eigenvalues of every duplicated branch are already there,
          a matrix with <Tex tex="d+1" /> distinct eigenvalues passes to the larger tree.
        </p>
        <p>With this technique, every tree of diameter at most 4 is diminimal.</p>
      </>
    ),
    pd: { '4': '1' },
    rd: { '4': 'all' },
  },
  {
    year: '2009',
    title: 'The disparity can be arbitrarily large',
    who: 'Kim and Shader',
    cite: ['kim2009smith'],
    body: (
      <p>
        The <Tex tex="(3,\ell)" />-whirls, <Tex tex="\ell\geq2" />, satisfy <Tex tex="q(T)\geq\tfrac98\,d(T)+\tfrac12" />, so the disparity <Tex tex="q(T)-d(T)-1" /> is unbounded. The whirls are unfoldings of paths, so the path with{' '}
        <Tex tex="2\ell+3" /> vertices is a defective seed for every <Tex tex="\ell\geq2" />, and every even diameter <Tex tex="d\geq6" /> has a defective seed.
      </p>
    ),
    pd: { '8': '< 1' },
  },
  {
    year: '2016',
    title: 'Diameter minimal trees',
    who: 'Johnson and Saiago',
    cite: ['JSdiminimal'],
    body: (
      <>
        <p>
          Trees with <Tex tex="q(T)=d(T)+1" /> are named <Term k="diminimal">diminimal</Term>, and the question becomes which trees are diminimal. Every tree of
          diameter 5 is diminimal.
        </p>
        <p>
          In diameter 6, <Tex tex="S_6^{(10)}" /> and <Tex tex="S_6^{(12)}" /> get non-diminimal unfoldings, and the other nine seeds are claimed diminimal, with a
          sketch of the eigenvalues each branch should have. They also prove that every tree of diameter 6 has <Tex tex="q(T)\leq8" />, using the diminimality of
          three of these nine seeds.
        </p>
      </>
    ),
    seeds: { ...Object.fromEntries(range(1, 9).map((i) => [i, 'claimed'])), 10: 'defective', 12: 'defective' },
    pd: { '5': '1', '6': '9/12 claimed' },
    rd: { '5': 'all', '6': '9 claimed' },
  },
  {
    year: '2020',
    title: 'Counting the seeds',
    who: 'Johnson et al.',
    cite: ['JOHNSON2020'],
    body: (
      <p>
        Every tree of diameter <Tex tex="d" /> is an unfolding of a unique <Term k="seed">seed</Term>, and the seeds are finitely many: one in each diameter up to 3, then 2, 3,
        12, 78 in diameters 4 to 7, 65 520 in diameter 8 and 2 146 467 960 in diameter 9. The number of seeds grows without bound.
      </p>
    ),
    counts: { '4': '1, 1, 1, 2', '5': '3', '6': '12', '7': '78', '8': '65 520', '9': '2 146 467 960', inf: '→ ∞' },
  },
  {
    year: '2022',
    title: 'Linear trees',
    who: 'Johnson and Wakhare',
    cite: ['johnson2022inverse'],
    body: <p>The trees whose vertices of degree at least three lie on a common path are diminimal, as Johnson and Saiago had conjectured.</p>,
  },
  {
    year: '2023',
    title: 'Diminimal seeds in every diameter',
    who: 'Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan',
    ours: true,
    cite: ['allem2023diminimal'],
    body: (
      <p>
        Two diminimal seeds in every diameter <Tex tex="d\geq4" />, and a third in every odd diameter <Tex tex="d\geq5" />, with explicit realizations for every tree in
        their families. For the first time, diminimal seeds are known in every diameter.
      </p>
    ),
    rd: { '7': '≥ 3', '8': '≥ 2', '9': '≥ 3', inf: '≥ 2' },
  },
  {
    year: '2026',
    title: 'Diameter 6, settled',
    who: 'Allem, Hoppen and Sibemberg',
    ours: true,
    cite: ['allem2026minimum'],
    body: (
      <>
        <p>
          Three of the nine seeds claimed in 2016, <Tex tex="S_6^{(7)}" />, <Tex tex="S_6^{(8)}" /> and <Tex tex="S_6^{(9)}" />, are defective. Exactly six of the
          twelve seeds of diameter 6 are diminimal, the six whose diminimality goes back to Johnson and Saiago.
        </p>
        <p>
          The paper also completes the proof of Johnson and Saiago that every tree of diameter 6 has <Tex tex="q(T)\leq8" />, which relied on the diminimality of these
          three seeds, and the tree of Barioli and Fallat shows that the bound is attained. Its title counts the diameter in vertices, as Johnson and Saiago do, hence diameter seven.
        </p>
      </>
    ),
    seeds: { ...Object.fromEntries(range(1, 6).map((i) => [i, 'diminimal'])), 7: 'defective', 8: 'defective', 9: 'defective' },
    pd: { '6': '1/2' },
    rd: { '6': '6' },
  },
  {
    year: '2026',
    title: 'Bricks: unboundedly many diminimal seeds',
    who: 'Allem, Hoppen and Sibemberg',
    ours: true,
    status: 'in preparation',
    cite: [],
    reference: 'Manuscript in preparation, with the bricks of Chapter 6 of the thesis and its Theorems 6.1 and 6.4.',
    body: (
      <>
        <p>
          A <Term k="brick">brick</Term> is a matrix on a seed whose eigenvalue-location zeros guarantee that duplicating branches never adds an eigenvalue, so every
          unfolding inherits <Tex tex="d+1" /> distinct eigenvalues.
        </p>
        <p>
          For the seed <Tex tex="S_d" /> of every diameter, almost every set of <Tex tex="d+1" /> real numbers is the set of distinct eigenvalues of one of its
          realizations. In diameter 7, the 21 seeds built from the <Term k="rooted seed">rooted seeds</Term> of the six diminimal seeds of diameter 6 are
          diminimal.{' '}
          <Term k="tower">Towers</Term> over them, and over pairs <Tex tex="S_{2b-3},S_{2b-1}" />, give at least <Tex tex="21+(d-7)/2" /> diminimal seeds in odd
          diameter, and duplicating a branch at a main root gives at least <Tex tex="36+(d-8)/2" /> in even diameter, so <Tex tex="r_d\to\infty" />.
        </p>
      </>
    ),
    pd: { '7': '≥ 21/78' },
    rd: { '7': '≥ 21', '8': '≥ 36', '9': '≥ 22', inf: '→ ∞' },
    grid: 'd7',
    seeds7: { block: 'diminimal' },
  },
  {
    year: '2026',
    title: 'Almost all seeds are defective',
    who: 'Allem, Hoppen and Sibemberg',
    ours: true,
    status: 'in preparation',
    cite: [],
    reference: 'Manuscript in preparation, with the propagation theorems of Chapter 7 of the thesis and its Theorems 7.16 and 7.17.',
    body: (
      <>
        <p>
          A defective rooted seed propagates: a seed built on it is defective. Counting the seeds through their rooted seeds turns this into a recursion, and the
          proportion of defective seeds of diameter <Tex tex="d" /> tends to one.
        </p>
        <p>
          Already <Tex tex="p_8\leq1/65" /> and <Tex tex="p_9<2^{-12}" />, and <Tex tex="p_d\to0" />: diminimal seeds are unboundedly many and yet rare.
          By the propagation theorem, the 57 seeds of diameter 7 with a defective rooted seed are defective, and with the 21 bricks, <Tex tex="p_7=21/78" />.
        </p>
      </>
    ),
    pd: { '7': '21/78', '8': '≤ 1/65', '9': '< 1/4096', inf: '→ 0' },
    seeds7: { others: 'defective' },
    rd: { '7': '21' },
  },
]

/** The state of knowledge after the steps 0, …, i. */
export function knownAt(i: number) {
  const seeds: Record<number, SeedState> = Object.fromEntries(range(1, 12).map((k) => [k, 'unknown']))
  const pd: Record<Column, string> = { '4': '?', '5': '?', '6': '?', '7': '?', '8': '?', '9': '?', inf: '?' }
  const rd: Record<Column, string> = { '4': '?', '5': '?', '6': '?', '7': '?', '8': '?', '9': '?', inf: '?' }
  const counts: Partial<Record<Column, string>> = {}
  let grid: 'd6' | 'd7' = 'd6'
  const seeds7: { block: SeedState; others: SeedState } = { block: 'unknown', others: 'unknown' }
  for (const s of STEPS.slice(0, i + 1)) {
    Object.assign(seeds, s.seeds ?? {})
    Object.assign(pd, s.pd ?? {})
    Object.assign(rd, s.rd ?? {})
    Object.assign(counts, s.counts ?? {})
    Object.assign(seeds7, s.seeds7 ?? {})
    if (s.grid) grid = s.grid
  }
  return { seeds, pd, rd, counts, grid, seeds7 }
}
