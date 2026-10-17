import { useMemo, useState } from 'react'
import type { TowerRequest } from '../api/types'
import { useTower } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { TreeView } from '../components/TreeView'
import { MatrixView } from '../components/MatrixView'
import { VerificationSummary } from '../components/BrickSummary'
import { TowerPanel } from '../components/TowerView'
import { ThesisBadges } from '../components/ThesisBadges'
import { LabelledText, ThesisLabels, ThesisRef } from '../components/ThesisRef'
import { SymbolTip, Term } from '../components/ThesisTips'
import { Tooltip } from '../components/ui/tooltip'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { Segmented } from '../components/ui/segmented'
import { Button } from '../components/ui/button'
import { Input, Label } from '../components/ui/input'
import { cn } from '../lib/cn'

const IDX = [1, 2, 3, 4, 5, 6]
const DEPTHS = [3, 4, 5, 6, 7, 8, 9]

function PairGrid({ pair, onPick }: { pair: [number, number]; onPick: (p: [number, number]) => void }) {
  return (
    <div className="inline-block">
      <div className="grid gap-1" style={{ gridTemplateColumns: `2.2rem repeat(6, 2.4rem)` }} role="grid" aria-label="Pair of good rooted seeds">
        <span />
        {IDX.map((j) => (
          <span key={'c' + j} className="text-center font-serif text-sm">
            <Tex tex={`R_{${j}}`} />
          </span>
        ))}
        {IDX.map((i) => (
          <div key={'r' + i} className="contents" role="row">
            <span className="self-center pr-1 text-right font-serif text-sm">
              <Tex tex={`R_{${i}}`} />
            </span>
            {IDX.map((j) => {
              const on = pair[0] === i && pair[1] === j
              return (
                <Tooltip
                  key={j}
                  content={
                    <>
                      <Tex tex={`R_{${i}}\\odot R_{${j}}`} />: the two towers over the good rooted seeds <Tex tex={`R_{${i}}`} /> and <Tex tex={`R_{${j}}`} />, and the
                      seed <Tex tex={`S^{(${i},${j})}_{2k+1}`} /> they compose, with a brick (<ThesisRef label="prop:tower-bricks" plain />
                      ).
                    </>
                  }
                >
                  <button
                    type="button"
                    role="gridcell"
                    aria-pressed={on}
                    aria-label={`R${i} and R${j}`}
                    onClick={() => onPick([i, j])}
                    className={cn(
                      'h-8 w-full rounded border font-mono text-[10px] transition-colors',
                      on ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-muted hover:border-ink hover:text-ink',
                    )}
                  >
                    {i},{j}
                  </button>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TowersPage() {
  const [base, setBase] = useState<'pair' | 'sd'>('pair')
  const [pair, setPair] = useState<[number, number]>([2, 5])
  const [b, setB] = useState('4')
  const [k, setK] = useState(5)
  const [even, setEven] = useState(false)
  const bNum = Number(b)
  const bOk = Number.isInteger(bNum) && bNum >= 4 && bNum <= k
  const req = useMemo<TowerRequest | null>(() => {
    if (base === 'pair') return { pair, k, even }
    return bOk ? { b: bNum, k, even } : null
  }, [base, pair, k, even, bOk, bNum])
  const q = useTower(req)
  const data = q.data
  const reqKey = JSON.stringify(req)

  return (
    <ThesisLabels keys={['prop:tower-bricks', 'def:tower', 'def:abd']}>
      <div className="space-y-5">
        <h1 className="text-3xl">
          <Term k="tower">Towers</Term>
        </h1>
        <Section id="towers-def" title="Towers of rooted trees" defaultOpen={false}>
          <p className="prose">
            A tower of depth <Tex tex="k" /> over a <Term k="base pair">base pair</Term> <Tex tex="(H_{h-1},H_h)" /> is the sequence <Tex tex="H_{h-1},H_h,\ldots,H_k" />{' '}
            with <Tex tex="H_j=H_{j-2}\odot H_{j-1}" />: each <Term k="levels">level</Term> composes the two previous ones, rooted at the root of the copy of{' '}
            <Tex tex="H_{j-2}" />, and the copy of <Tex tex="H_{j-1}" /> is its unique deepest branch. <span className="mono">TowerChain</span> builds the matrices level
            by level: the sets grow from the outside, one new value on each side, and each level is{' '}
            <SymbolTip s="φ">
              <Tex tex="\varphi\bigl((X_{j-2},r_{j-2}),(X_{j-1},r_{j-1}),\min A_j\bigr)" />
            </SymbolTip>
            . Two towers of depth <Tex tex="k" />, composed by their roots, give a <Term k="seed">seed</Term> of diameter <Tex tex="2k+1" /> with a{' '}
            <Term k="brick">brick</Term>, and a <Term k="ABD">regular 1-ABD</Term> gives one of diameter <Tex tex="2k+2" />.
          </p>
        </Section>

        <Section id="towers-input" title="Base pair and depth">
          <div className="space-y-4">
            <Segmented
              label="Base"
              value={base}
              onChange={setBase}
              options={[
                {
                  value: 'pair',
                  label: (
                    <>
                      two good rooted seeds <Tex tex="R_i, R_j" />
                    </>
                  ),
                  tip: (
                    <>
                      Towers whose base pairs come from two of the six good rooted seeds <Tex tex="R_1,\ldots,R_6" /> of depth 3; pick the pair in the grid.
                    </>
                  ),
                },
                {
                  value: 'sd',
                  label: (
                    <>
                      the seeds <Tex tex="S_d" /> as base
                    </>
                  ),
                  tip: (
                    <>
                      The towers <Tex tex="\widehat B_b" /> over the pair <Tex tex="(S_{2b-3},S_{2b-1})" />, for <Tex tex="4\leq b\leq k" />.
                    </>
                  ),
                },
              ]}
            />
            {base === 'pair' ? (
              <PairGrid pair={pair} onPick={setPair} />
            ) : (
              <div className="space-y-1">
                <Label htmlFor="tw-b">
                  <Tex tex="b" /> (4 ≤ b ≤ k)
                </Label>
                <Tooltip content={`b, from 4 to k = ${k}: the base pair of the towers is (S_{2b−3}, S_{2b−1}).`}>
                  <Input id="tw-b" type="number" min={4} max={k} value={b} onChange={(e) => setB(e.target.value)} aria-invalid={!bOk} className="w-20 font-mono" />
                </Tooltip>
                <p className="font-sans text-xs text-muted">
                  The towers <Tex tex="\widehat B_b" /> over the pair <Tex tex="(S_{2b-3},S_{2b-1})" />.
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-sans text-xs font-medium text-muted">depth k</span>
              <div className="flex gap-1" role="group" aria-label="Depth">
                {DEPTHS.map((d) => (
                  <Tooltip key={d} content={`Depth k = ${d} of both towers: the composed seed has diameter ${2 * d + 1}, or ${2 * d + 2} with the even diameter.`}>
                    <Button size="sm" className="w-8" variant={k === d ? 'default' : 'outline'} aria-pressed={k === d} onClick={() => setK(d)}>
                      {d}
                    </Button>
                  </Tooltip>
                ))}
              </div>
              <Tooltip content="Adds a regular 1-ABD to the composed brick: a seed of diameter 2k + 2 instead of 2k + 1.">
                <label className="inline-flex cursor-pointer items-center gap-2 font-sans text-sm">
                  <input type="checkbox" checked={even} onChange={(e) => setEven(e.target.checked)} className="accent-[var(--text)]" />
                  even diameter
                </label>
              </Tooltip>
            </div>
            {!bOk && base === 'sd' && <p className="font-sans text-xs text-defective">Choose b between 4 and k = {k}.</p>}
          </div>
        </Section>

        <Section id="towers-levels" title="The two towers" right={q.isFetching ? 'building…' : undefined}>
          {q.isLoading && <Loading text="Running TowerChain…" />}
          {q.error && <ErrorNote error={q.error} />}
          {data && (
            <div className={cn('grid gap-6 lg:grid-cols-2', q.isPlaceholderData && 'opacity-60')}>
              {data.towers.map((t, i) => (
                <TowerPanel key={reqKey + ':' + i} tower={t} />
              ))}
            </div>
          )}
        </Section>

        {data && (
          <Section id="towers-seed" title={`The composed seed, diameter ${data.seed.d}`}>
            <div className="space-y-4">
              <p className="prose">
                <LabelledText text={data.seed.method} />
              </p>
              {data.fail && <p className="font-sans text-sm text-defective">{data.fail}</p>}
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-2">
                  {data.seed.draw && data.seed.tree ? (
                    <div className="rounded-md border border-line bg-paper p-2">
                      <TreeView tree={data.seed.tree} scale={data.seed.n > 60 ? 26 : 40} alt={`Composed seed of diameter ${data.seed.d}`} />
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-line bg-paper px-3 py-2 font-sans text-sm text-muted">
                      {data.seed.n} vertices: too many to draw.
                    </p>
                  )}
                  <p className="mono font-sans text-xs text-muted">
                    n = {data.seed.n}, d = {data.seed.d}
                  </p>
                  {data.seed.matrix && data.seed.tree && <MatrixView matrix={data.seed.matrix} tree={data.seed.tree} />}
                </div>
                <VerificationSummary v={data.seed.verification} />
              </div>
              <p className="font-serif text-sm">{data.count.text}</p>
              <ThesisBadges labels={data.theorems} />
            </div>
          </Section>
        )}
      </div>
    </ThesisLabels>
  )
}
