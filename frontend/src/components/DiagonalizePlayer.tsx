import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { DiagonalizeResponse, Matrix, Rational, TreeInfo } from '../api/types'
import { formatRational } from '../lib/exact'
import { edgeKey } from '../lib/tree'
import { TreeView } from './TreeView'
import { Button } from './ui/button'
import { Tex } from './Tex'
import { Tooltip } from './ui/tooltip'
import { SymbolTip, Term } from './ThesisTips'
import { cn } from '../lib/cn'

export const PSEUDOCODE: { n: number; text: string; indent: number }[] = [
  { n: 1, text: 'initialize d_i := m_ii − λ, for all i', indent: 0 },
  { n: 2, text: 'for k = 1 to n (bottom-up order)', indent: 0 },
  { n: 3, text: 'if v_k has no children then continue', indent: 1 },
  { n: 4, text: 'else if d_c ≠ 0 for all children c of v_k then', indent: 1 },
  { n: 5, text: 'd_k := d_k − Σ_c m_ck² / d_c', indent: 2 },
  { n: 6, text: 'else', indent: 1 },
  { n: 7, text: 'select the child v_j of v_k with d_j = 0 of smallest index j', indent: 2 },
  { n: 8, text: 'd_k := −m_jk² / 2', indent: 2 },
  { n: 9, text: 'd_j := 2', indent: 2 },
  { n: 10, text: 'if v_k has a parent v_ℓ then remove the edge {v_k, v_ℓ}', indent: 2 },
  { n: 11, text: 'end loop', indent: 0 },
]

function activeLines(line: 3 | 5 | 8 | null): { main: number[]; block: number[] } {
  if (line === null) return { main: [1], block: [] }
  if (line === 3) return { main: [3], block: [2] }
  if (line === 5) return { main: [5], block: [2, 4] }
  return { main: [8], block: [2, 6, 7, 9, 10] }
}

export function Pseudocode({ line }: { line: 3 | 5 | 8 | null }) {
  const { main, block } = activeLines(line)
  return (
    <ol className="rounded-md border border-line bg-paper p-2 font-mono text-xs leading-6" aria-label="Diagonalize pseudocode">
      {PSEUDOCODE.map((l) => (
        <li
          key={l.n}
          aria-current={main.includes(l.n) ? 'step' : undefined}
          className={cn(
            'flex gap-2 rounded px-1',
            main.includes(l.n) && 'bg-ink text-paper',
            block.includes(l.n) && 'bg-surface',
          )}
          style={{ paddingLeft: 4 + l.indent * 14 }}
        >
          <span className={cn('w-5 text-right', main.includes(l.n) ? 'text-paper/80' : 'text-muted')}>{l.n}</span>
          <span>{l.text}</span>
        </li>
      ))}
    </ol>
  )
}

const r = (s: Rational) => formatRational(s).text

