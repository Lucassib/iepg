import { useMemo, useState } from 'react'
import type { Rational, TraceNode } from '../api/types'
import { SetLine } from './SetLine'
import { PhiStepView } from './PhiStepView'
import { TreeView } from './TreeView'
import { MatrixView } from './MatrixView'
import { Tex } from './Tex'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tooltip } from './ui/tooltip'
import { SymbolTip, Term } from './ThesisTips'
import { COPY_A, COPY_B } from '../lib/colors'
import { formatRational } from '../lib/exact'
import { cn } from '../lib/cn'

/** The nodes of the recursion along the interior children: Λ, Λ₀, Λ₀₀, …, from level k down to 1. */
export function mainChain(root: TraceNode): TraceNode[] {
  const out: TraceNode[] = []
  let n: TraceNode | null = root
  while (n) {
    out.push(n)
    n = n.interior
  }
  return out
}

const tx = (r: Rational) => formatRational(r).tex
const par = (r: Rational) => (r.trim().startsWith('-') ? `(${tx(r)})` : tx(r))

function GapsText({ node }: { node: TraceNode }) {
  const { k, set } = node
  if (k <= 1) {
    return (
      <p className="font-serif text-sm">
        <Tex tex="k=1" />: <span className="mono">BaseStrongRealization</span> joins two <Tex tex="1\times1" /> matrices by <Tex tex="\varphi" />, which gives the brick of{' '}
        <Tex tex="S_1=P_2" />.
      </p>
    )
  }
  if (node.gammaL === null || node.gammaR === null) return node.fail ? <p className="font-serif text-sm text-defective">{node.fail}</p> : null
  const l0 = set[0]
  const l1 = set[1]
  const lb = set[2 * k - 1]
  const lt = set[2 * k]
  const gaps = (
    <>
      First and last gaps{' '}
      <SymbolTip s="γ_L">
        <Tex tex={`\\gamma_L=\\lambda_1-\\lambda_0=${tx(node.gammaL)}`} />
      </SymbolTip>
      ,{' '}
      <SymbolTip s="γ_R">
        <Tex tex={`\\gamma_R=\\lambda_{${2 * k}}-\\lambda_{${2 * k - 1}}=${tx(node.gammaR)}`} />
      </SymbolTip>
    </>
  )
  if (node.choice === '+')
    return (
      <p className="font-serif text-sm leading-relaxed">
        {gaps}. Since <Tex tex="\gamma_R>\gamma_L" />, the <Term k="lateral">lateral set</Term> is <Tex tex={`\\Lambda_+=\\{\\lambda_2,\\ldots,\\lambda_{${2 * k - 1}},\\mu_+\\}`} /> with{' '}
        <SymbolTip s="μ₊">
          <Tex tex={`\\mu_+=\\lambda_0+\\lambda_{${2 * k}}-\\lambda_1=${tx(l0)}+${par(lt)}-${par(l1)}=${tx(node.mu ?? '?')}`} />
        </SymbolTip>
        .
      </p>
    )
  if (node.choice === '-')
    return (
      <p className="font-serif text-sm leading-relaxed">
        {gaps}. Since <Tex tex="\gamma_L>\gamma_R" />, the <Term k="lateral">lateral set</Term> is <Tex tex={`\\Lambda_-=\\{\\mu_-,\\lambda_1,\\ldots,\\lambda_{${2 * k - 2}}\\}`} /> with{' '}
        <SymbolTip s="μ₋">
          <Tex tex={`\\mu_-=\\lambda_0+\\lambda_{${2 * k}}-\\lambda_{${2 * k - 1}}=${tx(l0)}+${par(lt)}-${par(lb)}=${tx(node.mu ?? '?')}`} />
        </SymbolTip>
        .
      </p>
    )
  return (
    <p className="font-serif text-sm leading-relaxed">
      {gaps}. {node.gammaL === node.gammaR ? <span className="text-defective">The first and last gaps coincide: the recursion stops.</span> : <span className="text-defective">{node.fail}</span>}
    </p>
  )
}

function Swatch({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border" style={{ background: color, borderColor: color }} />
      {children}
    </span>
  )
}

