import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import type { SeedStatus } from '../../api/types'
import { GlossaryTip } from '../ThesisTips'
import { Tooltip } from './tooltip'

export type BadgeVariant = SeedStatus | 'neutral' | 'outline'

const styles: Record<BadgeVariant, string> = {
  diminimal: 'border-diminimal text-diminimal',
  defective: 'border-defective text-defective',
  unknown: 'border-unknown text-unknown',
  neutral: 'border-line bg-surface text-ink',
  outline: 'border-line text-muted',
}

export function Badge({ variant = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-sans text-xs font-medium whitespace-nowrap', styles[variant], className)}
      {...props}
    />
  )
}

export const STATUS_TEXT: Record<SeedStatus, string> = {
  diminimal: 'diminimal',
  defective: 'defective',
  unknown: 'undetermined',
}

export const UNKNOWN_STATUS_TEXT = 'Nothing proved in the thesis or in the cited literature decides this seed.'

/**
 * The status of a seed, with its meaning in a tooltip: the glossary text of "diminimal seed" or "defective seed", or
 * the undetermined note. `focusable={false}` inside a button (seed cards).
 */
export function StatusBadge({ status, className, focusable = true }: { status: SeedStatus; className?: string; focusable?: boolean }) {
  const badge = (
    <Badge variant={status} className={cn('cursor-help', className)} tabIndex={focusable ? 0 : undefined}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-current" />
      {STATUS_TEXT[status]}
    </Badge>
  )
  if (status === 'unknown') return <Tooltip content={UNKNOWN_STATUS_TEXT}>{badge}</Tooltip>
  return <GlossaryTip k={status === 'diminimal' ? 'diminimal seed' : 'defective seed'}>{badge}</GlossaryTip>
}
