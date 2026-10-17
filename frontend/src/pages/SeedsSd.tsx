import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { StrongRealizationRequest, StrongRealizationResponse, TreeInfo, Verification } from '../api/types'
import { api } from '../api/client'
import { useParsed, useStrongRealization } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { CiteChip } from '../components/CiteChip'
import { SCALE_GRID, TreeView } from '../components/TreeView'
import { MatrixView } from '../components/MatrixView'
import { VerificationSummary } from '../components/BrickSummary'
import { ThesisLabels, ThesisRef } from '../components/ThesisRef'
import { Callout, ErrorNote, Loading } from '../components/ErrorNote'
import { Segmented } from '../components/ui/segmented'
import { Button, buttonClass } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import { makeSampler, nonAdmissibleWitness, type SampleMode } from '../lib/admissible'
import { isValidRational } from '../lib/exact'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip, Term } from '../components/ThesisTips'

const LABELS = ['thm:C', 'def:admissible', 'prop:generic', 'eq:union', 'prop:explicit-family', 'prop:algorithms', 'thm:brick-diminimal', 'thm:general_spectra', 'def:abd']
const GALLERY = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const LIMIT = 10_000_000

const sdSize = (d: number) => (d % 2 === 1 ? 2 ** ((d + 1) / 2) : 3 * 2 ** (d / 2 - 1))
const fmt = (n: number) => n.toLocaleString('en-US')

function GalleryCard({ d }: { d: number }) {
  const input = useMemo(() => ({ format: 'gallery' as const, data: 'S_d', params: { d } }), [d])
  const q = useParsed(input)
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-surface p-2">
      <span className="flex items-center justify-between gap-2">
        <Tex tex={`S_{${d}}`} className="font-serif" />
        <span className="font-sans text-xs text-muted">n = {sdSize(d)}</span>
      </span>
      {q.isLoading && <Loading className="p-2 text-xs" />}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && <TreeView tree={q.data} scale={SCALE_GRID} className="max-h-64 overflow-y-auto rounded bg-paper p-1" alt={`S_${d}`} />}
    </div>
  )
}

// --- random search for a non-admissible set -----------------------------------------------------------------------

type Found = { set: bigint[]; tuple: bigint[] }
type Stats = { attempts: number; found: number; rate: number; last: bigint[] | null; witness: Found | null; limitHit: boolean }
const ZERO: Stats = { attempts: 0, found: 0, rate: 0, last: null, witness: null, limitHit: false }

