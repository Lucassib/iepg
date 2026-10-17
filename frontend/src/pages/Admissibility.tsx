import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Rational } from '../api/types'
import { useAdmissible, useFamily } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { AdmissibleTree } from '../components/AdmissibleTree'
import { ThesisBadges } from '../components/ThesisBadges'
import { ThesisLabels, ThesisRef } from '../components/ThesisRef'
import { Callout, ErrorNote, Loading } from '../components/ErrorNote'
import { Segmented } from '../components/ui/segmented'
import { Button, buttonClass } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { isValidRational, parseRationalList } from '../lib/exact'
import { Tooltip } from '../components/ui/tooltip'
import { GlossaryTip, SymbolTip, Term } from '../components/ThesisTips'

const EXAMPLES: { set: string; text: string }[] = [
  { set: '0,1,3,4,7,8,11,15,19', text: 'admissible' },
  { set: '0,1,3,4,7,8,11,12,16', text: 'not admissible' },
]

/** ?set=0,1,3 in the URL. */
function setFromSearch(search: URLSearchParams): Rational[] | null {
  const t = search.get('set')
  return t ? parseRationalList(t) : null
}

function FamilyGenerator({ onSet }: { onSet: (s: Rational[]) => void }) {
  const [k, setK] = useState('4')
  const [alpha, setAlpha] = useState('0')
  const [beta, setBeta] = useState('16')
  const [which, setWhich] = useState<'1' | '2'>('1')
  const fam = useFamily()
  const kNum = Number(k)
  const kOk = Number.isInteger(kNum) && kNum >= 1 && kNum <= 10
  const ok = kOk && isValidRational(alpha) && isValidRational(beta)
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        fam.mutate(
          { k: kNum, alpha, beta },
          {
            onSuccess: (r) => {
              const row = r.family.find((f) => f.j === kNum) ?? r.family[r.family.length - 1]
              if (row) onSet(which === '1' ? row.Lambda1 : row.Lambda2)
            },
          },
        )
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="fam-k">
            <Tex tex="k" />
          </Label>
          <Tooltip content="k, from 1 to 10: the sets of the family have 2k + 1 elements.">
            <Input id="fam-k" type="number" min={1} max={10} value={k} onChange={(e) => setK(e.target.value)} aria-invalid={!kOk} className="w-16 font-mono" />
          </Tooltip>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fam-a">
            <Tex tex="\alpha" />
          </Label>
          <Tooltip content="α, a rational: the middle element λ_j of the set Λ^(j) of the family.">
            <Input id="fam-a" value={alpha} onChange={(e) => setAlpha(e.target.value)} aria-invalid={!isValidRational(alpha)} className="w-20 font-mono" />
          </Tooltip>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fam-b">
            <Tex tex="\beta" />
          </Label>
          <Tooltip content="β, a rational greater than α, with δ_i = (β − α)/2^i.">
            <Input id="fam-b" value={beta} onChange={(e) => setBeta(e.target.value)} aria-invalid={!isValidRational(beta)} className="w-20 font-mono" />
          </Tooltip>
        </div>
        <Segmented
          label="Which set of the family"
          value={which}
          onChange={setWhich}
          options={[
            {
              value: '1',
              label: <Tex tex="\Lambda_1^{(k)}" />,
              tip: (
                <>
                  The set <Tex tex="\Lambda_{1}^{(k)}" /> of the explicit family (<ThesisRef label="prop:explicit-family" plain />
                  ).
                </>
              ),
            },
            {
              value: '2',
              label: <Tex tex="\Lambda_2^{(k)}" />,
              tip: (
                <>
                  The set <Tex tex="\Lambda_{2}^{(k)}" /> of the explicit family (<ThesisRef label="prop:explicit-family" plain />
                  ).
                </>
              ),
            },
          ]}
        />
        <Tooltip
          content={
            <>
              Computes the chosen set of the explicit family, admissible by <ThesisRef label="prop:explicit-family" plain />, and tests it.
            </>
          }
        >
          <Button type="submit" variant="outline" disabled={!ok || fam.isPending}>
            Generate
          </Button>
        </Tooltip>
      </div>
      <p className="font-sans text-xs text-muted">
        The explicit family of <ThesisRef label="prop:explicit-family" /> with <Tex tex="\delta_i=(\beta-\alpha)/2^i" />; its sets are admissible.
      </p>
      {fam.error && <ErrorNote error={fam.error} />}
    </form>
  )
}