/** One node of StrongRealization(k, Λ): set, gaps, lateral, φ step, tree with both copies colored, matrix, and its children on demand. */
export function TraceNodeCard({ node, onChain = false, role }: { node: TraceNode; onChain?: boolean; role?: 'lateral' | 'interior' }) {
  const [lat, setLat] = useState(false)
  const [int, setInt] = useState(false)
  const [matrix, setMatrix] = useState(false)
  const colors = useMemo(() => {
    const c: Record<string, string> = {}
    for (const v of node.phi?.left ?? []) c[String(v)] = COPY_A
    for (const v of node.phi?.right ?? []) c[String(v)] = COPY_B
    return c
  }, [node.phi])
  const outer = node.k >= 2 ? [node.set[0], node.set[node.set.length - 1]] : []
  const markers = node.mu && node.choice ? [{ value: node.mu, label: node.choice === '+' ? 'μ₊' : 'μ₋' }] : []
  const d = 2 * node.k - 1
  return (
    <div className={cn('space-y-3 rounded-md border bg-surface p-3', node.ok ? 'border-line' : 'border-defective')}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-base font-semibold">
          {role && <span className="font-sans text-xs font-normal text-muted">{role} child · </span>}
          Level <Tex tex={`k=${node.k}`} />: <Tex tex={`S_{${d}}`} />
        </h3>
        {node.n !== null && <span className="mono font-sans text-xs text-muted">n = {node.n}</span>}
        <Badge variant={node.ok ? 'outline' : 'defective'}>{node.ok ? 'realized' : 'stops'}</Badge>
      </div>
      <div>
        <SetLine values={node.set} highlight={outer} markers={markers} />
        {outer.length > 0 && (
          <p className="font-sans text-xs text-muted">
            The two outer values <Tex tex="\lambda_0" /> and <Tex tex={`\\lambda_{${2 * node.k}}`} /> (amber) are the ones not in the{' '}
            <Term k="interior">interior</Term> set.
          </p>
        )}
      </div>
      <GapsText node={node} />
      {node.phi && <PhiStepView phi={node.phi} first={node.k > 1 ? `M_${node.choice === '-' ? '-' : '+'}` : 'X'} second={node.k > 1 ? "M'" : 'Y'} />}
      {node.tree && (
        <div className="space-y-1">
          <div className="rounded-md border border-line bg-paper p-2">
            <TreeView tree={node.tree} vertexColors={colors} dashedEdges={node.phi ? [node.phi.edge] : undefined} showIds alt={`S_${d} at level ${node.k}`} />
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-muted">
            <Swatch color={COPY_A}>lateral copy</Swatch>
            <Swatch color={COPY_B}>interior copy</Swatch>
            <span>
              dashed: the edge of{' '}
              <SymbolTip s="φ" underline>
                φ
              </SymbolTip>
              ; red: the <Term k="main root">main roots</Term>
            </span>
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {node.matrix && node.tree && (
          <Tooltip content={matrix ? 'Hides the matrix of this level.' : `Shows the matrix of this level, the brick of S_${d} built by φ, as a table or drawn on its tree.`}>
            <Button size="sm" variant="outline" aria-expanded={matrix} onClick={() => setMatrix((x) => !x)}>
              {matrix ? 'Hide the matrix' : 'Show the matrix'}
            </Button>
          </Tooltip>
        )}
        {node.lateral && (
          <Tooltip content="Opens the recursive call of StrongRealization on the lateral set Λ₊ or Λ₋; its brick is the lateral copy.">
            <Button size="sm" variant="outline" aria-expanded={lat} onClick={() => setLat((x) => !x)}>
              {lat ? 'Hide' : 'Show'} the lateral child
            </Button>
          </Tooltip>
        )}
        {node.interior && !onChain && (
          <Tooltip content="Opens the recursive call of StrongRealization on the interior of the set; its brick is the interior copy.">
            <Button size="sm" variant="outline" aria-expanded={int} onClick={() => setInt((x) => !x)}>
              {int ? 'Hide' : 'Show'} the interior child
            </Button>
          </Tooltip>
        )}
        {node.interior && onChain && <span className="self-center font-sans text-xs text-muted">The interior child is the next level below.</span>}
      </div>
      {matrix && node.matrix && node.tree && <MatrixView matrix={node.matrix} tree={node.tree} />}
      {(lat || int) && (
        <div className="space-y-3 border-l-2 border-line pl-3">
          {lat && node.lateral && <TraceNodeCard node={node.lateral} role="lateral" />}
          {int && node.interior && <TraceNodeCard node={node.interior} role="interior" />}
        </div>
      )}
    </div>
  )
}

export function TraceChain({ root }: { root: TraceNode }) {
  const chain = useMemo(() => mainChain(root), [root])
  return (
    <ol className="space-y-3">
      {chain.map((n, i) => (
        <li key={i}>
          <TraceNodeCard node={n} onChain />
        </li>
      ))}
    </ol>
  )
}
