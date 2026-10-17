import { createContext, useContext, useId, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip } from './tooltip'

type TabsCtx = { value: string; setValue: (v: string) => void; baseId: string }
const Ctx = createContext<TabsCtx | null>(null)

function useTabs(): TabsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('Tabs components must be used inside <Tabs>')
  return c
}

export function Tabs({
  value,
  onValueChange,
  className,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: ReactNode
}) {
  const baseId = useId()
  return (
    <Ctx.Provider value={{ value, setValue: onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  )
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [])
    if (tabs.length === 0) return
    const i = tabs.findIndex((t) => t === document.activeElement)
    let next = i
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    e.preventDefault()
    tabs[next]?.focus()
    tabs[next]?.click()
  }
  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn('inline-flex flex-wrap gap-1 rounded-md border border-line bg-surface p-1 font-sans', className)}
      {...props}
    />
  )
}

/** `tip`: the tooltip of the tab (what the tab holds). */
export function TabsTrigger({ value, className, children, disabled, tip }: { value: string; className?: string; children: ReactNode; disabled?: boolean; tip?: ReactNode }) {
  const { value: current, setValue, baseId } = useTabs()
  const active = current === value
  return (
    <Tooltip content={tip}>
      <button
        type="button"
        role="tab"
        id={`${baseId}-tab-${value}`}
        aria-selected={active}
        aria-controls={`${baseId}-panel-${value}`}
        tabIndex={active ? 0 : -1}
        disabled={disabled}
        onClick={() => setValue(value)}
        className={cn(
          'rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
          active ? 'bg-paper text-ink border border-line' : 'text-muted border border-transparent hover:text-ink',
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const { value: current, baseId } = useTabs()
  if (current !== value) return null
  return (
    <div role="tabpanel" id={`${baseId}-panel-${value}`} aria-labelledby={`${baseId}-tab-${value}`} tabIndex={0} className={cn('mt-3', className)}>
      {children}
    </div>
  )
}
