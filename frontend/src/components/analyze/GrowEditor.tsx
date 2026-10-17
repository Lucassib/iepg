import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  MAX_VERTICES,
  addLeaf,
  attachToCycle,
  closeCycle,
  cycleOf,
  hasCycle,
  layoutOf,
  openCycle,
  removeHanging,
  treeDiameter,
  type Grown,
} from '../../lib/growGraph'
import { Button } from '../ui/button'
import { Input, Label, Select } from '../ui/input'
import { Segmented } from '../ui/segmented'
import { Tooltip } from '../ui/tooltip'
import { Tex } from '../Tex'
import { cn } from '../../lib/cn'

/** The starting points offered by "Start from": built here, or read from the catalog by the page. */
export const START_OPTIONS: { group: string; items: { value: string; label: string }[] }[] = [
  {
    group: 'Small trees',
    items: [
      { value: 'one', label: 'One vertex' },
      { value: 'path', label: 'A path on 5 vertices' },
      { value: 'star', label: 'A star with 4 leaves' },
    ],
  },
  {
    group: 'Seeds of diameter 6',
    items: Array.from({ length: 12 }, (_, i) => ({ value: `S6_${i + 1}`, label: `S6(${i + 1})` })),
  },
  {
    group: 'The seeds S_d',
    items: [7, 8, 9, 10].map((d) => ({ value: `S_${d}`, label: `S_${d}` })),
  },
]

type Pending = null | { a: number | null }

const R = 9 // vertex radius
const HIT = 17 // radius of the clickable area

