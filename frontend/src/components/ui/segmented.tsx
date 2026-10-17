import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip } from './tooltip'

/** `tip`: the tooltip of the option (what choosing it does). */
export type SegmentOption<T extends string> = { value: T; label: ReactNode; disabled?: boolean; title?: string; tip?: ReactNode }

/** A radio group drawn as joined buttons (arrow keys move the choice). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    const enabled = options.filter((o) => !o.disabled)
    const i = enabled.findIndex((o) => o.value === value)
    const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length]
    if (next) {
      e.preventDefault()
      onChange(next.value)
      window.setTimeout(() => ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(), 0)
    }
  }
  return (
    <div ref={ref} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn('inline-flex max-w-full flex-wrap rounded-md border border-line bg-surface p-0.5 font-sans', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Tooltip key={o.value} content={o.tip}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={o.disabled}
              title={o.tip ? undefined : o.title}
              onClick={() => onChange(o.value)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50',
                active ? 'border border-line bg-paper text-ink' : 'border border-transparent text-muted hover:text-ink',
              )}
            >
              {o.label}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
