import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Minimal popover anchored below its trigger. Span-based so it is valid inside a paragraph. The caller owns the open state. */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  className,
  align = 'left',
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  trigger: ReactNode
  children: ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])
  return (
    <span ref={ref} className="relative inline-block">
      {trigger}
      {open && (
        <span
          role="dialog"
          className={cn(
            'absolute top-full z-40 mt-1 block w-[min(90vw,26rem)] rounded-md border border-line bg-paper p-3 text-left font-sans text-sm font-normal shadow-sm',
            align === 'left' ? 'left-0' : 'right-0',
            className,
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}
