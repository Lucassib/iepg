// Types copied from iepg_app/API_CONTRACT.md (v1). Keep in sync with the backend.

export type Rational = string // "3", "-1/2"
export type Exact = Rational | { sqrt: Rational } // off-diagonal entries are square roots
export type Num = { exact: string; approx: number; display?: string } // exact expression (sympy srepr/str) + float; `display` is a short exact text when the backend provides one

export type TreeFormat = 'edges' | 'adjacency' | 'parents' | 'prufer' | 'parentheses' | 'graph6' | 'catalog'

export type TreeInput =
  | { format: TreeFormat; data: string }
  | { format: 'gallery'; data: string; params?: Record<string, number> } // data = gallery id
  | { canonical: string }

export type Layout = Record<string, [number, number]> // vertex id -> (x, y); y grows downward

export type TreeKind = 'path' | 'star' | 'generalized_star' | 'double_generalized_star' | 'caterpillar' | 'other'

export type TreeInfo = {
  canonical: string
  n: number
  diameter: number // in edges
  edges: [number, number][]
  center: { type: 'vertex' | 'edge'; vertices: number[] }
  main_roots: number[]
  linear: boolean
  kind: TreeKind
  is_seed: boolean
  layout: Layout
  dashed_edges?: [number, number][]
}

export type Matrix = {
  diag: Record<string, Rational> // vertex id -> diagonal entry
  w2: Record<string, Rational> // "u-v" (u<v) -> square of the off-diagonal entry
}

export type SeedStatus = 'diminimal' | 'defective' | 'unknown'

export type CertificateKind = 'brick' | 'non_diminimal_unfolding' | 'propagation' | 'literature' | 'theorem' | 'none'

export type Certificate = {
  kind: CertificateKind
  summary: string
  references: string[]
  thesis: string[]
  brick?: { matrix: Matrix; root: number; other_main_root?: number; dspec: Num[]; latent: Num[]; confined: Num[] }
  unfolding?: { tree: TreeInfo; q_lower: number; reason: string }
  chain?: { steps: string[] }
}

export type Meta = { version: string; thesis_version: string; catalog_hash: string }

export type FoldStep = { tree: TreeInfo; removed_branch: number[]; at_vertex: number; isomorphic_to: number[] }

export type FoldResponse = { seed: TreeInfo; seed_name: string | null; steps: FoldStep[] }

export type Sourced = { value: number; source: string; references: string[]; thesis: string[] }

export type AnalyzeResponse = {
  tree: TreeInfo
  seed: TreeInfo
  seed_name: string | null // "S6_3", "R2xR5", "S_9", or null when not in the catalog
  seed_label?: string | null // display TeX of the seed name, when in the catalog
  fold_steps: FoldStep[]
  seed_status: SeedStatus
  seed_certificate: Certificate
  q_lower: Sourced
  q_upper: Sourced | null
  q_exact: Sourced | null
  /** exact: q(M) = q(T); upper: a matrix that gives the upper bound */
  realization: { matrix: Matrix; root: number; dspec: Num[]; source: string; kind: 'exact' | 'upper' } | null
  notes: string[]
  references: string[]
}

export type SeedSummary = {
  name: string // URL id ("S6_3", "R2xR5")
  label: string // display TeX ("S_6^{(3)}", "R_2 \\odot R_5")
  canonical: string
  status: SeedStatus
  tree: TreeInfo
}

export type SeedDetail = SeedSummary & {
  certificate: Certificate
  history: string
  references: string[]
  rooted_seed?: string
  pair?: [string, string]
}

export type RootedSeed = {
  name: string // "R1".."R12"
  label: string
  canonical: string
  good: boolean
  seed_name: string
  tree: TreeInfo
  root: number
  deleted_branch: number[]
}

export type Counts = {
  E: Record<string, string>
  s: Record<string, string>
  bounds: { d: number | string; p_upper?: string; p?: string; p_limit?: string; source: string }[]
}

export type GalleryParam = { name: string; min: number; max: number; default: number }

export type GalleryItem = { id: string; name: string; description: string; params: GalleryParam[]; references: string[] }

export type DiagonalizeRequest = { tree: TreeInput; root: number; matrix: Matrix; lam: Rational }

export type DiagonalizeStep = {
  k: number
  vertex: number
  line: 3 | 5 | 8
  hat_d: Rational
  final_d: Rational
  consumed_child: number | null
  cut_edge: [number, number] | null
  d_after: Record<string, Rational>
}

