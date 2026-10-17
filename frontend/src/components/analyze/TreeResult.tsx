import { useMemo, useState } from 'react'
import type { AnalyzeResponse, Sourced } from '../../api/types'
import { TreeView } from '../TreeView'
import { Tex } from '../Tex'
import { CertificatePanel } from '../CertificatePanel'
import { MatrixView } from '../MatrixView'
import { SpectrumBar } from '../SpectrumBar'
import { UnfoldingPlayer } from '../UnfoldingPlayer'
import { CiteChips, copyText } from '../CiteChip'
import { Callout } from '../ErrorNote'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { KIND_LABEL } from '../../lib/tree'
import { seedLabelTex } from '../../lib/seedLabel'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import { ThesisChip } from '../ThesisBadges'
import { RefText, SymbolTip, Term } from '../ThesisTips'

const FIXED_NOTE = 'Defective is a property of the family 𝒯(S), not of each tree in it.'

function Bound({ label, b }: { label: string; b: Sourced }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-sans text-sm">
      <SymbolTip s="q(T)" className="mono">
        {label} = {b.value}
      </SymbolTip>
      <span className="text-muted">
        — <RefText text={b.source} refs={b.thesis} />
      </span>
      {b.thesis.map((t) => (
        <ThesisChip key={t} refText={t} />
      ))}
      <CiteChips keys={b.references} />
    </div>
  )
}

function Permalink({ canonical }: { canonical: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/tree/${encodeURIComponent(canonical)}`
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
      <span>permalink</span>
      <code className="mono break-all rounded border border-line bg-paper px-1.5 py-0.5 text-ink">{canonical}</code>
      <Tooltip content="Copies the address of this analysis; the canonical string identifies the tree up to isomorphism.">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </Tooltip>
    </div>
  )
}

function SeedName({ name, label }: { name: string | null; label?: string | null }) {
  const tex = label ?? seedLabelTex(name)
  if (tex) return <Tex tex={tex} />
  return name ? <span className="mono">{name}</span> : <>—</>
}

/** The analysis of a tree: the tree, its seed with the unfolding, the status of the seed, the bounds on q(T), a realizing matrix. */
export function TreeResult({ data }: { data: AnalyzeResponse }) {
  const notes = useMemo(() => {
    const list = data.notes ?? []
    return list.some((n) => n.trim().toLowerCase().startsWith('defective is a property')) ? list : [FIXED_NOTE, ...list]
  }, [data])
  return (
    <>
    <Permalink canonical={data.tree.canonical} />
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>The tree</CardTitle>
          <Badge variant="outline">
            <span className="mono">n = {data.tree.n}, d = {data.tree.diameter}</span>
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded-md border border-line bg-paper p-2">
            <TreeView tree={data.tree} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-sans text-sm">
            <dt className="text-muted">vertices</dt>
            <dd className="mono">{data.tree.n}</dd>
            <dt className="text-muted">diameter</dt>
            <dd className="mono">{data.tree.diameter}</dd>
            <dt className="text-muted">
              <Term k="linear trees">linear</Term>
            </dt>
            <dd>{data.tree.linear ? 'yes' : 'no'}</dd>
            <dt className="text-muted">kind</dt>
            <dd>
              {KIND_LABEL[data.tree.kind]}
            </dd>
            <dt className="text-muted">
              <Term k="seed">seed</Term>
            </dt>
            <dd>{data.tree.is_seed ? 'this tree is a seed' : 'not a seed'}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>The seed</CardTitle>
          <Badge variant="outline">{data.seed_name ? <SeedName name={data.seed_name} label={data.seed_label} /> : 'not in the catalog'}</Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.fold_steps.length > 1 ? (
            <UnfoldingPlayer key={data.tree.canonical} steps={data.fold_steps} />
          ) : (
            <div className="rounded-md border border-line bg-paper p-2">
              <TreeView tree={data.seed} />
            </div>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-sans text-sm">
            <dt className="text-muted">name</dt>
            <dd>
              <SeedName name={data.seed_name} label={data.seed_label} />
            </dd>
            <dt className="text-muted">size</dt>
            <dd className="mono">
              n = {data.seed.n}, d = {data.seed.diameter}
            </dd>
            <dt className="text-muted">
              <Term k="CBD">duplications</Term>
            </dt>
            <dd className="mono">{Math.max(0, data.fold_steps.length - 1)}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What we know</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CertificatePanel certificate={data.seed_certificate} status={data.seed_status} />
          <div className="space-y-1 border-t border-line pt-2">
            <h4 className="font-serif text-base font-semibold">
              Bounds on{' '}
              <SymbolTip s="q(T)">
                <Tex tex="q(T)" />
              </SymbolTip>
            </h4>
            {data.q_exact ? (
              <>
                <Bound label="q(T)" b={data.q_exact} />
                <p className="flex flex-wrap items-center gap-1.5 font-sans text-xs text-muted">
                  <SymbolTip s="d(T)" className="mono">
                    lower bound {data.q_lower.value}
                  </SymbolTip>
                  <span>
                    — <RefText text={data.q_lower.source} refs={data.q_lower.thesis} />
                  </span>
                  <CiteChips keys={data.q_lower.references} />
                </p>
              </>
            ) : (
              <>
                <Bound label="q(T) ≥" b={data.q_lower} />
                {data.q_upper && <Bound label="q(T) ≤" b={data.q_upper} />}
              </>
            )}
          </div>
          {data.realization && (
            <div className="space-y-2 border-t border-line pt-2">
              <h4 className="font-serif text-base font-semibold">
                {data.realization.kind === 'exact' ? <Term k="realization">Realizing matrix</Term> : <>A matrix with {data.realization.dspec.length} distinct eigenvalues</>} (root{' '}
                {data.realization.root})
              </h4>
              {data.realization.source && (
                <p className="font-sans text-sm text-muted">
                  <RefText text={data.realization.source} refs={[]} />
                </p>
              )}
              <MatrixView matrix={data.realization.matrix} tree={data.tree} root={data.realization.root} />
              <SpectrumBar values={data.realization.dspec} showList />
            </div>
          )}
          <div className="space-y-2">
            {notes.map((n, i) => (
              <Callout key={i}>{n}</Callout>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  )
}
