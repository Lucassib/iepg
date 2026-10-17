import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** A single collapsible item. Controlled by the parent so a Section can sync the references store. */
export function AccordionItem({
  title,
  open,
  onOpenChange,
  right,
  children,
  className,
  sectionId,
}: {
  title: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  right?: ReactNode
  children: ReactNode
  className?: string
  /** rendered as data-section, the anchor of the guided tours */
  sectionId?: string
}) {
  const id = useId()
  return (
    <section data-section={sectionId} className={cn('rounded-md border border-line bg-surface', className)}>
      <h2 className="m-0 flex items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          id={`${id}-trigger`}
          onClick={() => onOpenChange(!open)}
          className="flex flex-1 items-center gap-2 px-4 py-3 text-left font-serif text-lg font-semibold hover:bg-paper/60 rounded-md"
        >
          <span aria-hidden className={cn('inline-block text-muted transition-transform', open ? 'rotate-90' : '')}>
            ▸
          </span>
          <span className="flex-1">{title}</span>
        </button>
        {right && <span className="pr-3 font-sans text-xs font-normal text-muted">{right}</span>}
      </h2>
      {open && (
        <div id={`${id}-content`} role="region" aria-labelledby={`${id}-trigger`} className="border-t border-line px-4 py-3">
          {children}
        </div>
      )}
    </section>
  )
}
