import { useMemo, useState } from 'react'
import type { CographExpr, CographResponse } from '../api/types'
import { useCograph } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { CiteChip } from '../components/CiteChip'
import { GraphView } from '../components/GraphView'
import { CotreeView } from '../components/CotreeView'
import { BoundsPanel } from '../components/BoundsPanel'
import { ClassMatrix, VerifiedSpectrum } from '../components/ClassResult'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import { circleLayout, circleRadius } from '../lib/graph'
import { exprGraph, exprSize, exprText } from '../lib/cograph'
import { isValidRational, rationalToNumber } from '../lib/exact'
import { cn } from '../lib/cn'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip } from '../components/ThesisTips'

type Piece = { id: number; expr: CographExpr }

const CASES: Record<number, string> = {
  1: 'false twins, diagonal 0: new eigenvalue 0',
  2: 'false twins, diagonal λ: new eigenvalue λ',
  3: 'true twins, diagonal 0: new eigenvalue 2λ',
  4: 'true twins, diagonal λ: new eigenvalue −λ',
}

function PieceDrawing({ expr }: { expr: CographExpr }) {
  const graph = useMemo(() => {
    const g = exprGraph(expr)
    return { ...g, layout: circleLayout(g.n, circleRadius(g.n, 0.9, 0.9)) }
  }, [expr])
  return <GraphView graph={graph} scale={30} radius={6.5} labels="ids" alt={`Cograph ${exprText(expr)}`} />
}

function PieceCard({ piece, selected, analyzed, onToggle, onAnalyze, onRemove }: { piece: Piece; selected: boolean; analyzed: boolean; onToggle: () => void; onAnalyze: () => void; onRemove: () => void }) {
  const text = exprText(piece.expr)
  const n = exprSize(piece.expr)
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-md border bg-surface p-2', selected ? 'border-ink ring-1 ring-ink' : 'border-line', analyzed && 'bg-paper')}>
      <div className="flex items-center justify-between gap-2 font-sans text-xs">
        <Tooltip content="Selects this piece for Union or Join.">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={selected} onChange={onToggle} className="accent-[var(--text)]" />
            <span>select</span>
          </label>
        </Tooltip>
        <span className="text-muted">
          {n} {n === 1 ? 'vertex' : 'vertices'}
        </span>
        <Tooltip content="Removes this piece.">
          <button type="button" onClick={onRemove} className="rounded px-1 text-muted hover:text-ink" aria-label={`Remove the piece ${text}`}>
            ×
          </button>
        </Tooltip>
      </div>
      <div className="rounded bg-paper p-1">
        <PieceDrawing expr={piece.expr} />
      </div>
      <code className="mono block truncate text-xs" title={text}>
        {text}
      </code>
      <Tooltip content="Builds the matrix of the twin construction (proof of Theorem 4 of the paper) for this piece, verifies its spectrum exactly and lists the bounds on q(G).">
        <Button size="sm" variant={analyzed ? 'default' : 'outline'} onClick={onAnalyze} aria-pressed={analyzed}>
          Analyze
        </Button>
      </Tooltip>
    </div>
  )
}

