import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { FloatingTip, type FloatingTipHandle } from './ui/tooltip'
import { Tex } from './Tex'

/**
 * Delegated tooltips for the cells of a matrix table: the table gets these handlers, each cell `data-i` and `data-j`,
 * and one tooltip element serves the whole table.
 */
export function useCellTips(content: (i: number, j: number) => ReactNode) {
  const tip = useRef<FloatingTipHandle>(null)
  const current = useRef<string | null>(null)
  const pointer = useRef('mouse')
  const cellOf = (t: EventTarget | null) => (t as Element | null)?.closest?.('[data-i][data-j]') ?? null
  const show = (cell: Element, immediate: boolean) => {
    const i = Number(cell.getAttribute('data-i'))
    const j = Number(cell.getAttribute('data-j'))
    current.current = `${i},${j}`
    tip.current?.show(cell, content(i, j), immediate)
  }
  const handlers = {
    onPointerOver: (e: PointerEvent<HTMLElement>) => {
      pointer.current = e.pointerType
      if (e.pointerType === 'touch') return
      const cell = cellOf(e.target)
      const key = cell ? `${cell.getAttribute('data-i')},${cell.getAttribute('data-j')}` : null
      if (key === current.current) return
      if (!cell) {
        current.current = null
        tip.current?.hide()
        return
      }
      show(cell, false)
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch') return
      current.current = null
      tip.current?.hide()
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      pointer.current = e.pointerType
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (pointer.current !== 'touch') return
      const cell = cellOf(e.target)
      if (!cell) return
      const key = `${cell.getAttribute('data-i')},${cell.getAttribute('data-j')}`
      if (tip.current?.isOpen() && current.current === key) {
        current.current = null
        tip.current.hide(true)
      } else show(cell, true)
    },
  }
  return { handlers, element: <FloatingTip ref={tip} /> }
}

/** "m_{i,j} = exact (≈ approx)" and, off the diagonal, "edge {i, j}" for a nonzero entry. */
export function EntryTip({ i, j, exact, approx, edge }: { i: number; j: number; exact: string; approx?: number; edge: boolean }) {
  return (
    <div className="space-y-0.5">
      <div>
        <Tex tex={`m_{${i},${j}}`} /> = <span className="mono">{exact}</span>
        {approx !== undefined && Number.isFinite(approx) && <span className="text-muted"> (≈ {formatShort(approx)})</span>}
      </div>
      {i !== j && edge && (
        <div className="text-muted">
          edge <span className="mono">{`{${i}, ${j}}`}</span>
        </div>
      )}
    </div>
  )
}

function formatShort(x: number): string {
  const s = x.toFixed(6)
  return s.replace(/\.?0+$/, '') || '0'
}
