import { useEffect, useState } from 'react'
import { useRootedSeeds, useSeeds } from '../api/hooks'
import { SeedCardGrid, SeedMatrix } from './SeedGrid'
import { RootedSeedGrid } from './RootedSeedGrid'
import { ErrorNote, Loading } from './ErrorNote'
import { Tex } from './Tex'
import { SymbolTip, Term } from './ThesisTips'

/** The catalog seeds of one diameter, as cards or (diameter 7) as the matrix R_i ⊙ R_j. */
export function SeedsOf({ d, onSelect, selected, matrix = false }: { d: number; onSelect: (n: string) => void; selected: string | null; matrix?: boolean }) {
  const q = useSeeds(d)
  const narrow = useNarrow()
  if (q.isLoading) return <Loading text={`Loading the seeds of diameter ${d}…`} />
  if (q.error) return <ErrorNote error={q.error} />
  if (!q.data || q.data.length === 0) return <p className="font-sans text-sm text-muted">No seeds returned for diameter {d}.</p>
  return matrix ? <SeedMatrix seeds={q.data} onSelect={onSelect} selected={selected} cell={narrow ? 22 : undefined} /> : <SeedCardGrid seeds={q.data} onSelect={onSelect} selected={selected} />
}

/** The twelve rooted seeds of depth 3 (Figure 1.5 of the thesis), with the sentence that says where they come from. */
export function RootedSeedsBlock() {
  const q = useRootedSeeds(3)
  return (
    <div className="space-y-3">
      <p className="prose">
        Each <Term k="rooted seed">rooted seed</Term>{' '}
        <SymbolTip s="R_i">
          <Tex tex="R_1,\ldots,R_{12}" />
        </SymbolTip>{' '}
        is the seed <Tex tex="S_6^{(i)}" /> with one of its two isomorphic <Term k="standard branches">standard branches</Term> deleted, drawn here in gray,
        or the seed itself when its standard branches are pairwise non-isomorphic. <Tex tex="R_1,\ldots,R_6" /> are <Term k="good">good</Term> and{' '}
        <Tex tex="R_7,\ldots,R_{12}" /> are <Term k="defective">defective</Term>. The root is drawn in red.
      </p>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} />}
      {q.data && <RootedSeedGrid items={q.data} />}
    </div>
  )
}

/** Whether the window is as narrow as a phone; the matrix of diameter 7 then uses smaller cells. */
function useNarrow(): boolean {
  const query = '(max-width: 639px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

