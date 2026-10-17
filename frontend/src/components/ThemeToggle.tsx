import { useTheme, type ThemeMode } from '../lib/theme'
import { cn } from '../lib/cn'

const MODES: { value: ThemeMode; label: string; glyph: string }[] = [
  { value: 'light', label: 'Light theme', glyph: '☀' },
  { value: 'dark', label: 'Dark theme', glyph: '☾' },
  { value: 'system', label: 'Follow the system theme', glyph: '◐' },
]

export function ThemeToggle() {
  const mode = useTheme((s) => s.mode)
  const setMode = useTheme((s) => s.setMode)
  return (
    <div role="group" aria-label="Theme" className="inline-flex rounded-md border border-line bg-surface p-0.5">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          aria-pressed={mode === m.value}
          aria-label={m.label}
          title={m.label}
          onClick={() => setMode(m.value)}
          className={cn(
            'h-7 w-8 rounded text-sm leading-none transition-colors',
            mode === m.value ? 'bg-paper border border-line text-ink' : 'text-muted hover:text-ink border border-transparent',
          )}
        >
          {m.glyph}
        </button>
      ))}
    </div>
  )
}
