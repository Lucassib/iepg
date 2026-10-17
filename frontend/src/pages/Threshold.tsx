import { useMemo, useState } from 'react'
import { useThreshold } from '../api/hooks'
import type { ThresholdResponse } from '../api/types'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { CiteChip } from '../components/CiteChip'
import { GraphView } from '../components/GraphView'
import { BoundsPanel } from '../components/BoundsPanel'
import { ClassMatrix, VerifiedSpectrum } from '../components/ClassResult'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import { copyColor, tint } from '../lib/colors'
import { isValidRational, rationalToNumber } from '../lib/exact'
import { useDebounced } from '../lib/useDebounced'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip } from '../components/ThesisTips'

const MAX_N = 40

/** Block index of every vertex from the block sizes a_1, …, a_r. */
function blockOf(blocks: number[]): number[] {
  const out: number[] = []
  blocks.forEach((a, i) => {
    for (let t = 0; t < a; t++) out.push(i)
  })
  return out
}

function Blocks({ blocks }: { blocks: number[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-sans text-sm">
      {blocks.map((a, i) => {
        const union = i % 2 === 0
        const c = copyColor(i)
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-muted" aria-hidden>
                ·
              </span>
            )}
            <span
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5"
              style={{ borderColor: c, background: tint(c, 16) }}
              title={union ? 'a bag of isolated vertices (0)' : 'a bag of dominating vertices (1)'}
            >
              <span className="font-serif">{union ? '∪' : '⊗'}</span>
              <Tex tex={`a_{${i + 1}} = ${a}`} />
            </span>
          </span>
        )
      })}
    </div>
  )
}

