import { useMemo } from 'react'
import type { Rational, SpectrumEntry, Verification } from '../api/types'
import { multiplicityTex, rationalNum, sortRationals, rationalToNumber } from '../lib/exact'
import { Tex } from './Tex'
import { NumList, SpectrumBar } from './SpectrumBar'
import { Badge } from './ui/badge'
import { GlossaryTip, SymbolTip } from './ThesisTips'

/** Distinct eigenvalues with multiplicities, sorted, from a lab Verification. */
export function verificationSpectrum(v: Verification): SpectrumEntry[] {
  return sortRationals(v.dspec).map((value) => ({ value, multiplicity: v.multiplicities[value] ?? 1 }))
}

/** "Spec(M) = { −5^[1], 0^[1], 3^[2], … }" as wrapping chips, in the notation of the thesis. */
export function SpectrumChips({ entries, name = 'M', label = 'Spec' }: { entries: SpectrumEntry[]; name?: string; label?: string }) {
  const sorted = useMemo(() => [...entries].sort((a, b) => rationalToNumber(a.value) - rationalToNumber(b.value)), [entries])
  return (
    <div className="flex flex-wrap items-baseline gap-1 font-sans text-sm">
      <span className="mr-1 whitespace-nowrap">
        <SymbolTip s={label === 'DSpec' ? 'DSpec(M)' : 'Spec(M)'}>
          <Tex tex={`\\operatorname{${label}}(${name})`} />
        </SymbolTip>{' '}
        <span className="text-muted">=</span>
      </span>
      {sorted.map((e) => (
        <span key={e.value} className="rounded border border-line bg-surface px-1.5 py-0.5" title={`${e.value} with multiplicity ${e.multiplicity}`}>
          <Tex tex={multiplicityTex(e.value, e.multiplicity)} />
        </span>
      ))}
    </div>
  )
}

/** The brick verdict, with the definition of a brick (Definition 6.9 in the current numbering) in a tooltip. */
export function IsBrickBadge({ isBrick }: { isBrick: boolean }) {
  return (
    <GlossaryTip k="brick">
      <Badge variant={isBrick ? 'diminimal' : 'defective'} tabIndex={0} className="cursor-help">
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-current" />
        {isBrick ? 'brick' : 'not a brick'}
      </Badge>
    </GlossaryTip>
  )
}

/** Spectrum with multiplicities, latent and confined values, the brick verdict and its reason. */
export function BrickSummary({
  spectrum,
  latent,
  confined,
  isBrick,
  reason,
  q,
  name = 'M',
}: {
  spectrum: SpectrumEntry[]
  latent: Rational[]
  confined: Rational[]
  isBrick: boolean
  reason: string
  q?: number
  name?: string
}) {
  const values = useMemo(() => spectrum.map((e) => rationalNum(e.value)), [spectrum])
  const lat = useMemo(() => sortRationals(latent).map(rationalNum), [latent])
  const conf = useMemo(() => sortRationals(confined).map(rationalNum), [confined])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
        <IsBrickBadge isBrick={isBrick} />
        <SymbolTip s="q(M)" className="mono text-muted">
          q({name}) = {q ?? spectrum.length}
        </SymbolTip>
      </div>
      <SpectrumChips entries={spectrum} name={name} />
      <SpectrumBar values={values} latent={lat} confined={conf} />
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 font-sans text-sm">
        <dt>
          <SymbolTip s="Δ(M)">
            <Tex tex={`\\Delta(${name})`} /> <span className="text-xs text-muted">latent</span>
          </SymbolTip>
        </dt>
        <dd>
          <NumList values={lat} hollow />
        </dd>
        <dt>
          <SymbolTip s="Δ_c(M)">
            <Tex tex={`\\Delta_c(${name})`} /> <span className="text-xs text-muted">confined</span>
          </SymbolTip>
        </dt>
        <dd>
          <NumList values={conf} hollow />
        </dd>
      </dl>
      {reason && <p className="font-serif text-sm leading-relaxed">{reason}</p>}
    </div>
  )
}

/** BrickSummary of a lab Verification. */
export function VerificationSummary({ v, name }: { v: Verification; name?: string }) {
  const spectrum = useMemo(() => verificationSpectrum(v), [v])
  return <BrickSummary spectrum={spectrum} latent={v.latent} confined={v.confined} isBrick={v.is_brick} reason={v.reason} q={v.q} name={name} />
}
