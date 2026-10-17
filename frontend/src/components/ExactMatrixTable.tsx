import { cn } from '../lib/cn'
import { EntryTip, useCellTips } from './CellTip'

/** A matrix of exact strings ("1/2√2 - √3"); each entry, with its approximation, is in its tooltip. Zeros are muted. */
export function ExactMatrixTable({ matrix, approx, className }: { matrix: string[][]; approx?: number[][]; className?: string }) {
  const n = matrix.length
  const small = n > 10
  const tips = useCellTips((i, j) => {
    const cell = (matrix[i]?.[j] ?? '0').trim()
    return <EntryTip i={i} j={j} exact={cell} approx={approx?.[i]?.[j]} edge={cell !== '0'} />
  })
  return (
    <div className={cn('max-w-full overflow-x-auto rounded-md border border-line', className)}>
      {tips.element}
      <table className={cn('border-collapse whitespace-nowrap font-mono', small ? 'text-[10px]' : 'text-xs')} {...tips.handlers}>
        <thead>
          <tr>
            <th className="border-b border-r border-line bg-surface px-1.5 py-1 text-muted" scope="col" aria-label="vertex"></th>
            {matrix.map((_, j) => (
              <th key={j} scope="col" className="border-b border-line bg-surface px-1.5 py-1 text-muted">
                {j}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th scope="row" className="border-r border-line bg-surface px-1.5 py-1 text-muted">
                {i}
              </th>
              {row.map((cell, j) => {
                const zero = cell.trim() === '0'
                return (
                  <td
                    key={j}
                    data-i={i}
                    data-j={j}
                    className={cn('px-1.5 py-1 text-center', zero && 'text-muted', i === j && 'bg-surface/60')}
                  >
                    {zero ? '·' : cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
