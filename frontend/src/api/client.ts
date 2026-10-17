import type {
  AdmissibleResponse,
  AlgorithmsResponse,
  AnalyzeResponse,
  BibEntry,
  CographRequest,
  CographResponse,
  CoupleRequest,
  Counts,
  FamilyRequest,
  FamilyResponse,
  DiagonalizeRequest,
  DiagonalizeResponse,
  FoldResponse,
  GalleryItem,
  GlossaryEntry,
  LabelsResponse,
  LatentRequest,
  LatentResponse,
  MacrosResponse,
  Matrix,
  Meta,
  NotationRow,
  PlaygroundGenerateRequest,
  PlaygroundGenerateResponse,
  PlaygroundSeed,
  PlaygroundState,
  PlaygroundStateRequest,
  Question,
  Rational,
  RootedSeed,
  SeedDetail,
  SeedSummary,
  StatementsResponse,
  StrongRealizationRequest,
  StrongRealizationResponse,
  ThresholdRequest,
  ThresholdResponse,
  TowerRequest,
  TowerResponse,
  TreeInfo,
  TreeInput,
  UnicyclicRequest,
  UnicyclicResponse,
} from './types'

export const API_BASE = '/api/v1'

export class ApiError extends Error {
  code: string
  status: number
  detail: string
  constructor(code: string, detail: string, status: number) {
    super(detail)
    this.name = 'ApiError'
    this.code = code
    this.detail = detail
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    })
  } catch {
    throw new ApiError('network', 'The server did not answer. Check the connection and try again in a moment.', 0)
  }
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }
  if (!res.ok) {
    if (body && typeof body === 'object' && 'code' in body && 'detail' in body) {
      const b = body as { code: string; detail: string }
      throw new ApiError(String(b.code), String(b.detail), res.status)
    }
    if (body && typeof body === 'object' && 'detail' in body) {
      const d = (body as { detail: unknown }).detail
      if (d && typeof d === 'object' && 'code' in d && 'detail' in d) {
        const e = d as { code: string; detail: string }
        throw new ApiError(String(e.code), String(e.detail), res.status)
      }
      if (Array.isArray(d)) {
        // FastAPI validation errors: [{loc, msg}, ...]
        const msgs = d.map((e) => {
          const item = e as { loc?: unknown[]; msg?: string }
          const where = Array.isArray(item.loc) ? item.loc.filter((x) => x !== 'body').join('.') : ''
          return where ? `${where}: ${item.msg ?? 'invalid'}` : String(item.msg ?? 'invalid')
        })
        throw new ApiError('validation', msgs.join('; '), res.status)
      }
      throw new ApiError('http_' + res.status, typeof d === 'string' ? d : JSON.stringify(d), res.status)
    }
    const hint = res.status >= 500 ? 'The server could not complete this request. Try again in a moment.' : res.statusText
    throw new ApiError('http_' + res.status, hint || 'Request failed', res.status)
  }
  if (body === null) throw new ApiError('bad_json', 'The backend returned an empty or non-JSON response.', res.status)
  return body as T
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  meta: () => get<Meta>('/meta'),
  parse: (tree: TreeInput) => post<TreeInfo>('/trees/parse', tree),
  fold: (tree: TreeInput) => post<FoldResponse>('/trees/fold', { tree }),
  analyze: (tree: TreeInput, matrix?: Matrix) => post<AnalyzeResponse>('/trees/analyze', matrix ? { tree, matrix } : { tree }),
  seeds: (d: number) => get<SeedSummary[]>(`/catalog/seeds?d=${d}`),
  seed: (name: string) => get<SeedDetail>(`/catalog/seeds/${encodeURIComponent(name)}`),
  rootedSeeds: (depth = 3) => get<RootedSeed[]>(`/catalog/rooted-seeds?depth=${depth}`),
  counts: () => get<Counts>('/catalog/counts'),
  algorithms: () => get<AlgorithmsResponse>('/algorithms'),
  gallery: () => get<GalleryItem[]>('/catalog/gallery'),
  diagonalize: (body: DiagonalizeRequest) => post<DiagonalizeResponse>('/diagonalize', body),
  latent: (body: LatentRequest) => post<LatentResponse>('/latent', body),
  bibliography: (keys: string[]) => get<BibEntry[]>(`/bibliography?keys=${encodeURIComponent(keys.join(','))}`),
  questions: () => get<Question[]>('/questions'),
  notation: () => get<NotationRow[]>('/notation'),

  // v2 (API_CONTRACT_v2.md)
  playgroundSeeds: (d: number) => get<PlaygroundSeed[]>(`/playground/seeds?d=${d}`),
  playgroundState: (body: PlaygroundStateRequest) => post<PlaygroundState>('/playground/state', body),
  playgroundGenerate: (body: PlaygroundGenerateRequest) => post<PlaygroundGenerateResponse>('/playground/generate', body),
  strongRealization: (body: StrongRealizationRequest) => post<StrongRealizationResponse>('/lab/strong-realization', body),
  family: (body: FamilyRequest) => post<FamilyResponse>('/lab/family', body),
  admissible: (set: Rational[]) => post<AdmissibleResponse>('/admissible', { set }),
  tower: (body: TowerRequest) => post<TowerResponse>('/lab/tower', body),
  unicyclic: (body: UnicyclicRequest) => post<UnicyclicResponse>('/graphs/unicyclic', body),
  couple: (body: CoupleRequest) => post<UnicyclicResponse>('/graphs/couple', body),
  threshold: (body: ThresholdRequest) => post<ThresholdResponse>('/graphs/threshold', body),
  cograph: (body: CographRequest) => post<CographResponse>('/graphs/cograph', body),
  labels: (keys: string[]) => get<LabelsResponse>(`/labels?keys=${encodeURIComponent(keys.join(','))}`),

  // thesis text for the tooltips
  glossary: () => get<GlossaryEntry[]>('/glossary'),
  statementsByRef: (refs: string[]) => get<StatementsResponse>(`/statements-by-ref?refs=${encodeURIComponent(refs.join(','))}`),
  macros: () => get<MacrosResponse>('/macros'),
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail
  if (err instanceof Error) return err.message
  return String(err)
}