export function GrowEditor({
  graph,
  onChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onStartFrom,
  starting,
  origin,
}: {
  graph: Grown
  /** where the drawing came from ('draw', a catalog name, 'typed', …): read by the guided tour */
  origin: string
  onChange: (g: Grown) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onStartFrom: (choice: string) => void
  starting: boolean
}) {
  const layout = useMemo(() => layoutOf(graph), [graph])
  const cycle = useMemo(() => cycleOf(graph), [graph])
  const cycleSet = useMemo(() => new Set(cycle ?? []), [cycle])
  const unicyclic = hasCycle(graph)
  const [hover, setHover] = useState<number | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)

  // a new graph (undo, start from, typed tree) clears what pointed at the old vertices
  useEffect(() => {
    setHover(null)
    setActive((a) => (a !== null && a < graph.n ? a : null))
  }, [graph])

  const removable = (v: number) => graph.n > 1 && (unicyclic || v !== 0)

  // a vertex with a leaf hanging on it: a new leaf there copies that leaf, so the tree keeps its seed (the guided tour clicks it)
  const suggest = useMemo(() => {
    if (unicyclic) return null
    const deg = new Array(graph.n).fill(0)
    for (const [a, b] of graph.edges) (deg[a]++, deg[b]++)
    for (const [a, b] of graph.edges) {
      if (deg[a] >= 2 && deg[b] === 1) return a
      if (deg[b] >= 2 && deg[a] === 1) return b
    }
    return null
  }, [graph, unicyclic])

  const clickVertex = (v: number) => {
    setActive(v)
    if (pending) {
      if (pending.a === null) {
        setPending({ a: v })
        setMessage('Now click the second vertex: the edge between the two closes the cycle.')
        return
      }
      if (pending.a === v) {
        setPending({ a: null })
        setMessage('Click the first vertex of the cycle.')
        return
      }
      const out = closeCycle(graph, pending.a, v)
      if (typeof out === 'string') {
        setMessage(out)
        return
      }
      setPending(null)
      setMessage(null)
      onChange(out)
      return
    }
    if (graph.n >= MAX_VERTICES) {
      setMessage(`The analysis takes at most ${MAX_VERTICES} vertices.`)
      return
    }
    setMessage(null)
    onChange(addLeaf(graph, v))
  }

  const remove = (v: number) => {
    if (!removable(v)) return
    setMessage(null)
    setActive(null)
    setHover(null)
    onChange(removeHanging(graph, v))
  }

  const onVertexKey = (e: KeyboardEvent, v: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      clickVertex(v)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(v)
    }
  }

  useEffect(() => {
    if (!pending) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPending(null)
        setMessage(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  const startCycle = () => {
    if (unicyclic) {
      onChange(openCycle(graph))
      setMessage(null)
      return
    }
    if (pending) {
      setPending(null)
      setMessage(null)
      return
    }
    setAttachOpen(false)
    setPending({ a: null })
    setMessage('Click the first vertex of the cycle. Esc cancels.')
  }

  // the ghost of the leaf a click would add: in a tree the new leaf is the last child, right of the others;
  // in a unicyclic graph it points away from the cycle
  const kids = useMemo(() => {
    const out: number[][] = Array.from({ length: graph.n }, () => [])
    for (const [a, b] of graph.edges) {
      const pa = layout.pos[a], pb = layout.pos[b]
      if (!pa || !pb || layout.center) continue
      if (pb.y > pa.y) out[a].push(b)
      else if (pa.y > pb.y) out[b].push(a)
    }
    return out
  }, [graph, layout])
  const ghost = (v: number) => {
    const p = layout.pos[v]
    if (!p) return null
    let x2 = p.x, y2 = p.y + 40
    if (layout.center) {
      const ux = p.x - layout.center.x, uy = p.y - layout.center.y
      const len = Math.hypot(ux, uy) || 1
      x2 = p.x + (40 * ux) / len
      y2 = p.y + (40 * uy) / len
    } else if (kids[v].length > 0) {
      const last = kids[v].map((c) => layout.pos[c]).reduce((m, q) => (q.x > m.x ? q : m))
      x2 = last.x + 40
      y2 = last.y
    }
    const len = Math.hypot(x2 - p.x, y2 - p.y) || 1
    return { x1: p.x + ((x2 - p.x) * R) / len, y1: p.y + ((y2 - p.y) * R) / len, x2, y2 }
  }

  const shown = pending ? null : (hover ?? active)
  const g = shown !== null && shown < graph.n ? ghost(shown) : null
  const xFor = shown !== null && shown < graph.n && removable(shown) ? layout.pos[shown] : null
  const status = unicyclic
    ? `Unicyclic graph with ${graph.n} vertices; its cycle, drawn in blue, has length ${cycle?.length ?? '?'}.`
    : graph.n === 1
      ? 'One vertex. Click it to hang a leaf on it.'
      : `Tree with ${graph.n} vertices and diameter ${treeDiameter(graph)}.`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" data-tour="analyze-tools">
        <Tooltip content="Undo the last change (Ctrl or ⌘ + Z).">
          <Button size="sm" variant="outline" onClick={onUndo} disabled={!canUndo}>
            Undo
          </Button>
        </Tooltip>
        <Tooltip content="Redo the change you undid (Ctrl or ⌘ + Shift + Z).">
          <Button size="sm" variant="outline" onClick={onRedo} disabled={!canRedo}>
            Redo
          </Button>
        </Tooltip>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <Tooltip
          content={
            unicyclic
              ? 'Removes the edge that closed the cycle, and the graph is a tree again.'
              : 'Then click two vertices that are not joined: the edge between them closes the only cycle, and the analysis turns to unicyclic graphs.'
          }
        >
          <Button size="sm" variant={pending ? 'default' : 'outline'} aria-pressed={!!pending} onClick={startCycle} disabled={!unicyclic && graph.n < 3}>
            {unicyclic ? 'Open the cycle' : pending ? 'Cancel the cycle' : 'Close a cycle'}
          </Button>
        </Tooltip>
        <Tooltip content="Coalesces the tree with a cycle C_k at a vertex, once or at every vertex of the cycle.">
          <Button
            size="sm"
            variant={attachOpen ? 'default' : 'outline'}
            aria-pressed={attachOpen}
            onClick={() => {
              setPending(null)
              setMessage(null)
              setAttachOpen((o) => !o)
            }}
            disabled={unicyclic}
          >
            Attach to a cycle
          </Button>
        </Tooltip>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <Tooltip content="Replaces the drawing by a starting point; Undo brings the drawing back.">
          <Select
            aria-label="Start from"
            value=""
            disabled={starting}
            onChange={(e) => {
              if (e.target.value) {
                setPending(null)
                setMessage(null)
                onStartFrom(e.target.value)
              }
            }}
            className="w-44"
          >
            <option value="">{starting ? 'Loading…' : 'Start from…'}</option>
            {START_OPTIONS.map((grp) => (
              <optgroup key={grp.group} label={grp.group}>
                {grp.items.map((it) => (
                  <option key={it.value} value={it.value}>
                    {it.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Tooltip>
      </div>

      {attachOpen && !unicyclic && (
        <AttachPanel
          treeN={graph.n}
          vertex={active !== null && active < graph.n ? active : 0}
          onAttach={(k, mode) => {
            const v = active !== null && active < graph.n ? active : 0
            onChange(attachToCycle(graph, v, k, mode))
            setAttachOpen(false)
          }}
        />
      )}

      <div
        className="max-h-[70vh] overflow-auto rounded-md border border-line bg-paper"
        data-tour="analyze-canvas"
        data-n={graph.n}
        data-diameter={unicyclic ? undefined : treeDiameter(graph)}
        data-origin={origin}
        data-suggest={suggest ?? undefined}
      >
        <svg
          width={Math.max(layout.width, 320)}
          height={Math.max(layout.height, 160)}
          className="mx-auto block select-none text-ink"
          role="application"
          aria-label="Drawing: click a vertex to hang a leaf on it"
        >
          <g data-part="edges">
            {graph.edges.map(([a, b]) => {
              const pa = layout.pos[a], pb = layout.pos[b]
              const onC = cycleSet.has(a) && cycleSet.has(b)
              return (
                <line
                  key={`${a}-${b}`}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  stroke={onC ? 'var(--copy-a)' : 'currentColor'}
                  strokeWidth={onC ? 2 : 1.3}
                />
              )
            })}
          </g>
          {g && (
            <g aria-hidden pointerEvents="none" stroke="var(--muted)" fill="none" strokeDasharray="3 3">
              <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} />
              <circle cx={g.x2} cy={g.y2} r={R - 2} />
            </g>
          )}
          {layout.pos.map((p, v) => {
            const picked = pending?.a === v
            return (
              <g
                key={v}
                role="button"
                tabIndex={0}
                aria-label={pending ? `vertex ${v}: pick it for the cycle` : `vertex ${v}: hang a leaf on it`}
                className="cursor-pointer outline-none"
                onClick={() => clickVertex(v)}
                onKeyDown={(e) => onVertexKey(e, v)}
                onMouseEnter={() => setHover(v)}
                onMouseLeave={() => setHover((h) => (h === v ? null : h))}
                onFocus={() => setActive(v)}
              >
                <circle cx={p.x} cy={p.y} r={HIT} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={R}
                  fill={picked ? 'var(--copy-a)' : 'var(--bg)'}
                  stroke={hover === v || active === v || picked ? 'var(--copy-a)' : 'currentColor'}
                  strokeWidth={hover === v || active === v || picked ? 2.4 : 1.4}
                />
                <text x={p.x + R + 3} y={p.y + R + 8} fontSize="9.5" fill="var(--muted)" className="font-mono">
                  {v}
                </text>
              </g>
            )
          })}
          {xFor && shown !== null && (
            <g
              role="button"
              tabIndex={0}
              aria-label={`remove vertex ${shown} and what hangs from it`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                remove(shown)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  remove(shown)
                }
              }}
              onMouseEnter={() => setHover(shown)}
            >
              <circle cx={xFor.x + 15} cy={xFor.y - 15} r={8.5} fill="var(--bg)" stroke="var(--state-defective)" strokeWidth={1.4} />
              <path
                d={`M${xFor.x + 11.5} ${xFor.y - 18.5}l7 7M${xFor.x + 18.5} ${xFor.y - 18.5}l-7 7`}
                stroke="var(--state-defective)"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans text-sm">
        <span className="font-medium" aria-live="polite">
          {status}
        </span>
        <span className="text-xs text-muted">
          Click a vertex to hang a new leaf on it. The × removes a vertex and everything that hangs from it.
        </span>
      </div>
      {message && (
        <p role="status" className={cn('font-sans text-sm', pending ? 'text-ink' : 'text-defective')}>
          {message}
        </p>
      )}
    </div>
  )
}

function AttachPanel({ vertex, treeN, onAttach }: { vertex: number; treeN: number; onAttach: (k: number, mode: 'one' | 'all') => void }) {
  const [k, setK] = useState('5')
  const [mode, setMode] = useState<'one' | 'all'>('one')
  const kNum = Number(k)
  // the vertices of the result: the cycle, and one copy of the tree less the coalesced vertex at one or at every cycle vertex
  const size = mode === 'all' ? kNum * treeN : kNum + treeN - 1
  const kOk = Number.isInteger(kNum) && kNum >= 3 && kNum <= 40 && size <= MAX_VERTICES
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (kOk) onAttach(kNum, mode)
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="attach-k">
          cycle length <Tex tex="k" />
        </Label>
        <Input id="attach-k" type="number" min={3} max={40} value={k} onChange={(e) => setK(e.target.value)} aria-invalid={!kOk} className="w-20 font-mono" />
      </div>
      <Segmented
        label="Where the tree is attached"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'one', label: 'at one cycle vertex', tip: 'One copy of the tree, coalesced with C_k at the vertex (a path gives a tadpole).' },
          { value: 'all', label: 'at every cycle vertex', tip: 'One copy of the tree at each of the k vertices of the cycle (a path gives a sunlet).' },
        ]}
      />
      <p className="basis-full font-sans text-xs text-muted">
        The tree is coalesced with <Tex tex="C_k" /> at vertex <span className="mono">{vertex}</span>, the last vertex you clicked. The result is a{' '}
        unicyclic graph, and Open the cycle turns it back into a tree.
        {Number.isInteger(kNum) && size > MAX_VERTICES && (
          <span className="block text-defective">
            The result would have {size} vertices; this version handles at most {MAX_VERTICES}.
          </span>
        )}
      </p>
      <Button type="submit" variant="default" size="sm" disabled={!kOk}>
        Attach
      </Button>
    </form>
  )
}
