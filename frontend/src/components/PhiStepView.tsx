import type { PhiStep } from '../api/types'
import { formatRational } from '../lib/exact'
import { Tex } from './Tex'
import { SymbolTip } from './ThesisTips'

const t = (r: string) => formatRational(r).tex

/** The step φ((X, x), (Y, y), λ): the two values d_x, d_y and the squared weight w² = d_x·d_y of the new edge. */
export function PhiStepView({ phi, first = 'X', second = 'Y' }: { phi: PhiStep; first?: string; second?: string }) {
  return (
    <div className="space-y-1 font-sans text-sm">
      <div>
        <SymbolTip s="φ">
          <Tex tex={`\\varphi\\bigl((${first},x),(${second},y),\\lambda\\bigr)`} />
        </SymbolTip>{' '}
        with <Tex tex={`\\lambda = ${t(phi.lam)}`} />, new edge{' '}
        <span className="mono">
          {phi.edge[0]}–{phi.edge[1]}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Tex tex={`d_x = ${t(phi.dx)}`} />
        <Tex tex={`d_y = ${t(phi.dy)}`} />
        <Tex tex={`w^2 = d_x\\,d_y = ${t(phi.w2)}`} />
      </div>
    </div>
  )
}
