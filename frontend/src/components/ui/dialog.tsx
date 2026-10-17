import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './button'

type BaseProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

function useModal(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => panelRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])
  return panelRef
}

function Frame({ open, onOpenChange, title, description, children, className, side }: BaseProps & { side: 'center' | 'right' | 'left' }) {
  const panelRef = useModal(open, () => onOpenChange(false))
  const titleId = useId()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex" onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div aria-hidden className="absolute inset-0 bg-ink/30" onMouseDown={() => onOpenChange(false)} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex flex-col border border-line bg-paper text-ink shadow-sm outline-none',
          side === 'center' && 'm-auto max-h-[90vh] w-[min(96vw,720px)] rounded-md',
          side === 'right' && 'ml-auto h-full w-[min(96vw,760px)] border-y-0 border-r-0',
          side === 'left' && 'mr-auto h-full w-[min(88vw,300px)] border-y-0 border-l-0',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-semibold leading-tight">
              {title}
            </h2>
            {description && <p className="mt-0.5 font-sans text-sm text-muted">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={() => onOpenChange(false)}>
            ×
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function Dialog(props: BaseProps) {
  return <Frame {...props} side="center" />
}

export function Sheet({ side = 'right', ...props }: BaseProps & { side?: 'right' | 'left' }) {
  return <Frame {...props} side={side} />
}
