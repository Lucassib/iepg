import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCounts, useRootedSeeds } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { CiteChip } from '../components/CiteChip'
import { ThesisRef } from '../components/ThesisRef'
import { RootedSeedGrid } from '../components/RootedSeedGrid'
import { RootedSeedsBlock, SeedsOf } from '../components/CatalogSeeds'
import { SeedSheet, useSeedParam } from '../components/SeedSheet'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { CITE } from '../lib/citations'
import { SymbolTip, Term } from '../components/ThesisTips'

export function TreesSmallPage() {
  const [seed, setSeed] = useSeedParam()
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Trees of diameter at most 5</h1>
      <Section
        id="small-statement"
        title="Every tree of diameter at most 5 is diminimal"
        heading={
          <>
            Every tree of diameter at most 5 is{' '}
            <Term k="diminimal" focusable={false}>
              diminimal
            </Term>
          </>
        }
        citeKeys={[CITE.johnsonSaiago]}
      >
        <p className="prose">
          Johnson and Saiago proved that every tree of diameter at most 5 is diminimal <CiteChip citeKey={CITE.johnsonSaiago} />, so{' '}
          <SymbolTip s="p_d">
            <Tex tex="p_d=1" />
          </SymbolTip>{' '}
          for <Tex tex="d\leq5" />. The <Term k="seed">seeds</Term> are few:{' '}
          <SymbolTip s="s_d">
            <Tex tex="s_2,\ldots,s_5=1,1,2,3" />
          </SymbolTip>
          . They are seeds of <ThesisRef label="def:Sd" /> and <ThesisRef label="def_seeds" />, and the thesis also gives a brick of each of them (
          <ThesisRef label="sec:new-seeds-bricks" />).
        </p>
      </Section>
      {[2, 3, 4, 5].map((d) => (
        <Section key={d} id={`small-d${d}`} title={`Diameter ${d}`} defaultOpen={d >= 4}>
          <SeedsOf d={d} onSelect={setSeed} selected={seed} />
        </Section>
      ))}
      <SeedSheet name={seed} onClose={() => setSeed(null)} />
    </div>
  )
}

export function TreesD6Page() {
  const [seed, setSeed] = useSeedParam()
  const { hash } = useLocation()
  useEffect(() => {
    // /trees/d6#rooted-seeds (the old address of the rooted seeds page) scrolls to their section
    if (hash !== '#rooted-seeds') return
    const t = window.setTimeout(() => document.querySelector('[data-section="d6-rooted"]')?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [hash])
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Trees of diameter 6</h1>
      <Section
        id="d6-grid"
        title="The twelve seeds of diameter 6"
        heading={
          <>
            The twelve{' '}
            <Term k="seed" focusable={false}>
              seeds
            </Term>{' '}
            of diameter 6
          </>
        }
      >
        <p className="prose mb-3">
          Figure 1.4 of the thesis: <Tex tex="S_6^{(1)},\ldots,S_6^{(6)}" /> are <Term k="diminimal seed">diminimal</Term> and{' '}
          <Tex tex="S_6^{(7)},\ldots,S_6^{(12)}" /> are <Term k="defective seed">defective</Term>. Click a seed for its certificate: the{' '}
          <Term k="brick">brick</Term> matrix and spectrum when it is diminimal, the non-diminimal <Term k="unfolding">unfolding</Term> or propagation chain when
          it is defective.
        </p>
        <SeedsOf d={6} onSelect={setSeed} selected={seed} />
      </Section>
      <Section
        id="d6-rooted"
        className="scroll-mt-20"
        title="The twelve rooted seeds of depth 3"
        heading={
          <>
            The twelve{' '}
            <Term k="rooted seed" focusable={false}>
              rooted seeds
            </Term>{' '}
            of depth 3
          </>
        }
      >
        <RootedSeedsBlock />
      </Section>
      <Section id="d6-footnote" title="Counts and numbering" citeKeys={[CITE.johnsonSaiago]} defaultOpen={false}>
        <p className="prose">
          <SymbolTip s="p_d">
            <Tex tex="p_6=1/2" />
          </SymbolTip>{' '}
          and{' '}
          <SymbolTip s="C(d)">
            <Tex tex="C(6)=8" />
          </SymbolTip>
          . The numbering of the seeds follows the thesis.
        </p>
      </Section>
      <SeedSheet name={seed} onClose={() => setSeed(null)} />
    </div>
  )
}

export function TreesD7Page() {
  const [seed, setSeed] = useSeedParam()
  const rooted = useRootedSeeds(3)
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Trees of diameter 7</h1>
      <Section
        id="d7-rooted"
        title="The twelve rooted seeds of depth 3"
        heading={
          <>
            The twelve{' '}
            <Term k="rooted seed" focusable={false}>
              rooted seeds
            </Term>{' '}
            of depth 3
          </>
        }
        defaultOpen={false}
        right={<Link to="/trees/d6#rooted-seeds" className="underline decoration-line underline-offset-2">with the seeds of diameter 6</Link>}>
        {rooted.isLoading && <Loading />}
        {rooted.error && <ErrorNote error={rooted.error} />}
        {rooted.data && <RootedSeedGrid items={rooted.data} />}
      </Section>
      <Section
        id="d7-matrix"
        title="The 78 seeds R_i ⊙ R_j"
        heading={
          <>
            The 78{' '}
            <Term k="seed" focusable={false}>
              seeds
            </Term>{' '}
            <Tex tex="R_i\odot R_j" />
          </>
        }
      >
        <p className="prose mb-3">
          Every seed of diameter 7 is the composition{' '}
          <SymbolTip s="R_i">
            <Tex tex="R_i\odot R_j" />
          </SymbolTip>{' '}
          of two rooted seeds of depth 3, <Tex tex="i\leq j" />. The 21 seeds built from the six <Term k="good">good</Term> rooted seeds are{' '}
          <Term k="diminimal seed">diminimal</Term>, the other 57 are <Term k="defective seed">defective</Term>.
        </p>
        <SeedsOf d={7} onSelect={setSeed} selected={seed} matrix />
      </Section>
      <Section id="d7-footnote" title="Counts" defaultOpen={false}>
        <p className="prose">
          <SymbolTip s="p_d">
            <Tex tex="p_7=21/78" />
          </SymbolTip>
          . The value of{' '}
          <SymbolTip s="C(d)">
            <Tex tex="C(7)" />
          </SymbolTip>{' '}
          is open, see the{' '}
          <Link to="/questions" className="underline decoration-line underline-offset-2">
            open questions
          </Link>
          .
        </p>
      </Section>
      <SeedSheet name={seed} onClose={() => setSeed(null)} />
    </div>
  )
}

