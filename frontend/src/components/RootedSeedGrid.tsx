import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { RootedSeed } from '../api/types'
import { SCALE_GRID, TreeView } from './TreeView'
import { seedLabelTex } from '../lib/seedLabel'
import { Tex } from './Tex'
import { Badge } from './ui/badge'
import { GlossaryTip } from './ThesisTips'

function num(name: string): number {
  const m = /(\d+)$/.exec(name)
  return m ? Number(m[1]) : 0
}

/** The 12 rooted seeds of depth 3: good ones in the first row, defective ones in the second; the deleted branch is grayed. */
export function RootedSeedGrid({ items }: { items: RootedSeed[] }) {
  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => num(a.name) - num(b.name))
    return [sorted.filter((r) => r.good), sorted.filter((r) => !r.good)]
  }, [items])
  return (
    <div className="space-y-4">
      {rows.map((row, k) => (
        <div key={k}>
          <h3 className="mb-2 font-serif text-base font-semibold">{k === 0 ? 'Good rooted seeds' : 'Defective rooted seeds'}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {row.map((r) => (
              <div key={r.name} className="flex flex-col gap-1 rounded-md border border-line bg-surface p-2">
                <div className="flex items-center justify-between gap-2">
                  <Tex tex={r.label} className="font-serif" />
                  <GlossaryTip k={r.good ? 'good' : 'defective'}>
                    <Badge variant={r.good ? 'diminimal' : 'defective'} tabIndex={0} className="cursor-help">
                      {r.good ? 'good' : 'defective'}
                    </Badge>
                  </GlossaryTip>
                </div>
                <div className="rounded bg-paper p-1">
                  <TreeView tree={r.tree} roots={[r.root]} grayVertices={r.deleted_branch} scale={SCALE_GRID} alt={`${r.name}: ${r.canonical}`} />
                </div>
                <span className="font-sans text-xs text-muted">
                  from seed{' '}
                  <Link className="underline decoration-line underline-offset-2 hover:decoration-ink" to={{ search: `?seed=${encodeURIComponent(r.seed_name)}` }}>
                    {seedLabelTex(r.seed_name) ? <Tex tex={seedLabelTex(r.seed_name)!} /> : r.seed_name}
                  </Link>
                  {r.deleted_branch.length > 0 ? `, ${r.deleted_branch.length} vertices deleted` : ' (the seed itself)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
