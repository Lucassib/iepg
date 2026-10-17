import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'icon'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-ink text-paper border border-ink hover:opacity-90',
  outline: 'bg-transparent text-ink border border-line hover:bg-surface',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-surface',
  subtle: 'bg-surface text-ink border border-line hover:border-ink',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1',
  md: 'h-9 px-3.5 text-sm gap-1.5',
  icon: 'h-8 w-8 p-0 text-sm',
}

export function buttonClass(variant: ButtonVariant = 'default', size: ButtonSize = 'md', className?: string): string {
  return cn(
    'inline-flex items-center justify-center rounded-md font-sans font-medium whitespace-nowrap select-none transition-colors no-underline',
    'disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  )
})
