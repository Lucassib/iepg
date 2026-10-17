import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { TreeFormat, TreeInput as TreeInputBody } from '../api/types'
import { api } from '../api/client'
import { useAnalyze, useUnicyclic } from '../api/hooks'
import { TreeInput, type InputTab } from '../components/TreeInput'
import { Section } from '../components/Section'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { GrowEditor } from '../components/analyze/GrowEditor'
import { TreeResult } from '../components/analyze/TreeResult'
import { UnicyclicResult } from '../components/UnicyclicResult'
import { Segmented } from '../components/ui/segmented'
import { Term } from '../components/ThesisTips'
import { useDebounced } from '../lib/useDebounced'
import { ONE_VERTEX, decode, edgesText, encode, fromEdges, hasCycle, path, star, type Grown } from '../lib/growGraph'

const TAB_VALUES: InputTab[] = ['edges', 'adjacency', 'parents', 'prufer', 'parentheses', 'graph6', 'catalog', 'gallery']

/** A tree given in the address by another page: /tree/:canonical, or /analyze?format=…&data=… */
function externalInput(canonical: string | undefined, search: URLSearchParams): TreeInputBody | null {
  if (canonical) return { canonical }
  const f = search.get('format')
  const d = search.get('data')
  if (!f || !d || !(TAB_VALUES as string[]).includes(f)) return null
  if (f === 'gallery') {
    let params: Record<string, number> | undefined
    try {
      params = search.get('params') ? (JSON.parse(search.get('params')!) as Record<string, number>) : undefined
    } catch {
      params = undefined
    }
    return { format: 'gallery', data: d, params }
  }
  return { format: f as TreeFormat, data: d }
}

// ---- undo and redo -----------------------------------------------------------------------------------------------

type History = { past: Grown[]; present: Grown; future: Grown[] }
type Action = { type: 'set'; g: Grown } | { type: 'undo' } | { type: 'redo' }

function reducer(h: History, a: Action): History {
  if (a.type === 'set') return { past: [...h.past, h.present].slice(-200), present: a.g, future: [] }
  if (a.type === 'undo' && h.past.length) return { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] }
  if (a.type === 'redo' && h.future.length) return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
  return h
}