export function ThresholdResult({ data }: { data: ThresholdResponse }) {
  const blockIdx = useMemo(() => blockOf(data.blocks), [data.blocks])
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
          <CardContent className="space-y-3">
            <div className="rounded-md border border-line bg-paper p-2">
              <GraphView graph={data.graph} scale={scale} radius={8} labels="ids" vertexColor={(v) => copyColor(blockIdx[v] ?? 0)} alt={`Threshold graph ${data.sequence}`} />
            </div>
            <p className="font-sans text-xs text-muted">Vertices are numbered by insertion and colored by their bag.</p>
            <div className="space-y-1">
              <h4 className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">Bags</h4>
              <Blocks blocks={data.blocks} />
              <p className="font-sans text-xs text-muted">∪ bags hold isolated vertices (0), ⊗ bags dominating vertices (1); they alternate.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The matrix</CardTitle>
            <span className="font-sans text-xs text-muted">Algorithm 1</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClassMatrix matrix={data.matrix} approx={data.matrix_approx} />
            <VerifiedSpectrum verification={data.verification} lam={data.lam} />
          </CardContent>
        </Card>
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

export function ThresholdPage() {
  const [seq, setSeq] = useState('0')
  const [history, setHistory] = useState<string[]>([])
  const [draft, setDraft] = useState('0')
  const [lam, setLam] = useState('1')

  const commit = (next: string) => {
    if (next === seq) return
    setHistory((h) => [...h, seq])
    setSeq(next)
    setDraft(next)
  }
  const undo = () => {
    const prev = history[history.length - 1]
    if (prev === undefined) return
    setHistory((h) => h.slice(0, -1))
    setSeq(prev)
    setDraft(prev)
  }
  const draftOk = /^[01]+$/.test(draft) && draft.length <= MAX_N
  const lamOk = isValidRational(lam) && rationalToNumber(lam) !== 0
  const lamD = useDebounced(lam, 300)
  const lamDOk = isValidRational(lamD) && rationalToNumber(lamD) !== 0
  const req = useMemo(() => (lamDOk ? { sequence: seq, lam: lamD } : null), [seq, lamD, lamDOk])
  const q = useThreshold(req)
  const full = seq.length >= MAX_N

  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Threshold graphs</h1>
      <Section
        id="threshold-theorem"
        title="Every threshold graph has q(G) ≤ 4"
        heading={
          <>
            Every threshold graph has{' '}
            <SymbolTip s="q(G)" focusable={false}>
              <Tex tex="q(G)\leq 4" />
            </SymbolTip>
          </>
        }
        citeKeys={['allem2025threshold']}
      >
        <p className="prose">
          A threshold graph is built from one vertex by repeatedly adding an isolated vertex (0) or a dominating vertex (1), so it is encoded by a binary sequence.
          Theorem 1.1 of Allem, Hoppen, Lazzarin, Sibemberg and Tura <CiteChip citeKey="allem2025threshold" />: if <Tex tex="G" /> is a threshold graph and{' '}
          <Tex tex="\lambda\neq0" /> is a real number, then there is a matrix <Tex tex="M\in\mathcal S(G)" /> such that{' '}
          <SymbolTip s="DSpec(M)">
            <Tex tex="\operatorname{DSpec}(M)\subseteq\{-\lambda,0,\lambda,2\lambda\}" />
          </SymbolTip>
          . In particular <Tex tex="q(G)\leq4" />. The proof is constructive, and the
          matrix shown on this page is the output of its Algorithm 1 for the sequence you build, computed and verified in exact arithmetic.
        </p>
      </Section>

      <Section id="threshold-builder" title="Build a threshold graph">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip content="Appends 0 to the sequence: a new vertex adjacent to no previous vertex.">
              <Button onClick={() => commit(seq + '0')} disabled={full}>
                Add isolated vertex (0)
              </Button>
            </Tooltip>
            <Tooltip content="Appends 1 to the sequence: a new vertex adjacent to every previous vertex.">
              <Button onClick={() => commit(seq + '1')} disabled={full}>
                Add dominating vertex (1)
              </Button>
            </Tooltip>
            <Tooltip content="Goes back to the previous sequence.">
              <Button variant="outline" onClick={undo} disabled={history.length === 0}>
                Undo
              </Button>
            </Tooltip>
            <Tooltip content="Goes back to the single vertex, the sequence 0.">
              <Button variant="outline" onClick={() => commit('0')} disabled={seq === '0'}>
                Reset
              </Button>
            </Tooltip>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="th-seq">Binary sequence (edit and press Enter)</Label>
              <Tooltip content="The binary sequence of the graph: the first letter is the initial vertex, then each 0 adds an isolated vertex and each 1 a dominating vertex. Enter applies it, Esc discards the edit.">
                <Input
                  id="th-seq"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.replace(/\s+/g, ''))}
                  onBlur={() => draftOk && commit(draft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draftOk) commit(draft)
                    if (e.key === 'Escape') setDraft(seq)
                  }}
                  aria-invalid={!draftOk}
                  className="w-full font-mono tracking-wider"
                />
              </Tooltip>
            </div>
            <div className="space-y-1">
              <Label htmlFor="th-lam">
                <Tex tex="\lambda" /> (nonzero rational)
              </Label>
              <Tooltip content="The nonzero real λ of Theorem 1.1 of Allem et al. 2025, as a rational: Algorithm 1 gives a matrix with DSpec(M) ⊆ {−λ, 0, λ, 2λ}.">
                <Input id="th-lam" value={lam} onChange={(e) => setLam(e.target.value)} aria-invalid={!lamOk} className="w-24 font-mono" />
              </Tooltip>
            </div>
          </div>
          {!draftOk && <p className="font-sans text-xs text-defective">Only 0 and 1, at most {MAX_N} vertices.</p>}
          {!lamOk && <p className="font-sans text-xs text-defective">λ must be a nonzero rational such as 1 or 1/2.</p>}
          <p className="font-sans text-xs text-muted">
            {seq.length} vertices. The first letter stands for the initial vertex.{full && ` The builder stops at ${MAX_N} vertices.`}
          </p>
        </div>
      </Section>

      <Section id="threshold-result" title={`The threshold graph ${seq}`} citeKeys={q.data?.references ?? []} right={q.isFetching ? 'updating…' : undefined}>
        {q.isLoading && <Loading />}
        {q.error && <ErrorNote error={q.error} />}
        {q.data && <ThresholdResult data={q.data} />}
      </Section>
    </div>
  )
}
