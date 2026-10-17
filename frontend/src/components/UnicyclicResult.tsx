import { useMemo } from 'react'
import type { UnicyclicResponse } from '../api/types'
import { cycleEdges } from '../lib/graph'
import { GraphView } from './GraphView'
import { BoundsPanel } from './BoundsPanel'
import { Tex } from './Tex'

/** The kind of a unicyclic graph with its parameters: C_6, the (4, 3)-tadpole, the sunlet S_5^3. */
export function UnicyclicKindLabel({ r }: { r: UnicyclicResponse }) {
  const p = r.params
  if (r.kind === 'cycle')
    return (
      <span>
        cycle <Tex tex={`C_{${p.n ?? r.graph.n}}`} />
      </span>
    )
  if (r.kind === 'tadpole')
    return (
      <span>
        <Tex tex={`(${p.k}, ${p.n})`} />-tadpole
      </span>
    )
  if (r.kind === 'sunlet')
    return (
      <span>
        sunlet <Tex tex={`S_{${p.n}}^{${p.l}}`} />
      </span>
    )
  return <span>unicyclic graph</span>
}

/** Result of POST /graphs/unicyclic or /graphs/couple: kind, parameters, the graph with its cycle, and the bounds. */
export function UnicyclicResult({ result, showGraph = true }: { result: UnicyclicResponse; showGraph?: boolean }) {
  const cyc = useMemo(() => cycleEdges(result.cycle), [result.cycle])
  const scale = result.graph.n > 24 ? 34 : 42
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans text-sm">
        <span className="font-serif text-base font-semibold">
          <UnicyclicKindLabel r={result} />
        </span>
        <span className="mono text-muted">
          n = {result.graph.n}, girth {result.girth}
        </span>
      </div>
      {showGraph && (
        <div className="rounded-md border border-line bg-paper p-2">
          <GraphView graph={result.graph} scale={scale} highlightEdges={cyc} alt="Unicyclic graph, cycle highlighted" />
          <p className="mt-1 font-sans text-xs text-muted">The cycle is drawn thicker.</p>
        </div>
      )}
      <BoundsPanel lower={result.lower} upper={result.upper} exact={result.exact} />
    </div>
  )
}
