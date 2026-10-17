import { useMemo, useState } from 'react'
import type { Matrix, TreeInfo } from '../api/types'
import { formatRational, formatSqrt, rationalToNumber } from '../lib/exact'
import { edgeKey } from '../lib/tree'
import { Button } from './ui/button'
import { Tooltip } from './ui/tooltip'
import { TreeView } from './TreeView'
import { EntryTip, useCellTips } from './CellTip'
import { Tex } from './Tex'
import { cn } from '../lib/cn'

/** The exact entry m_ij of a tree matrix (diagonal rational, off-diagonal √w²), its approximation, and whether ij is an edge. */
function entryOf(matrix: Matrix, i: number, j: number): { exact: string; approx: number; edge: boolean } {
  if (i === j) {
    const d = matrix.diag[String(i)] ?? '0'
    return { exact: formatRational(d).text, approx: rationalToNumber(d), edge: false }
  }
  const w = matrix.w2[edgeKey(i, j)]
  if (w === undefined) return { exact: '0', approx: 0, edge: false }
  return { exact: formatSqrt(w).text, approx: Math.sqrt(rationalToNumber(w)), edge: true }
}

/** Tooltip of an edge drawn with its weight: m_uv = √(w²) = exact (≈ approx). */
function EdgeWeightTip({ matrix, u, v }: { matrix: Matrix; u: number; v: number }) {
  const w = matrix.w2[edgeKey(u, v)]
  if (w === undefined) return null
  const a = Math.min(u, v)
  const b = Math.max(u, v)
  const f = formatSqrt(w)
  const approx = Math.sqrt(rationalToNumber(w))
  return (
    <div className="space-y-0.5">
      <div>
        <Tex tex={`m_{${a},${b}} = \\sqrt{${formatRational(w).tex}}`} />
        {f.text !== `√(${w})` && (
          <>
            {' '}
            = <span className="mono">{f.text}</span>
          </>
        )}
        {Number.isFinite(approx) && <span className="text-muted"> (≈ {approx.toFixed(6).replace(/\.?0+$/, '')})</span>}
      </div>
      <div className="text-muted">
        edge <span className="mono">{`{${a}, ${b}}`}</span>, squared weight <span className="mono">{formatRational(w).text}</span>
      </div>
    </div>
  )
}

/**
 * The matrix as a table with exact entries and on the tree (diagonal beside the vertices, square roots of the
 * weights on the edges). For n > 12 the tree view comes first and the table is collapsed behind a button.
 */
export function MatrixView({
  matrix,
  tree,
  root,
  defaultOnTree,
  className,
}: {
  matrix: Matrix
  tree: TreeInfo
  root?: number
  defaultOnTree?: boolean
  className?: string
}) {
  const big = tree.n > 12
  const [onTree, setOnTree] = useState(defaultOnTree ?? big)
  const ids = useMemo(() => Array.from({ length: tree.n }, (_, i) => i), [tree.n])
  const labels = useMemo(() => Object.fromEntries(ids.map((v) => [String(v), formatRational(matrix.diag[String(v)] ?? '0').text])), [ids, matrix.diag])
  const edgeLabels = useMemo(() => Object.fromEntries(Object.entries(matrix.w2).map(([k, s]) => [k, formatSqrt(s).text])), [matrix.w2])
  const tips = useCellTips((i, j) => {
    const e = entryOf(matrix, i, j)
    return <EntryTip i={i} j={j} exact={e.exact} approx={e.approx} edge={e.edge} />
  })

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-muted">
        <span>
          Diagonal entries and <span className="mono">√</span> of the squared weights; zeros are shown as ·
        </span>
        <Tooltip
          content={
            onTree
              ? 'Shows the matrix as a table of exact entries (hover a cell for the entry and its approximation).'
              : 'Draws the matrix on the tree: the diagonal entry beside each vertex, the off-diagonal entry on each edge.'
          }
        >
          <Button variant="subtle" size="sm" aria-pressed={!onTree} onClick={() => setOnTree((v) => !v)}>
            {onTree ? 'Show the matrix' : 'Show on tree'}
          </Button>
        </Tooltip>
      </div>
      {onTree ? (
        <TreeView
          tree={tree}
          roots={root !== undefined ? [root] : undefined}
          labels={labels}
          labelName={(v) => `m_{${v},${v}}`}
          edgeLabels={edgeLabels}
          edgeInfo={(u, v) => <EdgeWeightTip matrix={matrix} u={u} v={v} />}
          showIds
          alt={`Matrix on tree ${tree.canonical}`}
        />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-md border border-line">
          {tips.element}
          <table className={cn('border-collapse whitespace-nowrap font-mono', big ? 'text-[10px]' : 'text-xs')} {...tips.handlers}>
            <thead>
              <tr>
                <th className="border-b border-r border-line bg-surface px-1.5 py-1 text-muted" scope="col" aria-label="vertex"></th>
                {ids.map((j) => (
                  <th key={j} scope="col" className="border-b border-line bg-surface px-1.5 py-1 text-muted">
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((i) => (
                <tr key={i}>
                  <th scope="row" className="border-r border-line bg-surface px-1.5 py-1 text-muted">
                    {i}
                  </th>
                  {ids.map((j) => {
                    let cell = '·'
                    let muted = true
                    if (i === j) {
                      cell = formatRational(matrix.diag[String(i)] ?? '0').text
                      muted = cell === '0'
                    } else {
                      const w = matrix.w2[edgeKey(i, j)]
                      if (w !== undefined) {
                        cell = formatSqrt(w).text
                        muted = false
                      }
                    }
                    return (
                      <td key={j} data-i={i} data-j={j} className={cn('px-1.5 py-1 text-center whitespace-nowrap', muted && 'text-muted', i === j && 'bg-surface/60')}>
                        {cell}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