function TwinTable({ data }: { data: CographResponse }) {
  if (data.twin_steps.length === 0) return <p className="font-sans text-sm text-muted">A single vertex: the matrix is [0].</p>
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-3 font-medium">step</th>
            <th className="py-1 pr-3 font-medium">added vertex</th>
            <th className="py-1 pr-3 font-medium">twin of</th>
            <th className="py-1 pr-3 font-medium">twins</th>
            <th className="py-1 pr-3 font-medium">case</th>
            <th className="py-1 font-medium">new eigenvalue</th>
          </tr>
        </thead>
        <tbody>
          {data.twin_steps.map((s, i) => (
            <tr key={i} className="border-t border-line">
              <td className="mono py-1 pr-3">{i + 1}</td>
              <td className="mono py-1 pr-3">{s.added}</td>
              <td className="mono py-1 pr-3">{s.twin_of}</td>
              <td className="py-1 pr-3">{s.kind === 'true' ? 'true twins' : 'false twins'}</td>
              <td className="py-1 pr-3" title={CASES[s.case]}>
                Case {s.case}
              </td>
              <td className="mono py-1">{s.new_eigenvalue}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 font-sans text-xs text-muted">
        The graph is grown from vertex {data.twin_steps.length > 0 ? data.twin_steps[0].twin_of : 0} by adding one twin at a time (Theorem 3 of the paper). Cases 1 to 4
        of the proof of Theorem 4: false twins with diagonal 0 or λ add the eigenvalue 0 or λ, true twins with diagonal 0 or λ add 2λ or −λ.
      </p>
    </div>
  )
}

export function CographResult({ data }: { data: CographResponse }) {
  const agrees = useMemo(() => {
    const byC = data.spectrum_by_construction
    const v = data.verification.spectrum
    return v.length === Object.keys(byC).length && v.every((e) => byC[e.value] === e.multiplicity)
  }, [data])
  const scale = Math.max(40, 1.9 * data.graph.n)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>The graph</CardTitle>
            <span className="mono font-sans text-xs text-muted">
              n = {data.graph.n}, {data.graph.edges.length} edge{data.graph.edges.length === 1 ? '' : 's'}
            </span>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-line bg-paper p-2">
              <GraphView graph={data.graph} scale={scale} radius={8} labels="ids" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The cotree</CardTitle>
            <span className="font-sans text-xs text-muted">∪ union, ⊕ join</span>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-line bg-paper p-2">
              <CotreeView cotree={data.cotree} />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-2">
        <h3 className="font-serif text-base font-semibold">The twin sequence</h3>
        <TwinTable data={data} />
      </div>
      <div className="space-y-2">
        <h3 className="font-serif text-base font-semibold">The matrix</h3>
        <ClassMatrix matrix={data.matrix} approx={data.matrix_approx} />
        <VerifiedSpectrum verification={data.verification} lam={data.lam} />
        <p className="font-sans text-xs text-muted">
          {agrees
            ? 'The multiplicities predicted by the twin sequence agree with the verified spectrum.'
            : 'The multiplicities predicted by the twin sequence differ from the verified spectrum.'}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-serif text-base font-semibold">
          Bounds on{' '}
          <SymbolTip s="q(G)">
            <Tex tex="q(G)" />
          </SymbolTip>
        </h3>
        <BoundsPanel lower={data.lower} upper={data.upper} exact={data.exact} />
      </div>
    </div>
  )
}

export function CographsPage() {
  const [pieces, setPieces] = useState<Piece[]>(() => [0, 1, 2].map((id) => ({ id, expr: { op: 'v' } })))
  const [nextId, setNextId] = useState(3)
  const [selected, setSelected] = useState<number[]>([])
  const [analyzed, setAnalyzed] = useState<Piece | null>(null)
  const [lam, setLam] = useState('1')
  const lamOk = isValidRational(lam) && rationalToNumber(lam) !== 0
  const req = useMemo(() => (analyzed && lamOk ? { expr: analyzed.expr, lam } : null), [analyzed, lam, lamOk])
  const q = useCograph(req)

  const add = () => {
    setPieces((p) => [...p, { id: nextId, expr: { op: 'v' } }])
    setNextId((i) => i + 1)
  }
  const combine = (op: 'union' | 'join') => {
    const chosen = pieces.filter((p) => selected.includes(p.id))
    if (chosen.length < 2) return
    const piece: Piece = { id: nextId, expr: { op, children: chosen.map((p) => p.expr) } }
    const firstIdx = pieces.findIndex((p) => p.id === chosen[0].id)
    const rest = pieces.filter((p) => !selected.includes(p.id))
    rest.splice(Math.min(firstIdx, rest.length), 0, piece)
    setPieces(rest)
    setNextId((i) => i + 1)
    setSelected([piece.id])
  }
  const remove = (id: number) => {
    setPieces((p) => p.filter((x) => x.id !== id))
    setSelected((s) => s.filter((x) => x !== id))
    if (analyzed?.id === id) setAnalyzed(null)
  }
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Cographs</h1>
      <Section
        id="cograph-theorem"
        title="Every cograph has q(G) ≤ 4"
        heading={
          <>
            Every cograph has{' '}
            <SymbolTip s="q(G)" focusable={false}>
              <Tex tex="q(G)\leq 4" />
            </SymbolTip>
          </>
        }
        citeKeys={['allem2026cographs']}
      >
        <p className="prose">
          Cographs are the graphs obtained from single vertices by disjoint unions <Tex tex="G_1\cup G_2" /> and joins <Tex tex="G_1\oplus G_2" />. Theorem 2 of Allem,
          Fürer, Hoppen, Sibemberg and Trevisan (submitted) <CiteChip citeKey="allem2026cographs" />: if <Tex tex="G" /> is a cograph and <Tex tex="\lambda\neq0" /> is a
          real number, then there is a matrix <Tex tex="M\in\mathcal S(G)" /> with{' '}
          <SymbolTip s="DSpec(M)">
            <Tex tex="\operatorname{DSpec}(M)\subseteq\{-\lambda,0,\lambda,2\lambda\}" />
          </SymbolTip>
          , so{' '}
          <Tex tex="q(G)\leq4" />. It follows from Theorem 4 of the same paper, which adds that every diagonal entry of <Tex tex="M" /> can be taken in{' '}
          <Tex tex="\{0,\lambda\}" />; its proof builds <Tex tex="M" /> by adding one twin at a time, in four cases. The analysis below runs that construction.
        </p>
      </Section>

      <Section id="cograph-builder" title="Build a cograph">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content="Adds a new piece: a single vertex.">
              <Button onClick={add}>New vertex</Button>
            </Tooltip>
            <Tooltip content="Replaces the selected pieces (two or more) by their disjoint union, in the order shown.">
              <Button variant="outline" onClick={() => combine('union')} disabled={selected.length < 2}>
                Union ∪
              </Button>
            </Tooltip>
            <Tooltip content="Replaces the selected pieces (two or more) by their join: the disjoint union plus every edge between two different pieces.">
              <Button variant="outline" onClick={() => combine('join')} disabled={selected.length < 2}>
                Join ⊕
              </Button>
            </Tooltip>
            <Tooltip content="Unselects every piece.">
              <Button variant="ghost" onClick={() => setSelected([])} disabled={selected.length === 0}>
                Clear the selection
              </Button>
            </Tooltip>
            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="cg-lam">
                <Tex tex="\lambda" />
              </Label>
              <Tooltip content="The nonzero real λ of Theorem 2 of the paper, as a rational: the matrix has DSpec(M) ⊆ {−λ, 0, λ, 2λ} and diagonal entries in {0, λ} (Theorem 4).">
                <Input id="cg-lam" value={lam} onChange={(e) => setLam(e.target.value)} aria-invalid={!lamOk} className="w-20 font-mono" />
              </Tooltip>
            </div>
          </div>
          <p className="font-sans text-xs text-muted">
            Select two or more pieces and apply Union or Join to replace them by one piece (in the order shown). {selected.length > 0 && `${selected.length} selected.`}
            {!lamOk && ' λ must be a nonzero rational.'}
          </p>
          {pieces.length === 0 ? (
            <p className="font-sans text-sm text-muted">No pieces: add a vertex.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {pieces.map((p) => (
                <PieceCard
                  key={p.id}
                  piece={p}
                  selected={selected.includes(p.id)}
                  analyzed={analyzed?.id === p.id}
                  onToggle={() => toggle(p.id)}
                  onAnalyze={() => setAnalyzed(p)}
                  onRemove={() => remove(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </Section>

      {analyzed && (
        <Section id="cograph-result" title={`Analysis of ${exprText(analyzed.expr)}`} citeKeys={q.data?.references ?? []}>
          {q.isLoading && <Loading />}
          {q.error && <ErrorNote error={q.error} />}
          {q.data && <CographResult data={q.data} />}
        </Section>
      )}
    </div>
  )
}
