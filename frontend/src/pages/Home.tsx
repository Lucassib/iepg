import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaygroundSeeds } from '../api/hooks'
import { Section } from '../components/Section'
import { Tex } from '../components/Tex'
import { Button } from '../components/ui/button'
import { CiteChip } from '../components/CiteChip'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { PlaygroundSeedList } from '../components/PlaygroundSeedList'
import { RootedSeedsBlock, SeedsOf } from '../components/CatalogSeeds'
import { SeedSheet, useSeedParam } from '../components/SeedSheet'
import { CITE } from '../lib/citations'
import { playgroundHref, playgroundSeedFor } from '../lib/playground'
import { SymbolTip, Term } from '../components/ThesisTips'
import { Tooltip } from '../components/ui/tooltip'
import { ThesisRef } from '../components/ThesisRef'

const LARGER = [8, 9, 10, 11, 12, 13, 14, 15]

/** Diameters 8 to 15: the seed S_d and the tower seeds the thesis realizes, each opening in the Playground. */
function LargerDiameters() {
  const navigate = useNavigate()
  const [d, setD] = useState(8)
  const q = usePlaygroundSeeds(d)
  return (
    <div className="space-y-3">
      <p className="prose">
        For every diameter the thesis builds the seed <Tex tex="S_d" /> and, from diameter 7 on, the <Term k="tower">tower</Term> seeds, each with a{' '}
        <Term k="brick">brick</Term>. A click opens the seed in the Playground.
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Diameter">
        {LARGER.map((k) => (
          <Tooltip key={k} content={`The seed S_${k} and the tower seeds of diameter ${k}.`}>
            <Button variant={d === k ? 'default' : 'outline'} size="sm" aria-pressed={d === k} onClick={() => setD(k)} className="w-9">
              {k}
            </Button>
          </Tooltip>
        ))}
      </div>
      {q.isLoading && <Loading text={`Loading the seeds of diameter ${d}…`} />}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && <PlaygroundSeedList seeds={q.data} selected={null} onSelect={(id) => navigate(playgroundHref(d, id))} />}
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [seed, setSeed] = useSeedParam()
  // a diminimal seed the thesis realizes opens in the Playground; any other seed opens its certificate here
  const open = (name: string) => {
    const pg = playgroundSeedFor(name)
    if (pg) navigate(playgroundHref(pg.d, pg.id))
    else setSeed(name)
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl">
          <Term k="seed">Seeds</Term>, <Term k="brick">bricks</Term> and the minimum number of distinct eigenvalues of a tree
        </h1>
        <p className="mt-1 font-sans text-sm text-muted">Companion application to the PhD thesis of Lucas Siviero Sibemberg (UFRGS, 2026).</p>
      </div>
      <Section id="home-intro" title="The question" citeKeys={[CITE.johnsonSaiago]}>
        <p className="prose">
          For a tree <Tex tex="T" />,{' '}
          <SymbolTip s="q(T)">
            <Tex tex="q(T)" />
          </SymbolTip>{' '}
          is the minimum number of distinct eigenvalues over the real symmetric matrices whose graph is <Tex tex="T" />. A path of length <Tex tex="d" /> forces{' '}
          <Tex tex="q(T)\geq d+1" />, and <Tex tex="T" /> is{' '}
          <em>
            <Term k="diminimal">diminimal</Term>
          </em>{' '}
          when{' '}
          <SymbolTip s="d(T)">
            <Tex tex="q(T)=d(T)+1" />
          </SymbolTip>{' '}
          <CiteChip citeKey={CITE.johnsonSaiago} />. Every tree is obtained from a unique <em>seed</em> by <Term k="CBD">duplicating branches</Term>, and the
          thesis asks which seeds generate only diminimal trees (the <Term k="diminimal seed">diminimal seeds</Term>). In the summary of the introduction, <ThesisRef label="sec:intro-story" />, with{' '}
          <SymbolTip s="p_d">
            <Tex tex="p_d" />
          </SymbolTip>{' '}
          the proportion of diminimal seeds of diameter <Tex tex="d" />: <Tex tex="p_d=1" /> for <Tex tex="d\leq5" />, <Tex tex="p_6=1/2" />, <Tex tex="p_7=21/78" />,{' '}
          <Tex tex="p_d\to0" /> and <Tex tex="r_d\to\infty" />.
        </p>
      </Section>
      <Section
        id="home-d6"
        title="Diameter 6"
        defaultOpen={false}
        right="12 seeds"
      >
        <p className="prose mb-3">
          <Tex tex="S_6^{(1)},\ldots,S_6^{(6)}" /> are <Term k="diminimal seed">diminimal</Term> and <Tex tex="S_6^{(7)},\ldots,S_6^{(12)}" /> are{' '}
          <Term k="defective seed">defective</Term>. A diminimal seed opens in the Playground, where its matrix is built. A defective seed opens its
          certificate.
        </p>
        <SeedsOf d={6} onSelect={open} selected={seed} />
        <h3 className="mb-2 mt-6 font-serif text-lg font-semibold">
          The twelve <Term k="rooted seed">rooted seeds</Term> of depth 3
        </h3>
        <RootedSeedsBlock />
      </Section>
      <Section
        id="home-d7"
        title="Diameter 7"
        defaultOpen={false}
        right="78 seeds"
      >
        <p className="prose mb-3">
          Every seed of diameter 7 is the composition{' '}
          <SymbolTip s="R_i">
            <Tex tex="R_i\odot R_j" />
          </SymbolTip>{' '}
          of two rooted seeds of depth 3, shown under Diameter 6, with <Tex tex="i\leq j" />. The 21 seeds built from the six <Term k="good">good</Term> rooted
          seeds are <Term k="diminimal seed">diminimal</Term> and open in the Playground. The other 57 are <Term k="defective seed">defective</Term> and open their
          certificate.
        </p>
        <SeedsOf d={7} onSelect={open} selected={seed} matrix />
      </Section>
      <Section
        id="home-large"
        title="Larger diameters"
        defaultOpen={false}
      >
        <LargerDiameters />
      </Section>
      <SeedSheet name={seed} onClose={() => setSeed(null)} />
    </div>
  )
}