function RandomSearch() {
  const [k, setK] = useState(4)
  const [mode, setMode] = useState<SampleMode>('real')
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<Stats>(ZERO)
  const stats = useRef<Stats>({ ...ZERO })
  const check = useMutation({
    mutationFn: async (s: { set: bigint[]; client: boolean }) => {
      const r = await api.admissible(s.set.map(String))
      return { server: r.admissible, client: s.client, set: s.set }
    },
  })
  const { mutate: runCheck, reset: resetCheck } = check

  // a new k or sampling mode stops the search and starts the counters again
  const restart = (next: { k?: number; mode?: SampleMode }) => {
    setRunning(false)
    stats.current = { ...ZERO }
    setView(ZERO)
    resetCheck()
    if (next.k !== undefined) setK(next.k)
    if (next.mode !== undefined) setMode(next.mode)
  }

  useEffect(() => {
    if (!running) return
    const size = 2 * k + 1
    const sample = makeSampler(size, mode)
    const st = stats.current
    const start = st.attempts
    const window: [number, number][] = [[performance.now(), st.attempts]]
    let raf = 0
    const stop = (why: 'found' | 'limit') => {
      setRunning(false)
      if (why === 'limit') st.limitHit = true
      setView({ ...st })
      if (st.last) runCheck({ set: st.last, client: nonAdmissibleWitness(st.last) === null })
    }
    const tick = () => {
      const t0 = performance.now()
      let found: Found | null = null
      while (!found && performance.now() - t0 < 14 && st.attempts - start < LIMIT) {
        for (let i = 0; i < 64; i++) {
          const s = sample()
          st.attempts++
          st.last = s
          const w = nonAdmissibleWitness(s)
          if (w) {
            found = { set: s, tuple: w }
            break
          }
          if (st.attempts - start >= LIMIT) break
        }
      }
      const now = performance.now()
      window.push([now, st.attempts])
      while (window.length > 2 && now - window[0][0] > 1000) window.shift()
      const [t1, a1] = window[0]
      st.rate = now > t1 ? ((st.attempts - a1) * 1000) / (now - t1) : 0
      if (found) {
        st.found++
        st.witness = found
        stop('found')
        return
      }
      if (st.attempts - start >= LIMIT) {
        stop('limit')
        return
      }
      setView({ ...st })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, k, mode, runCheck])

  const toggle = () => {
    if (running) {
      setRunning(false)
      const st = stats.current
      setView({ ...st })
      if (st.last) runCheck({ set: st.last, client: nonAdmissibleWitness(st.last) === null })
    } else {
      stats.current.limitHit = false
      resetCheck()
      setRunning(true)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs font-medium text-muted">
          <Tex tex="k" />
        </span>
        <div className="flex gap-1" role="group" aria-label="k">
          {[2, 3, 4, 5, 6, 7].map((x) => (
            <Tooltip key={x} content={`Sets of 2k + 1 = ${2 * x + 1} values, the prescribed sets of a brick of S_${2 * x - 1}; choosing k stops the search and resets the counters.`}>
              <Button size="sm" className="w-8" variant={k === x ? 'default' : 'outline'} aria-pressed={k === x} onClick={() => restart({ k: x })}>
                {x}
              </Button>
            </Tooltip>
          ))}
        </div>
        <Segmented
          label="Sampling"
          value={mode}
          onChange={(m) => restart({ mode: m })}
          options={[
            {
              value: 'real',
              label: 'real numbers',
              tip: (
                <>
                  Real numbers: <Tex tex="2k+1" /> distinct integers drawn uniformly from <Tex tex="[0,2^{53})" />, exact arithmetic.
                </>
              ),
            },
            {
              value: 'small',
              label: 'small integers',
              tip: (
                <>
                  Small integers: <Tex tex="2k+1" /> distinct integers from <Tex tex="\{0,\ldots,30\}" />, where coinciding first and last gaps are frequent.
                </>
              ),
            },
          ]}
        />
        <Tooltip
          content={
            running ? (
              'Stops the search; the server then tests the last set drawn and says whether it agrees with the browser.'
            ) : (
              <>
                {view.attempts > 0 ? 'Resumes' : 'Starts'} drawing sets and testing them with the recursion of <ThesisRef label="def:admissible" plain /> in the browser,
                until a non-admissible set appears or {fmt(LIMIT)} attempts are made.
              </>
            )
          }
        >
          <Button onClick={toggle}>{running ? 'Stop' : view.attempts > 0 ? 'Continue' : 'Start'}</Button>
        </Tooltip>
      </div>
      <p className="font-sans text-xs text-muted">
        Each attempt draws <Tex tex={`2k+1=${2 * k + 1}`} /> distinct values
        {mode === 'real' ? (
          <>
            , uniform integers in <Tex tex="[0,2^{53})" /> (an exact lattice in a huge box, standing for random reals)
          </>
        ) : (
          <>
            {' '}
            from <Tex tex="\{0,\ldots,30\}" />, a coarse lattice where the hyperplanes are hit often
          </>
        )}
        , and runs the test of <ThesisRef label="def:admissible" /> in exact integer arithmetic in the browser.
      </p>
      <dl className="grid grid-cols-3 gap-2 font-sans">
        {[
          ['attempts', fmt(view.attempts), 'Sets drawn and tested since the counters were reset.'],
          ['attempts per second', running ? fmt(Math.round(view.rate)) : '–', 'Tests per second over the last second, in exact BigInt arithmetic.'],
          ['non-admissible found', fmt(view.found), 'Sets whose recursion reaches a tuple with equal first and last gaps; the search stops at the first one.'],
        ].map(([t, v, tip]) => (
          <div key={t} className="rounded-md border border-line bg-paper px-3 py-2">
            <dt className="text-xs text-muted">
              <Tooltip content={tip}>
                <span tabIndex={0} className="cursor-help">
                  {t}
                </span>
              </Tooltip>
            </dt>
            <dd className="mono text-lg tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {mode === 'real' && view.found === 0 && (
        <p className="font-serif text-sm">
          No non-admissible set so far: by <ThesisRef label="prop:generic" /> they form a set of Lebesgue measure zero.
        </p>
      )}
      {view.limitHit && <p className="font-sans text-xs text-muted">Stopped after {fmt(LIMIT)} attempts.</p>}
      {view.last && (
        <p className="font-sans text-xs text-muted">
          last set <span className="mono break-all text-ink">{`{${view.last.join(', ')}}`}</span>
        </p>
      )}
      {check.data && (
        <p className="font-sans text-xs" role="status">
          {check.data.server === check.data.client ? (
            <span className="text-diminimal">server agrees</span>
          ) : (
            <span className="text-defective">server disagrees</span>
          )}{' '}
          <span className="text-muted">on the last set ({check.data.server ? 'admissible' : 'not admissible'})</span>
        </p>
      )}
      {check.error && <ErrorNote error={check.error} />}
      {view.witness && (
        <div className="space-y-1 rounded-md border border-defective bg-paper px-3 py-2">
          <p className="font-sans text-sm font-medium">A non-admissible set</p>
          <p className="mono break-all text-sm">{`{${view.witness.set.join(', ')}}`}</p>
          <p className="font-sans text-xs text-muted">
            The recursion reaches <span className="mono break-all text-ink">({view.witness.tuple.join(', ')})</span>, whose first and last gaps{' '}
            coincide.
          </p>
          <Link
            to={`/lab/admissibility?${new URLSearchParams({ set: view.witness.set.join(',') }).toString()}`}
            className="inline-block font-sans text-sm underline decoration-line underline-offset-2 hover:decoration-ink"
          >
            See its recursion tree
          </Link>
        </div>
      )}
    </div>
  )
}

// --- build a brick of S_d -----------------------------------------------------------------------------------------

function LatentNote({ v, tree }: { v: Verification; tree: TreeInfo }) {
  if (v.latent.length === 0) return null
  const others = tree.main_roots.filter((r) => r !== 0)
  return (
    <ul className="space-y-0.5 font-serif text-sm">
      {v.latent.map((l) => {
        const w = v.witnesses[l] ?? []
        const atOther = w.length > 0 && w.every((x) => others.includes(x))
        return (
          <li key={l}>
            The <Term k="latent value">latent value</Term> <span className="mono">{l}</span> has its temporary zeros only at vertex {w.join(', ')}
            {atOther ? (
              <>
                , the other <Term k="main root">main root</Term> (so it is <Term k="confined">confined</Term>).
              </>
            ) : (
              '.'
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Brick({ r, d, alpha, beta }: { r: StrongRealizationResponse; d: number; alpha: string; beta: string }) {
  const even = d % 2 === 0
  const tree = even ? r.even?.tree : r.tree
  const matrix = even ? r.even?.matrix : r.matrix
  const ver = even ? r.even?.verification : r.verification
  const links = (
    <div className="flex flex-wrap gap-2">
      <Tooltip content="Opens Build S_d with these parameters: every level of StrongRealization, its first and last gaps, lateral set and φ step.">
        <Link to={`/lab/build-sd?${new URLSearchParams({ k: String(r.k), alpha, beta, ...(even ? { even: '1' } : {}) }).toString()}`} className={buttonClass('outline', 'sm')}>
          See the recursion step by step
        </Link>
      </Tooltip>
      <Tooltip content="Opens the playground on this seed, where clicking a vertex duplicates its branch and Generate matrix carries the brick to the new tree.">
        <Link to={`/playground?${new URLSearchParams({ d: String(d), seed: `S_${d}` }).toString()}`} className={buttonClass('outline', 'sm')}>
          Duplicate branches in the playground
        </Link>
      </Tooltip>
    </div>
  )
  if (!r.ok || !tree || !matrix || !ver)
    return (
      <div className="space-y-2">
        <Callout>{r.fail || 'No brick for these parameters.'}</Callout>
        {links}
      </div>
    )
  return (
    <div className="space-y-3">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              A brick of <Tex tex={`S_{${d}}`} />
            </CardTitle>
            <span className="mono font-sans text-xs text-muted">n = {tree.n}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-line bg-paper p-2">
              <TreeView tree={tree} showIds alt={`S_${d}`} />
            </div>
            <MatrixView matrix={matrix} tree={tree} />
          </CardContent>
        </Card>
        <div className="space-y-3">
          <VerificationSummary v={ver} />
          {!even && <LatentNote v={ver} tree={tree} />}
        </div>
      </div>
      {links}
    </div>
  )
}

function BuildBrick() {
  const [d, setD] = useState('7')
  const [alpha, setAlpha] = useState('0')
  const [beta, setBeta] = useState('16')
  const [req, setReq] = useState<{ body: StrongRealizationRequest; d: number } | null>(null)
  const q = useStrongRealization(req?.body ?? null)
  const dNum = Number(d)
  const dOk = Number.isInteger(dNum) && dNum >= 1 && dNum <= 13
  const ok = dOk && isValidRational(alpha) && isValidRational(beta)
  const changeD = (v: string) => {
    const prev = Number(d)
    const prevDefault = Number.isInteger(prev) && prev >= 1 ? String(2 ** Math.ceil(prev / 2)) : null
    setD(v)
    const n = Number(v)
    if (beta === prevDefault && Number.isInteger(n) && n >= 1 && n <= 13) setBeta(String(2 ** Math.ceil(n / 2)))
  }
  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) setReq({ body: { k: Math.ceil(dNum / 2), alpha, beta, even: dNum % 2 === 0 }, d: dNum })
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="bb-d">
            <Tex tex="d" /> (1–13)
          </Label>
          <Tooltip content="The diameter of the seed S_d, from 1 to 13; the recursion runs with k = ⌈d/2⌉.">
            <Input id="bb-d" type="number" min={1} max={13} value={d} onChange={(e) => changeD(e.target.value)} aria-invalid={!dOk} className="w-20 font-mono" />
          </Tooltip>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bb-a">
            <Tex tex="\alpha" />
          </Label>
          <Tooltip content="α, a rational: the middle element λ_k of the prescribed set of the explicit family.">
            <Input id="bb-a" value={alpha} onChange={(e) => setAlpha(e.target.value)} aria-invalid={!isValidRational(alpha)} className="w-20 font-mono" />
          </Tooltip>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bb-b">
            <Tex tex="\beta" />
          </Label>
          <Tooltip content="β, with δ_i = (β − α)/2^i; the spectrum is integral when 2^(k−1) divides β − α.">
            <Input id="bb-b" value={beta} onChange={(e) => setBeta(e.target.value)} aria-invalid={!isValidRational(beta)} className="w-24 font-mono" />
          </Tooltip>
        </div>
        <Tooltip
          content={
            <>
              Runs StrongRealization on the explicit family (<ThesisRef label="thm:general_spectra" plain />, <ThesisRef label="prop:explicit-family" plain />) and, for
              even d, a regular 1-ABD (<ThesisRef label="prop:algorithms" plain />); the brick is checked by computing its spectrum and its latent values.
            </>
          }
        >
          <Button type="submit" disabled={!ok || q.isFetching}>
            {q.isFetching ? 'Building…' : 'Build the brick'}
          </Button>
        </Tooltip>
      </form>
      <p className="font-sans text-xs text-muted">
        <span className="mono">StrongRealization</span> with <Tex tex="k=\lceil d/2\rceil" /> on the explicit family of <ThesisRef label="prop:explicit-family" />, and
        for even <Tex tex="d" /> a <Term k="ABD">regular 1-ABD</Term> (<ThesisRef label="prop:algorithms" />).
      </p>
      {q.isLoading && <Loading text="Running StrongRealization…" />}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && req && <Brick r={q.data} d={req.d} alpha={alpha} beta={beta} />}
    </div>
  )
}

export function SeedsSdPage() {
  return (
    <ThesisLabels keys={LABELS}>
      <div className="space-y-5">
        <h1 className="text-3xl">
          The <Term k="seed">seeds</Term>{' '}
          <SymbolTip s="S_d">
            <Tex tex="S_d" />
          </SymbolTip>
        </h1>

        <Section id="sd-recursion" title="The recursion" citeKeys={['allem2023diminimal']}>
          <div className="space-y-3">
            <p className="prose">
              Set <Tex tex="S_{-1}=S_0=K_1" />, and for <Tex tex="k\geq1" /> let <Tex tex="S_{2k-1}=S_{2k-3}\odot S_{2k-3}" /> and{' '}
              <Tex tex="S_{2k}=S_{2k-3}\odot(S_{2k-3},S_{2k-3})" />. So <Tex tex="S_d" /> has <Tex tex="2^{(d+1)/2}" /> vertices when <Tex tex="d" /> is odd and{' '}
              <Tex tex="3\cdot2^{d/2-1}" /> when <Tex tex="d" /> is even.
              These are the families of seeds of <CiteChip citeKey="allem2023diminimal" />, recovered in the thesis with a new proof. The dashed edges are those of the
              last composition.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {GALLERY.map((d) => (
                <GalleryCard key={d} d={d} />
              ))}
            </div>
          </div>
        </Section>

        <Section id="sd-almost" title="Almost every spectrum">
          <div className="prose space-y-2">
            <p>
              <ThesisRef label="thm:C" />. For every <Tex tex="d\geq1" />, almost every set of <Tex tex="d+1" /> distinct
              real numbers is the set of distinct eigenvalues of a <Term k="brick">brick</Term> of <Tex tex="S_d" />.
            </p>
            <p>
              The sets that <span className="mono">StrongRealization</span> turns into bricks are the <Term k="admissible">admissible</Term> sets of{' '}
              <ThesisRef label="def:admissible" />: at every step of the recursion the first and the last gap must differ. The non-admissible sets have Lebesgue measure zero (<ThesisRef label="prop:generic" />), because
              they lie in the finite union of hyperplanes <Tex tex="\ell(F(x))=0" /> of equation <ThesisRef label="eq:union" />, where{' '}
              <Tex tex="\ell(x)=(x_{2m}-x_{2m-1})-(x_1-x_0)" /> and <Tex tex="F" /> runs over the compositions of the maps <Tex tex="f_0" />, <Tex tex="f_+" />,{' '}
              <Tex tex="f_-" /> of the recursion (the <Term k="interior">interior</Term> and the two <Term k="lateral">lateral</Term> sets).
            </p>
          </div>
        </Section>

        <Section id="sd-random" title="Try to find a non-admissible set at random">
          <p className="mb-3 font-sans text-sm text-muted">(hint: this will take forever (:</p>
          <RandomSearch />
        </Section>

        <Section id="sd-build" title="Build a brick">
          <BuildBrick />
        </Section>
      </div>
    </ThesisLabels>
  )
}
