import { useMemo } from 'react'
import type { PlaygroundSeed } from '../api/types'
import { MathText, Tex } from './Tex'
import { SCALE_GRID, TreeView } from './TreeView'
import { Term } from './ThesisTips'
import { Tooltip } from './ui/tooltip'
import { cn } from '../lib/cn'

/** The seeds the thesis realizes for one diameter, grouped by construction (the list of step 2 of the Playground). */
const FAMILY_TITLE: Record<string, string> = {
  S_d: 'The seed $S_d$',
  'diameter 6': 'The six diminimal seeds of diameter 6',
  'towers over R_i, R_j': 'Towers over $R_i$ and $R_j$',
  'towers over S_d': 'Towers over $S_d$',
}

function SeedCard({ seed, selected, onSelect }: { seed: PlaygroundSeed; selected: boolean; onSelect: () => void }) {
  return (
    <Tooltip
      content={
        <>
          <MathText text={seed.note} />
          <span className="mt-1 block text-[0.75rem] text-muted">Starts the playground from this seed ({seed.n} vertices).</span>
        </>
      }
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-md border bg-surface p-2 text-left transition-colors hover:border-ink',
          selected ? 'border-ink ring-1 ring-ink' : 'border-line',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <Tex tex={seed.label} className="font-serif" />
          <span className="font-sans text-xs text-muted">n = {seed.n}</span>
        </span>
        <TreeView tree={seed.tree} scale={SCALE_GRID} className="max-h-56 overflow-y-auto rounded bg-paper p-1" alt={`Seed ${seed.id}`} />
      </button>
    </Tooltip>
  )
}

export function PlaygroundSeedList({ seeds, selected, onSelect }: { seeds: PlaygroundSeed[]; selected: string | null; onSelect: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, PlaygroundSeed[]>()
    for (const s of seeds) {
      if (!m.has(s.family)) m.set(s.family, [])
      m.get(s.family)!.push(s)
    }
    return Array.from(m.entries())
  }, [seeds])
  return (
    <div className="space-y-4">
      {groups.map(([family, list]) => (
        <div key={family}>
          <h3 className="mb-1.5 font-serif text-base font-semibold">
            {family.startsWith('towers') ? (
              <>
                <Term k="tower">Towers</Term> <MathText text={(FAMILY_TITLE[family] ?? family).replace(/^Towers /, '')} />
              </>
            ) : (
              <MathText text={FAMILY_TITLE[family] ?? family} />
            )}{' '}
            <span className="font-sans text-xs font-normal text-muted">({list.length})</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {list.map((s) => (
              <SeedCard key={s.id} seed={s} selected={selected === s.id} onSelect={() => onSelect(s.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