/** Step-by-step player over the result of POST /diagonalize. */
export function DiagonalizePlayer({ result, tree, root, matrix, lam }: { result: DiagonalizeResponse; tree: TreeInfo; root: number; matrix: Matrix; lam: Rational }) {
  const steps = result.steps
  const last = steps.length - 1
  const [i, setI] = useState(-1)
  const [playing, setPlaying] = useState(false)

  // Autoplay: one step every 800 ms. The parent remounts the player (key) when the result changes.
  useEffect(() => {
    if (!playing || i >= last) return
    const t = window.setTimeout(() => {
      const n = Math.min(last, i + 1)
      setI(n)
      if (n >= last) setPlaying(false)
    }, 800)
    return () => window.clearTimeout(t)
  }, [playing, i, last])

  const step = i >= 0 ? steps[i] : null

  const { labels, cut, processed } = useMemo(() => {
    const labels: Record<string, string> = {}
    const cut: [number, number][] = []
    const processed: number[] = []
    for (let k = 0; k <= i; k++) {
      const s = steps[k]
      processed.push(s.vertex)
      if (s.cut_edge) cut.push(s.cut_edge)
    }
    const dNow = step?.d_after ?? {}
    for (let k = 0; k <= i; k++) {
      const s = steps[k]
      const hat = r(s.hat_d)
      const now = dNow[String(s.vertex)]
      labels[String(s.vertex)] = now !== undefined && r(now) !== hat ? `${hat}→${r(now)}` : hat
    }
    return { labels, cut, processed }
  }, [i, steps, step])

  const w2 = (u: number, v: number) => matrix.w2[edgeKey(u, v)] ?? '1'

  const go = useCallback((k: number) => setI(Math.max(-1, Math.min(last, k))), [last])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(i + 1)
    else if (e.key === 'ArrowLeft') go(i - 1)
    else if (e.key === 'Home') go(-1)
    else if (e.key === 'End') go(last)
    else if (e.key === ' ') setPlaying((p) => !p)
    else return
    e.preventDefault()
  }

  const done = i === last
  const lamText = r(lam)

  return (
    <div
      className="space-y-3 rounded-md border border-line bg-surface p-3 outline-none focus-visible:ring-2 focus-visible:ring-ink"
      tabIndex={0}
      onKeyDown={onKey}
      aria-label="Diagonalize player. Use the arrow keys to step, Home and End to jump, space to play."
    >
      <div className="flex flex-wrap items-center gap-2 font-sans text-sm">
        <Tooltip content="Back to line 1: every vertex holds its initial value, none is processed (Home).">
          <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={i < 0} aria-label="Reset">
            ⏮
          </Button>
        </Tooltip>
        <Tooltip content="Undoes the last processed vertex (←).">
          <Button variant="outline" size="sm" onClick={() => go(i - 1)} disabled={i < 0} aria-label="Previous step">
            ◀ Prev
          </Button>
        </Tooltip>
        <Tooltip content="Processes the next vertex of the bottom-up order: line 3, 5 or 8 of the pseudocode (→).">
          <Button variant="outline" size="sm" onClick={() => go(i + 1)} disabled={done} aria-label="Next step">
            Next ▶
          </Button>
        </Tooltip>
        <Tooltip content={playing ? 'Stops the animation at the current step (space).' : 'Processes the vertices one by one, a step every 0.8 s (space).'}>
          <Button variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} disabled={done && !playing} aria-pressed={playing}>
            {playing ? 'Pause' : 'Play'}
          </Button>
        </Tooltip>
        <Tooltip content="Jumps to the last step: the final values and the numbers of zero, positive and negative values (End).">
          <Button variant="outline" size="sm" onClick={() => go(last)} disabled={done} aria-label="Run to the end">
            Run to end ⏭
          </Button>
        </Tooltip>
        <span className="text-muted">
          step {i + 1} of {steps.length}
        </span>
      </div>
      <Tooltip content="Drag to any step of the run; the leftmost position is the initialization (line 1).">
        <input
          type="range"
          min={-1}
          max={last}
          value={i}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Step index"
          aria-valuetext={i < 0 ? 'initialization' : `step ${i + 1}, vertex ${steps[i].vertex}`}
        />
      </Tooltip>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-line bg-paper p-2">
          <TreeView
            tree={tree}
            roots={[root]}
            labels={labels}
            labelName={(v) => `\\hat d_{${v}}`}
            dashedEdges={cut}
            highlight={step ? [step.vertex] : []}
            secondary={step?.consumed_child !== null && step?.consumed_child !== undefined ? [step.consumed_child] : []}
            showIds
            alt={`Diagonalize on ${tree.canonical}, step ${i + 1}`}
          />
          <p className="mt-1 font-sans text-xs text-muted">
            Labels are the <Term k="temporary value">temporary values</Term>{' '}
            <SymbolTip s="d̂_v" underline>
              <Tex tex="\hat d_v" />
            </SymbolTip>{' '}
            of the processed vertices (an arrow marks a value changed later). A solid ring marks the current vertex, a dashed ring the consumed child, dashed edges were removed.
          </p>
        </div>
        <div className="space-y-2">
          <Pseudocode line={step ? step.line : null} />
          <div className="rounded-md border border-line bg-paper px-3 py-2 font-serif text-sm leading-relaxed" aria-live="polite">
            {!step && (
              <p>
                Line 1: every vertex starts with <Tex tex={`d_v = m_{vv} - \\lambda`} /> for{' '}
                <SymbolTip s="λ" underline>
                  <Tex tex={`\\lambda = ${lamText}`} />
                </SymbolTip>
                , that is, Diagonalize(M, −λ). <Term k="bottom-up">Bottom-up</Term> order:{' '}
                <span className="mono">{result.order.join(' ')}</span>.
              </p>
            )}
            {step && step.line === 3 && (
              <p>
                Step {step.k}: vertex {step.vertex} is a leaf, nothing to do. <Tex tex={`\\hat d_{${step.vertex}} = ${r(step.hat_d)}`} />.
              </p>
            )}
            {step && step.line === 5 && (
              <p>
                Step {step.k}: every child of vertex {step.vertex} has a nonzero value, so line 5 subtracts <Tex tex="\sum_c m_{c k}^2/d_c" /> and gives{' '}
                <Tex tex={`\\hat d_{${step.vertex}} = ${r(step.hat_d)}`} />.
              </p>
            )}
            {step && step.line === 8 && (
              <p>
                Step {step.k}: child {step.consumed_child} of vertex {step.vertex} has value 0. Lines 8 and 9 set{' '}
                <Tex tex={`d_{${step.vertex}} := -m_{${step.consumed_child}${step.vertex}}^2/2 = -${r(w2(step.consumed_child ?? 0, step.vertex))}/2 = ${r(step.hat_d)}`} /> and{' '}
                <Tex tex={`d_{${step.consumed_child}} := 2`} />
                {step.cut_edge ? (
                  <>
                    , and line 10 removes the edge {step.cut_edge[0]}–{step.cut_edge[1]} to the parent.
                  </>
                ) : (
                  <>. Vertex {step.vertex} has no parent, so there is no edge to remove.</>
                )}
              </p>
            )}
          </div>
          {done && (
            <div className="rounded-md border border-line bg-paper px-3 py-2 font-sans text-sm">
              <div className="flex flex-wrap gap-3 font-mono text-sm">
                <span>zeros: {result.zeros}</span>
                <span>positives: {result.positives}</span>
                <span>negatives: {result.negatives}</span>
              </div>
              <p className="mt-1 font-serif">
                The number of zeros is the multiplicity of λ, positive and negative values count the eigenvalues greater and smaller than λ (Sylvester).
              </p>
              <p className="mt-1 text-xs text-muted">
                Temporary zeros at {result.temporary_zeros.length > 0 ? result.temporary_zeros.join(', ') : 'no vertex'}; λ {result.in_Z ? 'is' : 'is not'} in{' '}
                <SymbolTip s="Z(M)" underline>
                  <Tex tex="\mathcal Z(M)" />
                </SymbolTip>
                . <SymbolTip s="d_v" underline>Final values</SymbolTip>: {Object.entries(result.final).map(([v, d]) => `d_${v} = ${r(d)}`).join(', ')}.
              </p>
            </div>
          )}
          {!done && processed.length > 0 && (
            <p className="font-sans text-xs text-muted">Processed so far: {processed.join(', ')}.</p>
          )}
        </div>
      </div>
    </div>
  )
}