const isField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function AnalyzePage() {
  const params = useParams<{ canonical?: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [hist, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: decode(search.get('g'), search.get('c')) ?? ONE_VERTEX,
    future: [],
  }))
  const graph = hist.present
  const [origin, setOrigin] = useState(() => (search.get('g') ? 'address' : 'start'))
  const setGraph = useCallback((g: Grown, from = 'draw') => {
    dispatch({ type: 'set', g })
    setOrigin(from)
  }, [])
  const [tab, setTab] = useState<'draw' | 'type'>('draw')
  const [loadError, setLoadError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  // a tree read by the backend (typed in any format, a catalog name, a permalink) becomes the drawing
  const load = useCallback(
    async (input: TreeInputBody) => {
      setLoading(true)
      setLoadError(null)
      try {
        const info = await api.parse(input)
        setGraph(fromEdges(info.n, info.edges), 'format' in input && input.format === 'catalog' ? input.data : 'typed')
        return true
      } catch (e) {
        setLoadError(e)
        return false
      } finally {
        setLoading(false)
      }
    },
    [setGraph],
  )

  // a tree in the address, from the header search, a permalink or another page
  const ext = useMemo(() => externalInput(params.canonical, search), [params.canonical, search])
  const extKey = ext ? JSON.stringify(ext) : null
  const loadedKey = useRef<string | null>(null)
  useEffect(() => {
    if (!ext || extKey === loadedKey.current) return
    loadedKey.current = extKey
    void load(ext)
  }, [ext, extKey, load])

  // the address keeps the drawing (g = vertices and edges, c = the edge that closed the cycle)
  const settled = useDebounced(graph, 400)
  useEffect(() => {
    if (ext && extKey !== loadedKey.current) return
    const next = encode(settled).toString()
    if (window.location.pathname !== '/analyze' || window.location.search !== `?${next}`) navigate(`/analyze?${next}`, { replace: true })
  }, [settled, ext, extKey, navigate])

  // Ctrl/⌘ + Z and Ctrl/⌘ + Shift + Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isField(e.target)) return
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        dispatch({ type: 'redo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startFrom = (choice: string) => {
    if (choice === 'one') setGraph(ONE_VERTEX, choice)
    else if (choice === 'path') setGraph(path(5), choice)
    else if (choice === 'star') setGraph(star(4), choice)
    else void load({ format: 'catalog', data: choice })
  }

  // the analysis follows the drawing once it settles
  const live = useDebounced(graph, 300)
  const unicyclic = hasCycle(live)
  const treeInput = useMemo<TreeInputBody | null>(() => (!unicyclic && live.n >= 2 ? { format: 'edges', data: edgesText(live) } : null), [live, unicyclic])
  const uniInput = useMemo(() => (unicyclic ? { n: live.n, edges: live.edges } : null), [live, unicyclic])
  const treeQ = useAnalyze(treeInput)
  const uniQ = useUnicyclic(uniInput)
  const stale = live !== graph || treeQ.isFetching || uniQ.isFetching
  const refs = unicyclic ? (uniQ.data?.references ?? []) : (treeQ.data?.references ?? [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl">Analyze a tree</h1>
        <p className="mt-1 font-sans text-sm text-muted">
          Draw a tree with clicks or type it in any of the usual formats. The analysis below follows every change: the <Term k="seed">seed</Term>, the status of the
          seed, the bounds on q(T) and a realizing matrix. Close a cycle and the analysis turns to unicyclic graphs.
        </p>
      </div>

      <Section id="analyze-input" title="The tree">
        <div className="space-y-3">
          <div data-tour="analyze-tabs" className="inline-flex">
            <Segmented
              label="How to give the tree"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'draw', label: 'Draw', tip: 'Build the tree by clicking: each click hangs a new leaf on a vertex.' },
                { value: 'type', label: 'Type', tip: 'An edge list, an adjacency list, a parent array, a Prüfer sequence, parentheses, graph6, the thesis notation or the gallery.' },
              ]}
            />
          </div>
          {tab === 'draw' ? (
            <GrowEditor
              graph={graph}
              onChange={(g) => setGraph(g, 'draw')}
              origin={origin}
              onUndo={() => {
                dispatch({ type: 'undo' })
                setOrigin('history')
              }}
              onRedo={() => {
                dispatch({ type: 'redo' })
                setOrigin('history')
              }}
              canUndo={hist.past.length > 0}
              canRedo={hist.future.length > 0}
              onStartFrom={startFrom}
              starting={loading}
            />
          ) : (
            <div className="space-y-2">
              {hasCycle(graph) && (
                <p className="font-sans text-sm text-muted">
                  The drawing has a cycle, and this tab reads trees. A tree typed here replaces the drawing.
                </p>
              )}
              <TreeInput
                key={hasCycle(graph) ? 'cycle' : edgesText(graph)}
                initial={!hasCycle(graph) && graph.n >= 2 ? { format: 'edges', data: edgesText(graph) } : undefined}
                busy={loading}
                submitLabel="Use this tree"
                onSubmit={(body) => void load(body)}
              />
            </div>
          )}
          {loadError != null && <ErrorNote error={loadError} />}
        </div>
      </Section>

      <Section id="analyze-result" title="Analysis" citeKeys={refs} right={stale ? 'updating…' : undefined}>
        {live.n < 2 && <p className="font-sans text-sm text-muted">Click the vertex to hang a leaf on it: the analysis starts with the first edge.</p>}
        {!unicyclic && live.n >= 2 && (
          <>
            {treeQ.isLoading && <Loading text="Analyzing the tree…" />}
            {treeQ.error && <ErrorNote error={treeQ.error} />}
            {treeQ.data && <TreeResult data={treeQ.data} />}
          </>
        )}
        {unicyclic && (
          <>
            {uniQ.isLoading && <Loading text="Collecting the published results…" />}
            {uniQ.error && <ErrorNote error={uniQ.error} />}
            {uniQ.data && <UnicyclicResult result={uniQ.data} showGraph={false} />}
          </>
        )}
      </Section>
    </div>
  )
}