export type DiagonalizeResponse = {
  order: number[]
  steps: DiagonalizeStep[]
  final: Record<string, Rational>
  temporary_zeros: number[]
  zeros: number
  positives: number
  negatives: number
  in_Z: boolean
}

export type LatentRequest = { tree: TreeInput; root: number; matrix: Matrix }

export type LatentResponse = {
  dspec: Num[]
  Z: Num[]
  latent: Num[]
  confined: Num[]
  is_brick: boolean
  bound: number
  witnesses: Record<string, number[]>
  q_M: number
}

export type BibEntry = {
  key: string
  formatted: string
  authors: string
  title: string
  venue: string
  year: string
  doi?: string
  arxiv?: string
  url?: string
  bibtex: string
  short?: string // "Johnson and Saiago 2016"
}

export type Question = { id: string; statement: string; evidence: string; references: string[]; thesis: string[] }

export type NotationRow = { symbol: string; meaning: string; where: string }

export type ApiErrorBody = { code: string; detail: string }

// ---------------------------------------------------------------------------------------------------------------
// v2 (API_CONTRACT_v2.md). Field by field from iepg_app/api_samples/*.json; where the backend was observed to send
// a variant the samples do not show, the variant is noted in a comment.

/** A drawing of a general graph (non-tree): ids 0..n-1, layout y downward. */
export type Graph = { n: number; edges: [number, number][]; layout: Layout }

/** One distinct eigenvalue and its multiplicity. `value` is an exact rational string. */
export type SpectrumEntry = { value: Rational; multiplicity: number }

/** The step φ((X, x), (Y, y), λ) that joins two rooted matrices by a new edge of squared weight w2 = dx·dy. */
export type PhiStep = {
  lam: Rational
  dx: Rational
  dy: Rational
  w2: Rational
  edge: [number, number]
  left: number[] // ids of the first (lateral) copy
  right: number[] // ids of the second (interior) copy
}

/** Brick test of a matrix, as returned by the lab endpoints. */
export type Verification = {
  ok: boolean
  dspec: Rational[]
  multiplicities: Record<string, number>
  Z: Rational[]
  latent: Rational[]
  confined: Rational[]
  witnesses: Record<string, number[]>
  is_brick: boolean
  q: number
  reason: string
}

// --- Playground -------------------------------------------------------------------------------------------------

export type PlaygroundParam = {
  name: string
  kind: 'int' | 'set'
  default: number | number[]
  text: string
}

export type PlaygroundSeed = {
  id: string // "S_7", "S6_3", "T_2_5", "B_4"
  label: string // TeX
  family: string // "S_d", "diameter 6", "towers over R_i, R_j", "towers over S_d"
  d: number
  params: PlaygroundParam[]
  note: string
  tree: TreeInfo
  n: number
}

/** One duplication: the branch rooted at u, seen from the root, is duplicated at its parent y. */
export type PlaygroundOp = [number, number] // [y, u]

export type PlaygroundStateRequest = { seed: string; d: number; ops: PlaygroundOp[] }

export type PlaygroundState = {
  tree: TreeInfo // dashed_edges = the edges created by the duplications
  root: number
  main_roots: number[]
  duplicable: Record<string, number> // u -> y
  n: number
  d: number
  seed_n: number
  ops: PlaygroundOp[]
}

export type PlaygroundParamValue = number | Rational | Rational[]

export type PlaygroundGenerateRequest = PlaygroundStateRequest & { params?: Record<string, PlaygroundParamValue> }

export type PlaygroundBrick = {
  tree: TreeInfo
  matrix: Matrix
  root: number
  other_main_roots: number[]
  spectrum: SpectrumEntry[]
  latent: Rational[]
  confined: Rational[]
  witnesses: Record<string, number[]>
  is_brick: boolean
  reason: string
}

export type PlaygroundRealization = {
  tree: TreeInfo
  matrix: Matrix
  root: number
  n: number
  spectrum: SpectrumEntry[]
  q: number
  check: string
}

export type Condition = { name: string; text: string; ok: boolean }

/** One list for a seed built from one rooted seed (d = 6), two lists for a pair of towers. */
export type ConditionList = Condition[] | { first: Condition[]; second: Condition[] }

