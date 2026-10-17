import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { api } from './client'
import type {
  CographRequest,
  GlossaryEntry,
  ThesisStatement,
  CoupleRequest,
  DiagonalizeRequest,
  FamilyRequest,
  LatentRequest,
  Matrix,
  PlaygroundGenerateRequest,
  PlaygroundStateRequest,
  Rational,
  StrongRealizationRequest,
  ThresholdRequest,
  TowerRequest,
  TreeInput,
  UnicyclicRequest,
} from './types'

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: api.meta })

export const useAnalyze = (input: TreeInput | null, matrix?: Matrix) =>
  useQuery({
    queryKey: ['analyze', input, matrix ?? null],
    queryFn: () => api.analyze(input!, matrix),
    enabled: input !== null,
  })

export const useParse = () => useMutation({ mutationFn: (input: TreeInput) => api.parse(input) })

export const useSeeds = (d: number) => useQuery({ queryKey: ['seeds', d], queryFn: () => api.seeds(d) })

export const useSeed = (name: string | null) =>
  useQuery({ queryKey: ['seed', name], queryFn: () => api.seed(name!), enabled: name !== null })

export const useRootedSeeds = (depth = 3) =>
  useQuery({ queryKey: ['rooted-seeds', depth], queryFn: () => api.rootedSeeds(depth) })

export const useCounts = () => useQuery({ queryKey: ['counts'], queryFn: api.counts })
export const useAlgorithms = () => useQuery({ queryKey: ['algorithms'], queryFn: api.algorithms, staleTime: Infinity })

export const useGallery = () => useQuery({ queryKey: ['gallery'], queryFn: api.gallery })

export const useDiagonalize = () => useMutation({ mutationFn: (body: DiagonalizeRequest) => api.diagonalize(body) })

export const useLatent = () => useMutation({ mutationFn: (body: LatentRequest) => api.latent(body) })

export const useBibliography = (keys: string[]) => {
  const sorted = Array.from(new Set(keys)).sort()
  return useQuery({
    queryKey: ['bibliography', sorted],
    queryFn: () => api.bibliography(sorted),
    enabled: sorted.length > 0,
  })
}

/** One bibliography entry (chips). Identical keys are deduplicated by React Query. */
export const useBibEntry = (key: string) =>
  useQuery({
    queryKey: ['bib-entry', key],
    queryFn: async () => {
      const list = await api.bibliography([key])
      return list.find((e) => e.key === key) ?? list[0] ?? null
    },
    staleTime: Infinity,
  })

export const useQuestions = () => useQuery({ queryKey: ['questions'], queryFn: api.questions })

export const useNotation = () => useQuery({ queryKey: ['notation'], queryFn: api.notation, staleTime: Infinity, gcTime: Infinity })

// --- v2 ---------------------------------------------------------------------------------------------------------

export const usePlaygroundSeeds = (d: number | null) =>
  useQuery({ queryKey: ['playground-seeds', d], queryFn: () => api.playgroundSeeds(d!), enabled: d !== null })

/** The seed after the duplications; the previous state stays on screen while the next one loads. */
export const usePlaygroundState = (body: PlaygroundStateRequest | null) =>
  useQuery({
    queryKey: ['playground-state', body],
    queryFn: () => api.playgroundState(body!),
    enabled: body !== null,
    placeholderData: keepPreviousData,
  })

export const usePlaygroundGenerate = () => useMutation({ mutationFn: (body: PlaygroundGenerateRequest) => api.playgroundGenerate(body) })

export const useStrongRealization = (body: StrongRealizationRequest | null) =>
  useQuery({ queryKey: ['strong-realization', body], queryFn: () => api.strongRealization(body!), enabled: body !== null })

export const useFamily = () => useMutation({ mutationFn: (body: FamilyRequest) => api.family(body) })

export const useAdmissible = (set: Rational[] | null) =>
  useQuery({ queryKey: ['admissible', set], queryFn: () => api.admissible(set!), enabled: set !== null })

export const useTower = (body: TowerRequest | null) =>
  useQuery({ queryKey: ['tower', body], queryFn: () => api.tower(body!), enabled: body !== null, placeholderData: keepPreviousData })

export const useUnicyclic = (body: UnicyclicRequest | null) =>
  useQuery({ queryKey: ['unicyclic', body], queryFn: () => api.unicyclic(body!), enabled: body !== null })

export const useCouple = () => useMutation({ mutationFn: (body: CoupleRequest) => api.couple(body) })

