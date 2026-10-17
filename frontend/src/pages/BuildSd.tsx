import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { StrongRealizationRequest, StrongRealizationResponse } from '../api/types'
import { useStrongRealization } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { TreeView } from '../components/TreeView'
import { MatrixView } from '../components/MatrixView'
import { VerificationSummary } from '../components/BrickSummary'
import { TraceChain } from '../components/StrongTrace'
import { ThesisBadges } from '../components/ThesisBadges'
import { Callout, ErrorNote, Loading } from '../components/ErrorNote'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input, Label } from '../components/ui/input'
import { isValidRational, parseRationalList } from '../lib/exact'
import { Tooltip } from '../components/ui/tooltip'
import { SymbolTip, Term } from '../components/ThesisTips'
import { ThesisLabels, ThesisRef } from '../components/ThesisRef'

type Mode = 'family' | 'set'

/** The request encoded in the URL: ?set=… or ?k=&alpha=&beta=, and even=1. */
function requestFromSearch(search: URLSearchParams): StrongRealizationRequest | null {
  const even = search.get('even') === '1'
  const set = search.get('set')
  if (set) {
    const list = parseRationalList(set)
    return list ? { set: list, even } : null
  }
  const k = Number(search.get('k'))
  const alpha = search.get('alpha') ?? '0'
  const beta = search.get('beta') ?? String(2 ** k)
  if (Number.isInteger(k) && k >= 1 && k <= 7 && isValidRational(alpha) && isValidRational(beta)) return { k, alpha, beta, even }
  return null
}

function toSearch(r: StrongRealizationRequest): Record<string, string> {
  const out: Record<string, string> = 'set' in r ? { set: r.set.join(',') } : { k: String(r.k), alpha: r.alpha, beta: r.beta }
  if (r.even) out.even = '1'
  return out
}