/** Free-form construction data; the keys depend on the family (towers: kind, a, b, k, first, second, Lambda, e, c, Z, phi). */
export type PlaygroundInfo = {
  kind?: string
  a?: number
  b?: number | null
  k?: number
  even?: boolean
  first?: string
  second?: string
  Lambda?: Rational[]
  e?: Rational
  c?: Rational
  Z?: Rational[]
  phi?: PhiStep
  method?: string
  fail?: string
  conditions?: ConditionList | null
}

export type PlaygroundGenerateOk = {
  ok: true
  method: string
  prescribed: Rational[]
  seed: PlaygroundBrick
  tree: PlaygroundRealization
  duplications: number
  theorems: string[]
  references: string[]
  info: PlaygroundInfo
}

export type PlaygroundGenerateFail = {
  ok: false
  reason: string
  conditions?: ConditionList | null // observed: absent, null, [] or a list
  info: PlaygroundInfo
}

export type PlaygroundGenerateResponse = PlaygroundGenerateOk | PlaygroundGenerateFail

// --- Laboratory -------------------------------------------------------------------------------------------------

export type StrongRealizationRequest =
  | { k: number; alpha: Rational; beta: Rational; even?: boolean } // alpha, beta must be strings
  | { set: Rational[]; even?: boolean }

/** A node of the StrongRealization recursion. Failing nodes have no tree, matrix nor phi. */
export type TraceNode = {
  k: number
  set: Rational[]
  ok: boolean
  gammaL: Rational | null
  gammaR: Rational | null
  choice: '+' | '-' | null
  mu: Rational | null
  fail: string
  phi: PhiStep | null
  n: number | null
  tree?: TreeInfo
  matrix?: Matrix
  lateral: TraceNode | null
  interior: TraceNode | null
}

export type StrongRealizationResponse = {
  k: number
  set: Rational[]
  ok: boolean
  fail: string
  trace: TraceNode
  verification?: Verification // absent when ok is false
  tree?: TreeInfo
  matrix?: Matrix
  even?: { tree: TreeInfo; matrix: Matrix; verification: Verification }
  theorems: string[]
}

export type FamilyRequest = { k: number; alpha: Rational; beta?: Rational; delta?: Rational[] }

export type FamilyResponse = {
  alpha: Rational
  beta: Rational
  delta: Rational[]
  family: { j: number; Lambda: Rational[]; Lambda1: Rational[]; Lambda2: Rational[] }[]
}

export type AdmissibleNode = {
  set: Rational[]
  k: number
  tested: boolean
  ok: boolean
  gammaL: Rational | null
  gammaR: Rational | null
  choice: '+' | '-' | null
  mu: Rational | null
  children: { role: 'interior' | 'lateral'; node: AdmissibleNode }[]
  alternative: Rational[] | null // the lateral set not taken
  fail: string
}

/** Observed (not in the sample): a set with an even number of distinct values comes back as this short node. */
export type AdmissibleInvalid = { set: Rational[]; ok: false; fail: string }

export type AdmissibleResponse = { admissible: boolean; tree: AdmissibleNode | AdmissibleInvalid; theorems: string[] }

export type TowerCopy = { base: number; label: string; set: Rational[]; vertices: number[]; root: number }

export type TowerSeam = { a: number; b: number; level: number } // copy indices

export type TowerLevel = {
  j: number
  A: Rational[]
  n: number
  label: string // "P_3", "R_2", "H_5", "S_7"
  built_from: [number, number] | null
  blocks: { left: number[]; right: number[] } | null
  phi: PhiStep | null
  ok: boolean
  copies: TowerCopy[]
  seams: TowerSeam[]
  block_layout: Layout // copy index -> (x, y)
  draw: boolean
  tree?: TreeInfo | null // absent when draw is false
  matrix?: Matrix | null // absent for the largest levels
  origin: string[] // per vertex, "baseLevel:copyIndex"
}

export type Tower = { name: string; ok: boolean; fail: string; levels: TowerLevel[] }

export type TowerRequest =
  | { pair: [number, number]; k: number; even?: boolean; Lambda?: Rational[]; lambda7?: Rational }
  | { b: number; k: number; even?: boolean }

export type TowerResponse = {
  k: number
  towers: Tower[]
  seed: { d: number; n: number; draw: boolean; tree?: TreeInfo; matrix?: Matrix; verification: Verification; method: string }
  fail: string
  count: { odd: number; even: number; text: string }
  theorems: string[]
}