export const useThreshold = (body: ThresholdRequest | null) =>
  useQuery({ queryKey: ['threshold', body], queryFn: () => api.threshold(body!), enabled: body !== null, placeholderData: keepPreviousData })

export const useCograph = (body: CographRequest | null) =>
  useQuery({ queryKey: ['cograph', body], queryFn: () => api.cograph(body!), enabled: body !== null })

/** Numbers of thesis labels ("thm:C" → "Theorem 6.2"); one request per sorted key set. */
export const useLabels = (keys: string[]) => {
  const sorted = Array.from(new Set(keys)).sort()
  return useQuery({ queryKey: ['labels', sorted], queryFn: () => api.labels(sorted), enabled: sorted.length > 0, staleTime: Infinity })
}

/** POST /trees/parse as a query (drawings that never change, such as the gallery S_d). */
export const useParsed = (input: TreeInput | null) =>
  useQuery({ queryKey: ['parse', input], queryFn: () => api.parse(input!), enabled: input !== null, staleTime: Infinity })


// --- Thesis text for the tooltips: glossary, statements, macros (fetched once, cached for the session) -----------

export type GlossaryIndex = Record<string, GlossaryEntry>

/** Closes a display formula left open by the sentence extraction ("… \\[ d(G)=\\max…." without "\\]"). */
function closeDisplay(text: string): string {
  const open = (text.match(/\\\[/g) ?? []).length
  const close = (text.match(/\\\]/g) ?? []).length
  return open > close ? text.replace(/\.?\s*$/, '') + ' \\]' : text
}

function indexGlossary(list: GlossaryEntry[]): GlossaryIndex {
  const out: GlossaryIndex = {}
  for (const e of list) out[e.key.toLowerCase()] = { ...e, text: closeDisplay(e.text) }
  return out
}

/** Every term defined in the thesis, indexed by lower-case key. */
export const useGlossary = () =>
  useQuery({ queryKey: ['glossary'], queryFn: async () => indexGlossary(await api.glossary()), staleTime: Infinity, gcTime: Infinity })

/** A glossary entry by key, case-insensitively, following `alias_of`, and trying the singular or plural form. */
export function lookupGlossary(index: GlossaryIndex | undefined, key: string): GlossaryEntry | null {
  if (!index) return null
  const k = key.trim().toLowerCase()
  const e = index[k] ?? index[k + 's'] ?? (k.endsWith('s') ? index[k.slice(0, -1)] : undefined)
  if (!e) return null
  if (e.alias_of) return index[e.alias_of.toLowerCase()] ?? e
  return e
}

/** The printed references that name a numbered statement of the thesis ("Section 3.3", "Algorithm 1" are not). */
const STATEMENT_REF = /^(Theorem|Lemma|Proposition|Corollary|Definition|Remark|Question|Example|Conjecture) \d+(\.\d+)*$/

export function isStatementRef(ref: string): boolean {
  return STATEMENT_REF.test(ref.trim())
}

// Statements are fetched by batches: every lookup made in the same tick (all the chips of a page) goes into one
// GET /statements-by-ref, and each result is cached per reference by React Query.
type Waiter = { resolve: (s: ThesisStatement | null) => void; reject: (e: unknown) => void }
let queue = new Map<string, Waiter[]>()
let timer: number | null = null

function flushStatements() {
  const batch = queue
  queue = new Map()
  timer = null
  const refs = Array.from(batch.keys())
  api.statementsByRef(refs).then(
    (r) => {
      for (const [ref, ws] of batch) for (const w of ws) w.resolve(r[ref] ?? null)
    },
    (err) => {
      for (const ws of batch.values()) for (const w of ws) w.reject(err)
    },
  )
}

function loadStatement(ref: string): Promise<ThesisStatement | null> {
  return new Promise((resolve, reject) => {
    const list = queue.get(ref) ?? []
    list.push({ resolve, reject })
    queue.set(ref, list)
    if (timer === null) timer = window.setTimeout(flushStatements, 15)
  })
}

/** The statement printed as `ref` ("Theorem 6.12"), or null when the thesis has no such numbered statement. */
export const useStatement = (ref: string | null | undefined) => {
  const r = (ref ?? '').trim()
  return useQuery({
    queryKey: ['statement', r],
    queryFn: () => loadStatement(r),
    enabled: r !== '' && isStatementRef(r),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/** The thesis macros for KaTeX (\\DSpec, \\tL, \\lmin{j}, …). */
export const useMacros = () => useQuery({ queryKey: ['macros'], queryFn: api.macros, staleTime: Infinity, gcTime: Infinity })
