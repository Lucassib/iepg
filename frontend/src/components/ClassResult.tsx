import type { ClassVerification, Rational } from '../api/types'
import { SpectrumChips } from './BrickSummary'
import { ExactMatrixTable } from './ExactMatrixTable'
import { Tex } from './Tex'

/** The verified spectrum of a matrix built for a threshold graph or a cograph, with the exact polynomial identity. */
export function VerifiedSpectrum({ verification, lam }: { verification: ClassVerification; lam: Rational }) {
  return (
    <div className="space-y-1.5">
      <SpectrumChips entries={verification.spectrum} />
      <p className="font-serif text-sm">
        {verification.product_is_zero ? (
          <>
            <Tex tex="(M + \lambda I)\,M\,(M - \lambda I)(M - 2\lambda I) = 0" />, verified exactly with <Tex tex={`\\lambda = ${lam}`} />, so{' '}
            <Tex tex="\operatorname{DSpec}(M)\subseteq\{-\lambda,0,\lambda,2\lambda\}" /> and <Tex tex={`q(M) = ${verification.q}`} />.
          </>
        ) : (
          <>
            <Tex tex="(M + \lambda I)\,M\,(M - \lambda I)(M - 2\lambda I) \neq 0" />: the verification failed.
          </>
        )}
      </p>
    </div>
  )
}

/** Matrix of exact entries with the approximations on hover. */
export function ClassMatrix({ matrix, approx }: { matrix: string[][]; approx: number[][] }) {
  return (
    <div className="space-y-1">
      <p className="font-sans text-xs text-muted">Exact entries (hover a cell for its approximate value); zeros are shown as ·</p>
      <ExactMatrixTable matrix={matrix} approx={approx} />
    </div>
  )
}
