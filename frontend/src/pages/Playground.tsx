import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  Condition,
  ConditionList,
  PlaygroundGenerateFail,
  PlaygroundGenerateOk,
  PlaygroundOp,
  PlaygroundParam,
  PlaygroundParamValue,
  PlaygroundSeed,
  PlaygroundState,
} from '../api/types'
import { useLabels, usePlaygroundGenerate, usePlaygroundSeeds, usePlaygroundState } from '../api/hooks'
import { Section } from '../components/Section'
import { PlaygroundSeedList } from '../components/PlaygroundSeedList'
import { Tex, MathText } from '../components/Tex'
import { SCALE_CARD, TreeView } from '../components/TreeView'
import { MatrixView } from '../components/MatrixView'
import { SpectrumBar } from '../components/SpectrumBar'
import { BrickSummary, SpectrumChips } from '../components/BrickSummary'
import { ThesisBadges } from '../components/ThesisBadges'
import { LabelledText, ThesisLabels, ThesisRef } from '../components/ThesisRef'
import { SymbolTip, Term, PlainMath } from '../components/ThesisTips'
import { Tooltip } from '../components/ui/tooltip'
import { Callout, ErrorNote, Loading } from '../components/ErrorNote'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label, Select } from '../components/ui/input'
import { branchVertices, decodeOps, encodeOps } from '../lib/playground'
import { parseRationalList, rationalNum } from '../lib/exact'
import { cn } from '../lib/cn'

const DIAMETERS = Array.from({ length: 15 }, (_, i) => i + 1)

/** Thesis labels named in the tooltips of this page (numbers of the current compilation). */
const LABELS = ['thm:general_spectra', 'prop:tower-bricks', 'lem:six-arms', 'prop:d7', 'def:abd', 'thm:brick-diminimal', 'lem:dp-branch', 'tab:d7']

/** URL state: ?d=&seed=&ops= (ops as "y-u" pairs joined by "_"). */
function usePlaygroundUrl() {
  const [search, setSearch] = useSearchParams()
  const dRaw = Number(search.get('d'))
  const d = Number.isInteger(dRaw) && dRaw >= 1 && dRaw <= 15 ? dRaw : null
  const seed = d !== null ? search.get('seed') : null
  const opsText = search.get('ops') ?? ''
  const ops = useMemo(() => decodeOps(opsText), [opsText])
  const update = useCallback(
    (patch: { d?: number; seed?: string | null; ops?: PlaygroundOp[] }, replace = false) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (patch.d !== undefined) {
            next.set('d', String(patch.d))
            next.delete('seed')
            next.delete('ops')
          }
          if (patch.seed !== undefined) {
            if (patch.seed) next.set('seed', patch.seed)
            else next.delete('seed')
            next.delete('ops')
          }
          if (patch.ops !== undefined) {
            if (patch.ops.length > 0) next.set('ops', encodeOps(patch.ops))
            else next.delete('ops')
          }
          return next
        },
        { replace },
      ),
    [setSearch],
  )
  return { d, seed, ops, opsText, update }
}