// --- Other classes of graphs ------------------------------------------------------------------------------------

export type BoundItem = { value: number; text: string; references: string[]; source: string }

export type UnicyclicKind = 'cycle' | 'tadpole' | 'sunlet' | 'unicyclic'

export type UnicyclicRequest = { n: number; edges: [number, number][] }

export type UnicyclicResponse = {
  graph: Graph
  kind: UnicyclicKind
  params: Record<string, number> // cycle {n}, tadpole {k, n}, sunlet {n, l}, unicyclic {}
  cycle: number[]
  girth: number
  pendant: Record<string, number[]>
  lower: BoundItem[]
  lower_value: number
  upper: BoundItem
  exact: BoundItem | null
  references: string[]
}

export type CoupleRequest = { tree: TreeInput; attach: number; k: number; mode: 'one' | 'all' }

export type ClassVerification = { product_is_zero: boolean; spectrum: SpectrumEntry[]; q: number }

export type ThresholdRequest = { sequence: string; lam: Rational }

export type ThresholdResponse = {
  graph: Graph
  sequence: string
  blocks: number[]
  matrix: string[][] // exact entries such as "1/2√2 - √3"
  matrix_approx: number[][]
  lam: Rational
  verification: ClassVerification
  lower: BoundItem[]
  lower_value: number
  upper: BoundItem
  exact: BoundItem | null
  references: string[]
}

export type CographExpr = { op: 'v' } | { op: 'union' | 'join'; children: CographExpr[] }

export type Cotree = { op: 'v'; vertex: number } | { op: 'union' | 'join'; children: Cotree[] }

export type TwinStep = { added: number; twin_of: number; kind: 'true' | 'false'; case: number; new_eigenvalue: Rational }

export type CographRequest = { expr: CographExpr; lam: Rational }

export type CographResponse = {
  graph: Graph
  cotree: Cotree
  twin_steps: TwinStep[]
  spectrum_by_construction: Record<string, number>
  matrix: string[][]
  matrix_approx: number[][]
  lam: Rational
  verification: ClassVerification
  lower: BoundItem[]
  lower_value: number
  upper: BoundItem
  exact: BoundItem | null
  references: string[]
}

/** GET /labels?keys=a,b: the numbers of the current compilation of the thesis ("prop:generic" → "Proposition 6.20"). */
export type ThesisLabel = { number: string | null; ref: string }
export type LabelsResponse = Record<string, ThesisLabel>

// --- Thesis text (tooltips) -------------------------------------------------------------------------------------

/** GET /glossary: a term of the thesis with the definition or the sentence that introduces it (prose with $...$). */
export type GlossaryEntry = {
  key: string
  term: string
  text: string
  ref: string // "Definition 6.9", "Section 3.3"
  label: string
  source: 'definition' | 'text'
  alias_of?: string
}

/** A numbered statement of the thesis, word for word (GET /statements-by-ref, GET /statements). */
export type ThesisStatement = {
  label: string
  kind: string
  number: string
  ref: string // "Theorem 6.12"
  title: string | null
  text: string
  chapter: string | null
}

export type StatementsResponse = Record<string, ThesisStatement | null>

/** GET /macros: the thesis macros in KaTeX form ("\\DSpec" → "\\operatorname{DSpec}"). */
export type MacrosResponse = Record<string, string>

/** GET /algorithms: the pseudocode of the thesis, read from its sources, next to the Python that runs it. */
export type PseudoPart = { t: 'text' | 'kw' | 'code' | 'math' | 'pad'; v: string }
export type PseudoLine = { n: string | null; kind: 'title' | 'head' | 'blank' | 'step' | 'cont'; indent: number; parts: PseudoPart[] }
export type PythonSource = { name: string; path: string; start: number; end: number; code: string; url: string }
export type AlgorithmLink = { to: string; label: string } | null
export type ThesisAlgorithm = { id: string; name: string; about: string; where: string | null; lines: PseudoLine[]; python: PythonSource[]; lab: AlgorithmLink }
export type SiteComputation = { id: string; name: string; about: string; thesis: string[]; python: PythonSource[]; lab: AlgorithmLink }
export type AlgorithmsResponse = { thesis: ThesisAlgorithm[]; site: SiteComputation[]; repository: string; commit: string }
