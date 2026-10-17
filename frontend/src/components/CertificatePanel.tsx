import type { Certificate, SeedStatus } from '../api/types'
import { StatusBadge } from './ui/badge'
import { CiteChips } from './CiteChip'
import { TreeView } from './TreeView'
import { ThesisChip } from './ThesisBadges'
import { RefText, SymbolTip, Term } from './ThesisTips'
import type { ReactNode } from 'react'

const KIND_TEXT: Record<Certificate['kind'], ReactNode> = {
  brick: <Term k="brick">brick</Term>,
  non_diminimal_unfolding: (
    <>
      non-diminimal <Term k="unfolding">unfolding</Term>
    </>
  ),
  propagation: 'propagation of defectivity',
  literature: 'literature',
  theorem: 'a theorem of the thesis',
  none: 'no certificate',
}

/** Status badge, summary in thesis wording, thesis labels and reference chips. */
export function CertificatePanel({
  certificate,
  status,
  heading,
  children,
}: {
  certificate: Certificate
  status: SeedStatus
  heading?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <span className="font-sans text-xs text-muted">certificate: {KIND_TEXT[certificate.kind]}</span>
        {heading}
      </div>
      {certificate.summary && (
        <p className="prose text-[0.98rem]">
          <RefText text={certificate.summary} refs={certificate.thesis} />
        </p>
      )}
      {certificate.chain && certificate.chain.steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 font-serif text-sm">
          {certificate.chain.steps.map((s, i) => (
            <li key={i}>
              <RefText text={s} refs={certificate.thesis} />
            </li>
          ))}
        </ol>
      )}
      {certificate.unfolding && (
        <div className="rounded-md border border-line bg-paper p-2">
          <p className="mb-1 font-sans text-xs text-muted">
            Non-diminimal unfolding with {certificate.unfolding.tree.n} vertices,{' '}
            <SymbolTip s="q(T)">
              <span className="mono">q ≥ {certificate.unfolding.q_lower}</span>
            </SymbolTip>
          </p>
          <TreeView tree={certificate.unfolding.tree} />
          <p className="mt-1 font-serif text-sm">
            <RefText text={certificate.unfolding.reason} refs={certificate.thesis} />
          </p>
        </div>
      )}
      {children}
      {(certificate.thesis.length > 0 || certificate.references.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {certificate.thesis.map((t) => (
            <ThesisChip key={t} refText={t} />
          ))}
          <CiteChips keys={certificate.references} />
        </div>
      )}
    </div>
  )
}