export function AdmissibilityPage() {
  const [search, setSearch] = useSearchParams()
  const urlSet = useMemo(() => setFromSearch(search), [search])
  const [text, setText] = useState(() => (urlSet ? urlSet.join(', ') : EXAMPLES[0].set.split(',').join(', ')))
  const [tested, setTested] = useState<Rational[] | null>(() => urlSet ?? parseRationalList(EXAMPLES[0].set))
  const q = useAdmissible(tested)

  // follow the URL (back / forward, links from other pages)
  useEffect(() => {
    if (urlSet && urlSet.join(',') !== tested?.join(',')) {
      setText(urlSet.join(', '))
      setTested(urlSet)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSet])

  const run = (set: Rational[]) => {
    setText(set.join(', '))
    setTested(set)
    setSearch({ set: set.join(',') }, { replace: true })
  }
  const parsed = parseRationalList(text)
  const data = q.data
  const node = data && 'k' in data.tree ? data.tree : null

  return (
    <ThesisLabels keys={['def:admissible', 'prop:explicit-family', 'thm:C']}>
      <div className="space-y-5">
        <h1 className="text-3xl">
          <Term k="admissible">Admissibility</Term>
        </h1>
        <Section id="adm-definition" title="Admissible sets" defaultOpen={false}>
          <p className="prose">
            <ThesisRef label="def:admissible" />. A set <Tex tex="\Lambda=\{\lambda_0<\cdots<\lambda_{2k}\}" /> with <Tex tex="k\leq1" /> is admissible. For{' '}
            <Tex tex="k\geq2" />, let{' '}
            <SymbolTip s="γ_L">
              <Tex tex="\gamma_L=\lambda_1-\lambda_0" />
            </SymbolTip>{' '}
            and{' '}
            <SymbolTip s="γ_R">
              <Tex tex="\gamma_R=\lambda_{2k}-\lambda_{2k-1}" />
            </SymbolTip>{' '}
            be the first and last gaps. Then <Tex tex="\Lambda" /> is admissible when <Tex tex="\gamma_L\neq\gamma_R" />, the{' '}
            <Term k="interior">interior</Term> <Tex tex="\{\lambda_1,\ldots,\lambda_{2k-1}\}" /> is admissible, and so is the <Term k="lateral">lateral set</Term>:{' '}
            <Tex tex="\Lambda_+=\{\lambda_2,\ldots,\lambda_{2k-1},\mu_+\}" /> with <Tex tex="\mu_+=\lambda_0+\lambda_{2k}-\lambda_1" /> when{' '}
            <Tex tex="\gamma_R>\gamma_L" />, and <Tex tex="\Lambda_-=\{\mu_-,\lambda_1,\ldots,\lambda_{2k-2}\}" /> with{' '}
            <Tex tex="\mu_-=\lambda_0+\lambda_{2k}-\lambda_{2k-1}" /> when <Tex tex="\gamma_L>\gamma_R" />. On an admissible set,{' '}
            <span className="mono">StrongRealization</span>
            <Tex tex="(k,\Lambda)" /> returns a <Term k="brick">brick</Term> <Tex tex="M" /> of <Tex tex="S_{2k-1}" /> with{' '}
            <SymbolTip s="Z(M)">
              <Tex tex="\mathcal Z(M)=\Lambda" />
            </SymbolTip>
            ; on any other set it stops.
          </p>
        </Section>

        <Section id="adm-input" title="Test a set">
          <div className="space-y-4">
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (parsed) run(parsed)
              }}
            >
              <Label htmlFor="adm-set">Set of rationals, comma separated</Label>
              <div className="flex flex-wrap gap-2">
                <Tooltip content="A set of 2k + 1 rationals, separated by commas, in any order.">
                  <Input id="adm-set" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!parsed} className="min-w-0 flex-1 font-mono" />
                </Tooltip>
                <Tooltip
                  content={
                    <>
                      Runs the recursive test of <ThesisRef label="def:admissible" plain /> on the set and draws its recursion tree.
                    </>
                  }
                >
                  <Button type="submit" disabled={!parsed || q.isFetching}>
                    Test
                  </Button>
                </Tooltip>
              </div>
              {!parsed && <p className="font-sans text-xs text-defective">Write rationals such as 0, 1, 3/2, −4, separated by commas.</p>}
            </form>
            <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
              <span className="text-muted">Examples of the thesis figure, k = 4:</span>
              {EXAMPLES.map((ex) => (
                <Tooltip key={ex.set} content={`Tests this set of the figure of the thesis (${ex.text}, k = 4).`}>
                  <Button size="sm" variant="subtle" onClick={() => run(parseRationalList(ex.set)!)}>
                    <span className="mono">{ex.set.split(',').join(', ')}</span>
                    <span className="text-muted">({ex.text})</span>
                  </Button>
                </Tooltip>
              ))}
            </div>
            <div className="border-t border-line pt-3">
              <h3 className="mb-1 font-serif text-base font-semibold">Generate from the explicit family</h3>
              <FamilyGenerator onSet={run} />
            </div>
          </div>
        </Section>

        {tested && (
          <Section id="adm-result" title="The recursion" right={q.isFetching ? 'testing…' : undefined}>
            {q.isLoading && <Loading />}
            {q.error && <ErrorNote error={q.error} />}
            {data && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <GlossaryTip k="admissible">
                    <Badge variant={data.admissible ? 'diminimal' : 'defective'} tabIndex={0} className="cursor-help">
                      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-current" />
                      {data.admissible ? 'admissible' : 'not admissible'}
                    </Badge>
                  </GlossaryTip>
                  <span className="mono font-sans text-sm">{`{${tested.join(', ')}}`}</span>
                  <ThesisBadges labels={data.theorems} className="flex flex-wrap gap-1.5" />
                  {data.admissible && (
                    <span className="ml-auto">
                      <Tooltip
                        content={
                          <>
                            Opens Build S_d on this set: StrongRealization returns a brick of <Tex tex={`S_{${tested.length - 2}}`} /> with this set as its temporary zero
                            set (<ThesisRef label="thm:general_spectra" plain />
                            ).
                          </>
                        }
                      >
                        <Link to={`/lab/build-sd?${new URLSearchParams({ set: tested.join(',') }).toString()}`} className={buttonClass('default', 'sm')}>
                          Build the brick
                        </Link>
                      </Tooltip>
                    </span>
                  )}
                </div>
                {node ? (
                  <>
                    <AdmissibleTree root={node} />
                    <p className="font-sans text-xs text-muted">
                      Each box: the tuple, its first and last gaps{' '}
                      <SymbolTip s="γ_L" underline>
                        γL
                      </SymbolTip>{' '}
                      and{' '}
                      <SymbolTip s="γ_R" underline>
                        γR
                      </SymbolTip>
                      , and the lateral chosen with its new value{' '}
                      <SymbolTip s="μ₊" underline>
                        μ₊
                      </SymbolTip>{' '}
                      or{' '}
                      <SymbolTip s="μ₋" underline>
                        μ₋
                      </SymbolTip>
                      . Solid edges go to the interior and to the lateral child; the dashed muted box is the lateral not taken; muted boxes are the 3-element sets,
                      admissible without a test; the amber box is where the first and last gaps coincide.
                    </p>
                  </>
                ) : (
                  <Callout>{data.tree.fail}</Callout>
                )}
              </div>
            )}
          </Section>
        )}
      </div>
    </ThesisLabels>
  )
}
