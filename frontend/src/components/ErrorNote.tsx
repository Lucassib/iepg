import { ApiError, errorMessage } from '../api/client'
import { cn } from '../lib/cn'

/** Graceful error box: the interface keeps rendering when the backend is down. */
export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null
  const network = error instanceof ApiError && (error.code === 'network' || error.status >= 500)
  return (
    <div role="alert" className={cn('rounded-md border border-dashed border-line bg-surface px-3 py-2 font-sans text-sm', className)}>
      <div className="font-medium">{network ? 'Server unavailable' : 'Request failed'}</div>
      <div className="text-muted">{errorMessage(error)}</div>
    </div>
  )
}

export function Loading({ text = 'Loading…', className }: { text?: string; className?: string }) {
  return (
    <div className={cn('font-sans text-sm text-muted', className)} aria-live="polite">
      {text}
    </div>
  )
}

export function Callout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('border-l-4 border-note bg-surface px-3 py-2 font-serif text-sm leading-relaxed', className)}>{children}</div>
}