/** Step 3: the current tree; clicking a duplicable vertex u duplicates its branch at its parent. */
function DuplicationCanvas({ state, busy, onDuplicate }: { state: PlaygroundState; busy: boolean; onDuplicate: (u: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  const [pick, setPick] = useState('')
  const dup = state.duplicable
  const clickable = useMemo(() => Object.keys(dup).map(Number), [dup])
  const parent = hover !== null ? dup[String(hover)] : undefined
  const branch = useMemo(() => (hover !== null && parent !== undefined ? branchVertices(state.tree.edges, hover, parent) : []), [hover, parent, state.tree.edges])
  const click = (u: number) => {
    if (busy || dup[String(u)] === undefined) return
    setHover(null)
    onDuplicate(u)
  }
  const vertexInfo = (v: number) => {
    const y = dup[String(v)]
    if (y === undefined) return null
    const size = branchVertices(state.tree.edges, v, y).length
    return (
      <span>
        Click to duplicate the branch rooted at {v} ({size} {size === 1 ? 'vertex' : 'vertices'}) at its parent {y}.
      </span>
    )
  }
  return (
    <div className="space-y-2">
      <div className={cn('rounded-md border border-line bg-paper p-2', busy && 'opacity-70')}>
        <TreeView
          tree={state.tree}
          scale={SCALE_CARD}
          roots={state.main_roots}
          highlight={branch.length > 0 ? branch : undefined}
          secondary={parent !== undefined ? [parent] : undefined}
          clickable={clickable}
          onVertexClick={click}
          onVertexEnter={(v) => setHover(v)}
          onVertexLeave={() => setHover(null)}
          vertexInfo={vertexInfo}
          showIds
          alt={`Seed after ${state.ops.length} duplications`}
        />
      </div>
      <p className="min-h-5 font-sans text-xs text-muted" aria-live="polite">
        {hover !== null && parent !== undefined ? (
          `Click to duplicate the branch rooted at ${hover} (${branch.length} vertices, ringed) at its parent ${parent} (dashed ring).`
        ) : clickable.length > 0 ? (
          <>
            Hover a vertex to see the branch it roots; clicking duplicates that branch once at its parent, a <Term k="diameter-preserving">diameter-preserving</Term>{' '}
            1-CBD. The new edges are dashed and the <Term k="main root">main roots</Term> are red.
          </>
        ) : (
          'No branch of this tree can be duplicated without changing the diameter.'
        )}
      </p>
      {clickable.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (pick !== '') click(Number(pick))
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="pg-pick">Duplicate the branch rooted at</Label>
            <Tooltip
              content={
                <>
                  The vertices u whose branch can be duplicated, with their parents y: the branches that contain no main root, whose duplication preserves the diameter (
                  <ThesisRef label="lem:dp-branch" plain />
                  ).
                </>
              }
            >
              <Select id="pg-pick" value={pick} onChange={(e) => setPick(e.target.value)} className="w-40">
                <option value="">vertex…</option>
                {clickable.map((u) => (
                  <option key={u} value={u}>
                    {u} (parent {dup[String(u)]})
                  </option>
                ))}
              </Select>
            </Tooltip>
          </div>
          <Tooltip content="Duplicates the branch rooted at the chosen vertex once at its parent, as a click on the vertex does.">
            <Button type="submit" variant="outline" size="md" disabled={pick === '' || busy}>
              Duplicate
            </Button>
          </Tooltip>
        </form>
      )}
    </div>
  )
}

function paramDefault(v: number | number[]): string {
  return Array.isArray(v) ? v.join(', ') : String(v)
}

/** Step 4: the parameters of the construction, prefilled with the defaults of the seed. */
/** The tooltip of a parameter: its text from the API, the default, and for the prescribed sets of the arms the table they come from. */
function ParamTip({ p, table }: { p: PlaygroundParam; table: string | null }) {
  const fromTable = p.name === 'Lambda' || p.name === 'lambda7'
  return (
    <span className="block space-y-1">
      <span className="block">
        <PlainMath text={p.text} />
      </span>
      <span className="block">
        Default <span className="mono">{paramDefault(p.default)}</span>
        {fromTable && table ? (
          <>
            , from the row of Table {table} of the thesis for these rooted seeds (in each row, <Tex tex="\Lambda=\{\lambda_0,\ldots,\lambda_6\}" />,{' '}
            <Tex tex="\lambda_7>\lambda_6" />, <Tex tex="\Lambda'=\{\lambda_1,\ldots,\lambda_7\}" /> and <Tex tex="c=\lambda_0-1" />
            ).
          </>
        ) : (
          '.'
        )}
      </span>
      <span className="block text-[0.75rem] text-muted">{p.kind === 'int' ? 'An integer.' : 'Comma-separated rationals.'}</span>
    </span>
  )
}

function GenerateForm({ seed, busy, onGenerate }: { seed: PlaygroundSeed; busy: boolean; onGenerate: (params: Record<string, PlaygroundParamValue>) => void }) {
  const table = useLabels(['tab:d7']).data?.['tab:d7']?.number ?? null
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(seed.params.map((p) => [p.name, paramDefault(p.default)])))
  const parsed = useMemo(() => {
    const out: Record<string, PlaygroundParamValue> = {}
    const bad: string[] = []
    for (const p of seed.params) {
      const t = (text[p.name] ?? '').trim()
      if (p.kind === 'int') {
        if (/^[+-]?\d+$/.test(t)) out[p.name] = Number(t)
        else bad.push(p.name)
      } else {
        const list = parseRationalList(t)
        if (list) out[p.name] = list
        else bad.push(p.name)
      }
    }
    return { out, bad }
  }, [text, seed.params])
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (parsed.bad.length === 0) onGenerate(parsed.out)
      }}
    >
      <p className="font-serif text-sm">
        <span className="text-muted">Construction:</span> <PlainMath text={seed.note} />
      </p>
      {seed.params.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {seed.params.map((p) => {
            const invalid = parsed.bad.includes(p.name)
            return (
              <div key={p.name} className="space-y-1">
                <Label htmlFor={`pg-param-${p.name}`}>
                  <PlainMath text={p.text} />
                </Label>
                <Tooltip content={<ParamTip p={p} table={table} />}>
                  <Input
                    id={`pg-param-${p.name}`}
                    value={text[p.name] ?? ''}
                    onChange={(e) => setText((s) => ({ ...s, [p.name]: e.target.value }))}
                    aria-invalid={invalid}
                    inputMode={p.kind === 'int' ? 'numeric' : 'text'}
                    className={cn('w-full font-mono', invalid && 'border-defective')}
                    placeholder={p.kind === 'set' ? 'comma-separated rationals' : 'integer'}
                  />
                </Tooltip>
                {invalid && (
                  <p className="font-sans text-xs text-defective">{p.kind === 'int' ? 'An integer.' : 'A comma-separated list of rationals such as -4, 0, 5/2.'}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip
          content={
            <>
              Runs the construction of the thesis for this seed (StrongRealization for <Tex tex="S_d" />, <ThesisRef label="thm:general_spectra" plain />; TowerChain and
              φ for the tower seeds, <ThesisRef label="prop:tower-bricks" plain />; RootedSeedRealization for diameters 6 and 7, <ThesisRef label="lem:six-arms" plain /> and{' '}
              <ThesisRef label="prop:d7" plain />) and carries the brick to the current tree by regular 1-ABDs (
              <ThesisRef label="def:abd" plain />, <ThesisRef label="thm:brick-diminimal" plain />
              ); the result is checked by counting the zeros of Diagonalize at the prescribed values.
            </>
          }
        >
          <Button type="submit" disabled={busy || parsed.bad.length > 0}>
            {busy ? 'Generating…' : 'Generate matrix'}
          </Button>
        </Tooltip>
        <Tooltip content="Puts back the default parameters of this seed.">
          <Button type="button" variant="ghost" size="sm" onClick={() => setText(Object.fromEntries(seed.params.map((p) => [p.name, paramDefault(p.default)])))}>
            Restore the defaults
          </Button>
        </Tooltip>
      </div>
    </form>
  )
}

function ConditionTable({ title, rows }: { title?: string; rows: Condition[] }) {
  return (
    <div className="min-w-0">
      {title && (
        <h4 className="mb-1 font-sans text-xs font-semibold text-muted">
          <MathText text={title} />
        </h4>
      )}
      <table className="w-full border-collapse font-sans text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1 pr-3 font-medium">condition</th>
            <th className="py-1 pr-3 font-medium">statement</th>
            <th className="py-1 font-medium">holds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name} className="border-t border-line">
              <td className="mono py-1 pr-3">{c.name}</td>
              <td className="py-1 pr-3 font-serif">{c.text}</td>
              <td className={cn('py-1 font-medium', c.ok ? 'text-diminimal' : 'text-defective')} aria-label={c.ok ? 'holds' : 'fails'}>
                {c.ok ? '✓' : '✗'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Conditions({ list, first, second }: { list: ConditionList; first?: string; second?: string }) {
  if (Array.isArray(list)) return list.length > 0 ? <ConditionTable rows={list} /> : null
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ConditionTable title={first ? `First rooted seed, ${first}` : 'First rooted seed'} rows={list.first} />
      <ConditionTable title={second ? `Second rooted seed, ${second}` : 'Second rooted seed'} rows={list.second} />
    </div>
  )
}

export function FailResult({ r }: { r: PlaygroundGenerateFail }) {
  const list = r.conditions ?? r.info.conditions ?? null
  return (
    <div className="space-y-3">
      <Callout>
        <LabelledText text={r.reason} />
      </Callout>
      {list && <Conditions list={list} first={r.info.first} second={r.info.second} />}
      <p className="font-sans text-xs text-muted">Change the parameters above and generate again.</p>
    </div>
  )
}

export function OkResult({ r }: { r: PlaygroundGenerateOk }) {
  const spectrumValues = useMemo(() => r.tree.spectrum.map((e) => rationalNum(e.value)), [r.tree.spectrum])
  return (
    <div className="space-y-4">
      <p className="prose">
        <LabelledText text={r.method} />
      </p>
      <p className="font-sans text-xs text-muted">
        Prescribed values: <span className="mono text-ink">{r.prescribed.join(', ')}</span>
        {r.duplications > 0 && (
          <>
            {' '}
            · {r.duplications} duplication{r.duplications === 1 ? '' : 's'} carried by <Term k="ABD">regular 1-ABDs</Term>
          </>
        )}
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              The <Term k="brick">brick</Term> of the seed
            </CardTitle>
            <span className="mono font-sans text-xs text-muted">
              n = {r.seed.tree.n}, root {r.seed.root}
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-line bg-paper p-2">
              <TreeView tree={r.seed.tree} roots={[r.seed.root, ...r.seed.other_main_roots]} showIds alt="The seed" />
            </div>
            <BrickSummary spectrum={r.seed.spectrum} latent={r.seed.latent} confined={r.seed.confined} isBrick={r.seed.is_brick} reason={r.seed.reason} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>The matrix on the current tree</CardTitle>
            <SymbolTip s="q(M)" className="mono font-sans text-xs text-muted">
              n = {r.tree.n}, q(M) = {r.tree.q}
            </SymbolTip>
          </CardHeader>
          <CardContent className="space-y-3">
            <MatrixView matrix={r.tree.matrix} tree={r.tree.tree} root={r.tree.root} />
            <SpectrumChips entries={r.tree.spectrum} />
            <SpectrumBar values={spectrumValues} />
            <p className="font-serif text-sm">{r.tree.check}</p>
          </CardContent>
        </Card>
      </div>
      <ThesisBadges labels={r.theorems} references={r.references} />
    </div>
  )
}

export function PlaygroundPage() {
  const { d, seed: seedId, ops, opsText, update } = usePlaygroundUrl()
  const seeds = usePlaygroundSeeds(d)
  const seed = seeds.data?.find((s) => s.id === seedId) ?? null
  const stateReq = useMemo(() => (d !== null && seedId ? { seed: seedId, d, ops } : null), [d, seedId, ops])
  const state = usePlaygroundState(stateReq)
  const gen = usePlaygroundGenerate()
  const { reset } = gen
  // the state of the current ops is loaded (not the previous one kept on screen while the next loads)
  const ready = !!state.data && !state.isPlaceholderData && !state.isFetching

  useEffect(() => {
    reset()
  }, [d, seedId, opsText, reset])

  const selectSeed = (id: string) => {
    update({ seed: id })
    window.setTimeout(() => document.getElementById('pg-step3')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  const duplicate = (u: number) => {
    const shown = state.data
    if (!shown) return
    const y = shown.duplicable[String(u)]
    if (y === undefined) return
    update({ ops: [...ops, [y, u]] }, true)
  }

  return (
    <ThesisLabels keys={LABELS}>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl">Playground</h1>
          <p className="mt-1 font-sans text-sm text-muted">
            Choose a diameter and a <Term k="seed">seed</Term> the thesis can realize, <Term k="CBD">duplicate branches</Term>, and generate a{' '}
            <Term k="realization">matrix with the minimum number of distinct eigenvalues</Term>. The page address keeps the whole state, so it is a permalink.
          </p>
        </div>

        <Section id="pg-step1" title="1. Diameter">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Diameter">
            {DIAMETERS.map((k) => (
              <Tooltip
                key={k}
                content={`Lists the seeds of diameter ${k} that the thesis realizes, grouped by construction; choosing a diameter clears the seed and the duplications.`}
              >
                <Button variant={d === k ? 'default' : 'outline'} size="sm" aria-pressed={d === k} onClick={() => update({ d: k })} className="w-9">
                  {k}
                </Button>
              </Tooltip>
            ))}
          </div>
          {d === null && <p className="mt-2 font-sans text-sm text-muted">Pick a diameter to list the seeds.</p>}
        </Section>

        {d !== null && (
          <Section id="pg-step2" title={`2. Seed of diameter ${d}`} right={seeds.data ? `${seeds.data.length} construction${seeds.data.length === 1 ? '' : 's'}` : undefined}>
            {seeds.isLoading && <Loading text={`Loading the seeds of diameter ${d}…`} />}
            {seeds.error && <ErrorNote error={seeds.error} />}
            {seeds.data && <PlaygroundSeedList seeds={seeds.data} selected={seedId} onSelect={selectSeed} />}
          </Section>
        )}

        {d !== null && seedId && (
          <div id="pg-step3" className="scroll-mt-20">
            <Section id="pg-step3-section" title="3. Duplicate branches">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
                  {seed ? <Tex tex={seed.label} className="font-serif text-base" /> : <span className="mono">{seedId}</span>}
                  {state.data && (
                    <span className="mono text-muted">
                      {state.data.n} vertices, diameter {state.data.d}, {ops.length} duplication{ops.length === 1 ? '' : 's'}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1.5">
                    <Tooltip content="Removes the last duplicated branch; the page address keeps the list of duplications.">
                      <Button variant="outline" size="sm" disabled={ops.length === 0} onClick={() => update({ ops: ops.slice(0, -1) }, true)}>
                        Undo last duplication
                      </Button>
                    </Tooltip>
                    <Tooltip content="Removes every duplication and goes back to the seed.">
                      <Button variant="outline" size="sm" disabled={ops.length === 0} onClick={() => update({ ops: [] }, true)}>
                        Reset
                      </Button>
                    </Tooltip>
                  </span>
                </div>
                {state.isLoading && <Loading text="Building the tree…" />}
                {state.error && <ErrorNote error={state.error} />}
                {state.data && <DuplicationCanvas state={state.data} busy={state.isFetching} onDuplicate={duplicate} />}
              </div>
            </Section>
          </div>
        )}

        {d !== null && seed && state.data && (
          <Section id="pg-step4" title="4. Generate the matrix">
            <GenerateForm key={seed.id} seed={seed} busy={gen.isPending || !ready} onGenerate={(params) => gen.mutate({ seed: seed.id, d, ops, params })} />
            {gen.error && <ErrorNote error={gen.error} className="mt-3" />}
          </Section>
        )}

        {gen.data && (
          <Section
            id="pg-result"
            title={gen.data.ok ? 'Result' : 'The construction does not apply'}
            citeKeys={gen.data.ok ? gen.data.references : []}
            right={gen.data.ok ? `${gen.data.theorems.length} statements of the thesis` : undefined}
          >
            {gen.data.ok ? <OkResult r={gen.data} /> : <FailResult r={gen.data} />}
          </Section>
        )}
      </div>
    </ThesisLabels>
  )
}
