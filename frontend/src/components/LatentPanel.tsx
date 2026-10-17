import { useMemo, useState } from 'react'
import type { LatentResponse, Num, TreeInfo } from '../api/types'
import { TreeView } from './TreeView'
import { SpectrumBar, NumList } from './SpectrumBar'
import { Tex } from './Tex'
import { numText } from '../lib/exact'
import { SymbolTip, Term } from './ThesisTips'
import { ThesisRef } from './ThesisRef'

/** Result of POST /latent: DSpec, Z, latent and confined values, witnesses, brick verdict and the bound. */
export function LatentPanel({ result, tree, root }: { result: LatentResponse; tree: TreeInfo; root: number }) {
  const [hover, setHover] = useState<Num | null>(null)
  const mainRoots = useMemo(() => new Set([...tree.main_roots, root]), [tree.main_roots, root])

  const witnessesOf = (v: Num): number[] =>
    result.witnesses[v.exact] ?? (v.display !== undefined ? result.witnesses[v.display] : undefined) ?? result.witnesses[String(v.approx)] ?? []

  const reason = useMemo(() => {
    if (result.is_brick) return null
    for (const v of result.latent) {
      const bad = witnessesOf(v).filter((w) => !mainRoots.has(w))
      if (bad.length > 0) return { value: v, vertex: bad[0] }
    }
    return null
    // witnessesOf is stable for a given result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, mainRoots])

  const highlighted = hover ? witnessesOf(hover) : []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-md border border-line bg-paper p-2">
          <TreeView tree={tree} roots={[root]} showIds highlight={highlighted} alt={`Latent values on ${tree.canonical}`} />
          <p className="mt-1 font-sans text-xs text-muted">
            Hover a value to highlight the vertices where its temporary zero appears (<Term k="temporary value">temporary value</Term>{' '}
            <Tex tex="\hat d_v=0" />
            ).
          </p>
        </div>
        <div className="space-y-2">
          <SpectrumBar values={result.dspec} latent={result.latent} confined={result.confined} onHover={setHover} />
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 font-sans text-sm">
            <dt>
              <SymbolTip s="DSpec(M)">
                <Tex tex="\mathrm{DSpec}(M)" />
              </SymbolTip>
            </dt>
            <dd>
              <NumList values={result.dspec} onHover={setHover} active={hover?.exact ?? null} />
            </dd>
            <dt>
              <SymbolTip s="Z(M)">
                <Tex tex="\mathcal Z(M)" />
              </SymbolTip>
            </dt>
            <dd>
              <NumList values={result.Z} onHover={setHover} active={hover?.exact ?? null} />
            </dd>
            <dt>
              <SymbolTip s="Δ(M)">
                <Tex tex="\Delta(M)" />
              </SymbolTip>
            </dt>
            <dd>
              <NumList values={result.latent} onHover={setHover} active={hover?.exact ?? null} hollow />
            </dd>
            <dt>
              <SymbolTip s="Δ_c(M)">
                <Tex tex="\Delta_c(M)" />
              </SymbolTip>
            </dt>
            <dd>
              <NumList values={result.confined} onHover={setHover} active={hover?.exact ?? null} hollow />
            </dd>
          </dl>
        </div>
      </div>
      <div className="rounded-md border border-line bg-surface px-3 py-2 font-serif text-sm leading-relaxed">
        <p className="font-semibold">
          {result.is_brick ? (
            <>
              <Tex tex="M" /> is a <Term k="brick">brick</Term>.
            </>
          ) : reason ? (
            <>
              <Tex tex="M" /> is not a <Term k="brick">brick</Term>, because the latent value <span className="mono">{numText(reason.value)}</span> has a temporary zero at vertex{' '}
              {reason.vertex}, which is not a <Term k="main root">main root</Term>.
            </>
          ) : (
            <>
              <Tex tex="M" /> is not a <Term k="brick">brick</Term>.
            </>
          )}
        </p>
        <p className="mt-1">
          <SymbolTip s="q(M)">
            <Tex tex={`q(M) = ${result.q_M}`} />
          </SymbolTip>
          , and{' '}
          <SymbolTip s="c(M)">
            <Tex tex={`|\\mathcal Z(M)| - |\\Delta_c(M)| = ${result.bound}`} />
          </SymbolTip>{' '}
          is the bound of <ThesisRef label="prop:latent-bound" />.
          {result.is_brick && (
            <>
              {' '}
              Since <Tex tex="M" /> is a brick, every unfolding of this tree is diminimal (<ThesisRef label="thm:brick-diminimal" />).
            </>
          )}
        </p>
        {result.latent.length > 0 && (
          <ul className="mt-2 space-y-0.5 font-sans text-xs text-muted">
            {result.latent.map((v) => (
              <li key={v.exact}>
                <span className="mono">{numText(v)}</span>: temporary zeros at {witnessesOf(v).length > 0 ? witnessesOf(v).join(', ') : 'no vertex'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