export function TreesLargePage() {
  const counts = useCounts()
  const [seed, setSeed] = useSeedParam()
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Larger diameters</h1>
      <Section
        id="large-sd"
        title="The seeds S_d"
        heading={
          <>
            The{' '}
            <Term k="seed" focusable={false}>
              seeds
            </Term>{' '}
            <Tex tex="S_d" />
          </>
        }
      >
        <p className="prose mb-3">
          For every <Tex tex="d" /> the thesis builds a <Term k="diminimal seed">diminimal seed</Term>{' '}
          <SymbolTip s="S_d">
            <Tex tex="S_d" />
          </SymbolTip>{' '}
          recursively, with a <Term k="brick">brick</Term> given by <span className="mono">RealizeTree</span>. The dashed edges are the composition edges of the
          recursion. The seeds built from <Term k="tower">towers</Term>, which give the lower bounds for <Tex tex="r_d" />, are built level by level in the{' '}
          <Link to="/lab/towers" className="underline decoration-line underline-offset-2 hover:decoration-ink">
            tower laboratory
          </Link>
          .
        </p>
        <div className="space-y-4">
          {[8, 9, 10, 11].map((d) => (
            <div key={d}>
              <h3 className="mb-1 font-serif text-base font-semibold">
                <Tex tex={`S_{${d}}`} />
              </h3>
              <SeedsOf d={d} onSelect={setSeed} selected={seed} />
            </div>
          ))}
        </div>
      </Section>
      <Section id="large-counts" title="Counts">
        {counts.isLoading && <Loading />}
        {counts.error && <ErrorNote error={counts.error} />}
        {counts.data && (
          <div className="grid gap-4 md:grid-cols-3 font-sans text-sm">
            <table className="border-collapse">
              <caption className="text-left text-xs text-muted">
                <SymbolTip s="ρ_k">
                  <Tex tex="\rho_k" />
                </SymbolTip>
              </caption>
              <tbody>
                {Object.entries(counts.data.E).map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="mono pr-3 py-0.5">{k}</td>
                    <td className="mono py-0.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="border-collapse">
              <caption className="text-left text-xs text-muted">
                <SymbolTip s="s_d">
                  <Tex tex="s_d" />
                </SymbolTip>
              </caption>
              <tbody>
                {Object.entries(counts.data.s).map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <td className="mono pr-3 py-0.5">{k}</td>
                    <td className="mono py-0.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="border-collapse">
              <caption className="text-left text-xs text-muted">
                <SymbolTip s="p_d">
                  <Tex tex="p_d" />
                </SymbolTip>{' '}
                (exact values and upper bounds)
              </caption>
              <tbody>
                {counts.data.bounds.map((b, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="mono pr-3 py-0.5">{String(b.d)}</td>
                    <td className="mono pr-3 py-0.5">{b.p !== undefined ? `= ${b.p}` : b.p_limit !== undefined ? `→ ${b.p_limit}` : `≤ ${b.p_upper ?? '?'}`}</td>
                    <td className="text-muted py-0.5">{b.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <SeedSheet name={seed} onClose={() => setSeed(null)} />
    </div>
  )
}