function BrickCard({ title, tree, children }: { title: React.ReactNode; tree: NonNullable<StrongRealizationResponse['tree']>; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="mono font-sans text-xs text-muted">
          n = {tree.n}, d = {tree.diameter}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-line bg-paper p-2">
          <TreeView tree={tree} showIds />
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function Final({ r }: { r: StrongRealizationResponse }) {
  if (!r.ok || !r.tree || !r.matrix || !r.verification) {
    return (
      <div className="space-y-2">
        <Callout>
          <span className="font-semibold">No brick:</span> {r.fail || 'the set is not admissible.'}
        </Callout>
        <Link
          to={`/lab/admissibility?${new URLSearchParams({ set: r.set.join(',') }).toString()}`}
          className="font-sans text-sm underline decoration-line underline-offset-2 hover:decoration-ink"
        >
          See where the admissibility test fails
        </Link>
      </div>
    )
  }
  const d = 2 * r.k - 1
  return (
    <div className="space-y-4">
      <p className="font-sans text-sm text-muted">
        <span className="mono">StrongRealization</span>
        <Tex tex={`(${r.k},\\Lambda)`} /> on <Tex tex={`\\Lambda=\\{${r.set.join(', ')}\\}`} />
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        <BrickCard
          title={
            <>
              The brick of <Tex tex={`S_{${d}}`} />
            </>
          }
          tree={r.tree}
        >
          <VerificationSummary v={r.verification} />
          <MatrixView matrix={r.matrix} tree={r.tree} />
        </BrickCard>
        {r.even && (
          <BrickCard
            title={
              <>
                The even diameter: <Tex tex={`S_{${d + 1}}`} />
              </>
            }
            tree={r.even.tree}
          >
            <p className="font-sans text-xs text-muted">
              A <Term k="ABD">regular 1-ABD</Term> of the brick of <Tex tex={`S_{${d}}`} />.
            </p>
            <VerificationSummary v={r.even.verification} />
            <MatrixView matrix={r.even.matrix} tree={r.even.tree} />
          </BrickCard>
        )}
      </div>
      <ThesisBadges labels={r.theorems} />
    </div>
  )
}

export function BuildSdPage() {
  const [search, setSearch] = useSearchParams()
  const fromUrl = useMemo(() => requestFromSearch(search), [search])
  const initial = fromUrl ?? { k: 3, alpha: '0', beta: '8', even: false }
  const [mode, setMode] = useState<Mode>('set' in initial ? 'set' : 'family')
  const [k, setK] = useState('set' in initial ? '3' : String(initial.k))
  const [alpha, setAlpha] = useState('set' in initial ? '0' : initial.alpha)
  const [beta, setBeta] = useState('set' in initial ? '8' : initial.beta)
  const [setText, setSetText] = useState('set' in initial ? initial.set.join(', ') : '0, 1, 3, 4, 7, 8, 11, 15, 19')
  const [even, setEven] = useState(!!initial.even)
  const [req, setReq] = useState<StrongRealizationRequest>(initial)
  const q = useStrongRealization(req)

  // follow the URL when another page links here
  useEffect(() => {
    if (fromUrl && JSON.stringify(fromUrl) !== JSON.stringify(req)) {
      setReq(fromUrl)
      if ('set' in fromUrl) {
        setMode('set')
        setSetText(fromUrl.set.join(', '))
      } else {
        setMode('family')
        setK(String(fromUrl.k))
        setAlpha(fromUrl.alpha)
        setBeta(fromUrl.beta)
      }
      setEven(!!fromUrl.even)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl])

  const kNum = Number(k)
  const kOk = Number.isInteger(kNum) && kNum >= 1 && kNum <= 7
  const familyOk = kOk && isValidRational(alpha) && isValidRational(beta)
  const parsedSet = parseRationalList(setText)
  const canBuild = mode === 'family' ? familyOk : !!parsedSet

  const changeK = (v: string) => {
    // keep β at its default 2^k while the reader has not edited it
    const prevDefault = String(2 ** Number(k))
    setK(v)
    const n = Number(v)
    if (beta === prevDefault && Number.isInteger(n) && n >= 1 && n <= 7) setBeta(String(2 ** n))
  }

  const build = () => {
    const next: StrongRealizationRequest = mode === 'family' ? { k: kNum, alpha, beta, even } : { set: parsedSet!, even }
    setReq(next)
    setSearch(toSearch(next), { replace: true })
  }

  return (
    <ThesisLabels keys={['thm:general_spectra', 'prop:explicit-family', 'prop:algorithms', 'def:abd']}>
      <div className="space-y-5">
        <h1 className="text-3xl">
          Build{' '}
          <SymbolTip s="S_d">
            <Tex tex="S_d" />
          </SymbolTip>
        </h1>
        <Section id="sd-input" title="Input">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (canBuild) build()
            }}
          >
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger
                  value="family"
                  tip={
                    <>
                      The set <Tex tex="\Lambda_1^{(k)}(\alpha,\beta)" /> of the explicit family, admissible by <ThesisRef label="prop:explicit-family" plain />.
                    </>
                  }
                >
                  Explicit family
                </TabsTrigger>
                <TabsTrigger value="set" tip="A set of 2k + 1 rationals of your choice; the recursion stops if it is not admissible.">
                  A given set
                </TabsTrigger>
              </TabsList>
              <TabsContent value="family">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="sd-k">
                      <Tex tex="k" /> (1–7)
                    </Label>
                    <Tooltip content="k, from 1 to 7: the recursion has k levels and builds a brick of S_{2k−1}.">
                      <Input id="sd-k" type="number" min={1} max={7} value={k} onChange={(e) => changeK(e.target.value)} aria-invalid={!kOk} className="w-16 font-mono" />
                    </Tooltip>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sd-a">
                      <Tex tex="\alpha" />
                    </Label>
                    <Tooltip content="α, a rational: the middle element λ_k of the prescribed set Λ_1^(k).">
                      <Input id="sd-a" value={alpha} onChange={(e) => setAlpha(e.target.value)} aria-invalid={!isValidRational(alpha)} className="w-20 font-mono" />
                    </Tooltip>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sd-b">
                      <Tex tex="\beta" /> (default <Tex tex="2^k" />)
                    </Label>
                    <Tooltip content="β, with δ_i = (β − α)/2^i; the spectrum is integral when 2^(k−1) divides β − α.">
                      <Input id="sd-b" value={beta} onChange={(e) => setBeta(e.target.value)} aria-invalid={!isValidRational(beta)} className="w-24 font-mono" />
                    </Tooltip>
                  </div>
                </div>
                <p className="mt-2 font-sans text-xs text-muted">
                  <span className="mono">StrongRealization</span> on <Tex tex="\Lambda_1^{(k)}(\alpha,\beta)" /> with <Tex tex="\delta_i=(\beta-\alpha)/2^i" />: a
                  brick of <Tex tex={kOk ? `S_{${2 * kNum - 1}}` : 'S_{2k-1}'} />.
                </p>
              </TabsContent>
              <TabsContent value="set">
                <div className="space-y-1">
                  <Label htmlFor="sd-set">
                    <Tex tex="\Lambda=\{\lambda_0<\cdots<\lambda_{2k}\}" />, comma separated
                  </Label>
                  <Tooltip content="2k + 1 rationals separated by commas, in any order; k is read from the size of the set.">
                    <Input id="sd-set" value={setText} onChange={(e) => setSetText(e.target.value)} aria-invalid={!parsedSet} className="w-full font-mono" />
                  </Tooltip>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip
                content={
                  <>
                    Also builds a brick of <Tex tex="S_{2k}" /> from the brick of <Tex tex="S_{2k-1}" /> by a regular 1-ABD (<ThesisRef label="def:abd" plain />,{' '}
                    <ThesisRef label="prop:algorithms" plain />
                    ).
                  </>
                }
              >
                <label className="inline-flex cursor-pointer items-center gap-2 font-sans text-sm">
                  <input type="checkbox" checked={even} onChange={(e) => setEven(e.target.checked)} className="accent-[var(--text)]" />
                  also the even diameter
                </label>
              </Tooltip>
              <Tooltip
                content={
                  <>
                    Runs StrongRealization(k, Λ) level by level (<ThesisRef label="thm:general_spectra" plain />) and verifies the brick: its spectrum, its temporary zero
                    set and its latent values.
                  </>
                }
              >
                <Button type="submit" disabled={!canBuild || q.isFetching}>
                  {q.isFetching ? 'Building…' : 'Build'}
                </Button>
              </Tooltip>
            </div>
          </form>
        </Section>

        <Section
          id="sd-final"
          title="The brick"
          heading={
            <>
              The{' '}
              <Term k="brick" focusable={false}>
                brick
              </Term>
            </>
          }
        >
          {q.isLoading && <Loading text="Running StrongRealization…" />}
          {q.error && <ErrorNote error={q.error} />}
          {q.data && <Final r={q.data} />}
        </Section>

        {q.data && (
          <Section id="sd-trace" title="The recursion, level by level" right={`k = ${q.data.k} down to 1`}>
            <p className="prose mb-3">
              Each level runs <span className="mono">StrongRealization</span> on a set of <Tex tex="2k+1" /> values: its <Term k="interior">interior</Term> (the set
              without the two outer values) is the next level below, and its <Term k="lateral">lateral set</Term> <Tex tex="\Lambda_\pm" /> is chosen by the{' '}
              first and last gaps. The brick of the level is{' '}
              <SymbolTip s="φ">
                <Tex tex="\varphi\bigl((M_\pm,r_\pm),(M',r'),\lambda_0\bigr)" />
              </SymbolTip>
              : the lateral copy and the interior copy of <Tex tex="S_{2k-3}" /> joined by a new edge.
            </p>
            <TraceChain root={q.data.trace} />
          </Section>
        )}
      </div>
    </ThesisLabels>
  )
}
