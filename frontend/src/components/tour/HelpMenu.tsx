import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { pageTourOf, useTour, type TourId } from '../../lib/tour'
import { cn } from '../../lib/cn'
import { Button } from '../ui/button'
import { Popover } from '../ui/popover'
import { Tooltip } from '../ui/tooltip'
import { TOURS } from './tours'

const ORDER: TourId[] = ['site', 'playground', 'analyze']

/** The question mark of the header: the guided tours. A dot marks the guide of the open page while it is unseen. */
export function HelpMenu() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const start = useTour((s) => s.start)
  const seen = useTour((s) => s.seen)
  const here = pageTourOf(pathname)
  const fresh = here !== null && seen.site === true && seen[here] === false
  const begin = (id: TourId) => {
    setOpen(false)
    start(id)
  }
  const trigger = (
    <Tooltip content="Guided tours of the site and of its interactive pages." placement="bottom">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Guides"
        aria-expanded={open}
        data-tour="help"
        onClick={() => setOpen((o) => !o)}
        className="relative border-line font-serif text-base"
      >
        ?
        {fresh && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-note" />}
      </Button>
    </Tooltip>
  )
  return (
    <Popover open={open} onOpenChange={setOpen} align="right" trigger={trigger} className="w-[min(90vw,17rem)] p-2">
      <span className="block px-2 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">Guides</span>
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => begin(id)}
          className={cn(
            'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-surface',
            id === here && 'font-medium',
          )}
        >
          <span className="flex-1">{TOURS[id].title}</span>
          {id === here && <span className="text-xs text-muted">this page</span>}
          {seen[id] === false && id !== 'site' && <span aria-label="not seen yet" className="h-1.5 w-1.5 rounded-full bg-note" />}
        </button>
      ))}
    </Popover>
  )
}
