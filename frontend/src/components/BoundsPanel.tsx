import type { BoundItem } from '../api/types'
import { CiteChips } from './CiteChip'
import { SymbolTip } from './ThesisTips'
import { cn } from '../lib/cn'

function Item({ sign, b, name }: { sign: string; b: BoundItem; name: string }) {
  return (
    <li className="space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 font-sans text-sm">
        <SymbolTip s={name === 'T' ? 'q(T)' : 'q(G)'} className="mono font-medium">
          q({name}) {sign} {b.value}
        </SymbolTip>
        <span className="text-xs text-muted">{b.source}</span>
        <CiteChips keys={b.references} />
      </div>
      <p className="font-serif text-sm leading-relaxed">{b.text}</p>
    </li>
  )
}

/** The published bounds on q(G) returned by the graph endpoints: the exact value (highlighted), the lower and upper bounds. */
export function BoundsPanel({ lower, upper, exact, name = 'G', className }: { lower: BoundItem[]; upper: BoundItem | null; exact: BoundItem | null; name?: string; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {exact && (
        <div className="rounded-md border-2 border-ink bg-paper px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-2 font-sans">
            <SymbolTip s={name === 'T' ? 'q(T)' : 'q(G)'} className="mono text-base font-semibold">
              q({name}) = {exact.value}
            </SymbolTip>
            <span className="text-xs text-muted">{exact.source}</span>
            <CiteChips keys={exact.references} />
          </div>
          <p className="mt-0.5 font-serif text-sm leading-relaxed">{exact.text}</p>
        </div>
      )}
      <div>
        <h3 className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-muted">Lower bounds</h3>
        <ul className="space-y-2">
          {lower.map((b, i) => (
            <Item key={i} sign="≥" b={b} name={name} />
          ))}
        </ul>
      </div>
      {upper && (
        <div>
          <h3 className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-muted">Upper bound</h3>
          <ul>
            <Item sign="≤" b={upper} name={name} />
          </ul>
        </div>
      )}
    </div>
  )
}
