import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import type { SeedSummary } from '../../api/types'
import { api } from '../../api/client'
import { search, starters, type Hit, type PageEntry } from '../../lib/search'
import { Tex } from '../Tex'
import { cn } from '../../lib/cn'
import { MENU } from './Sidebar'
import { ALGORITHM_ENTRIES } from '../../lib/algorithms'

const DIAMETERS = [1, 2, 3, 4, 5, 6, 7]

function pagesOf(): PageEntry[] {
  const out: PageEntry[] = []
  for (const e of MENU) {
    if ('items' in e) out.push(...e.items)
    else out.push(e)
  }
  return [...out, ...ALGORITHM_ENTRIES]
}

function target(h: Hit): string {
  if (h.kind === 'seed') return `/analyze?${new URLSearchParams({ format: 'catalog', data: h.name }).toString()}`
  if (h.kind === 'edges') return `/analyze?${new URLSearchParams({ format: 'edges', data: h.data }).toString()}`
  return h.to
}

/**
 * The header search: suggestions while typing (a diameter, a seed, a page, an edge list), arrows and Enter to choose,
 * Esc to close. A seed opens drawn and analyzed in Analyze a tree. The seeds are fetched the first time the field
 * takes the focus.
 */
export function SearchBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pages = useMemo(pagesOf, [])
  const queries = useQueries({
    queries: DIAMETERS.map((d) => ({ queryKey: ['seeds', d], queryFn: () => api.seeds(d), enabled: armed, staleTime: Infinity })),
  })
  const loaded = queries.every((x) => x.data)
  const stamp = queries.map((x) => x.dataUpdatedAt).join(',')
  const seedsByD = useMemo(() => {
    const m = new Map<number, SeedSummary[]>()
    DIAMETERS.forEach((d, i) => {
      const data = queries[i]?.data
      if (data) m.set(d, data)
    })
    return m
    // the stamp changes exactly when one of the lists arrives
  }, [stamp])
  const hits = useMemo(() => (q.trim() ? search(q, seedsByD, pages) : starters(seedsByD, pages)), [q, seedsByD, pages])
  useEffect(() => setActive(0), [q])

  // a click anywhere else closes the list
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (h: Hit | undefined) => {
    if (!h) return
    navigate(target(h))
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(hits[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const showList = open && (hits.length > 0 || q.trim().length > 0)
  return (
    <div ref={boxRef} className="relative ml-auto flex min-w-0 flex-1 justify-end" data-tour="search">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-label="Search seeds and pages"
        placeholder="Search seeds and pages…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setArmed(true)
          setOpen(true)
        }}
        onKeyDown={onKey}
        className="h-9 w-full min-w-0 max-w-64 rounded-md border border-line bg-paper px-3 font-sans text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      />
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="absolute right-0 top-full z-40 mt-1 max-h-[min(28rem,70vh)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-line bg-paper p-1 shadow-[0_6px_24px_rgba(0,0,0,0.14)]"
        >
          {!q.trim() && (
            <p className="px-2.5 pb-1 pt-1.5 font-sans text-xs text-muted">
              Type a diameter (6), a seed (S6 3, R2 R5, S9), a page (towers) or paste an edge list.
            </p>
          )}
          {hits.length === 0 && (
            <p className="px-2.5 py-2 font-sans text-sm text-muted">{armed && !loaded ? 'Loading the seeds…' : 'Nothing found. Try 6, S6 3, R2 R5 or a page name.'}</p>
          )}
          {hits.map((h, i) => (
            <div
              key={i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(h)
              }}
              className={cn('flex cursor-pointer items-baseline gap-2 rounded px-2.5 py-1.5 font-sans text-sm', i === active ? 'bg-surface' : '')}
            >
              <HitView h={h} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HitView({ h }: { h: Hit }) {
  if (h.kind === 'seed') {
    return (
      <>
        <Tex tex={h.label} className="font-serif text-base" />
        <span className="text-xs text-muted">
          seed of diameter {h.d}
          {h.status ? ` · ${h.status}` : ''}
        </span>
        <span
          aria-hidden
          className="ml-auto h-2 w-2 shrink-0 self-center rounded-full"
          style={{ background: h.status === 'defective' ? 'var(--state-defective)' : h.status === 'diminimal' ? 'var(--state-diminimal)' : 'var(--state-unknown)' }}
        />
      </>
    )
  }
  if (h.kind === 'page') {
    return (
      <span className="min-w-0">
        <span className="font-medium">{h.label}</span> <span className="text-xs text-muted">page</span>
        <span className="block truncate text-xs text-muted">{h.tip}</span>
      </span>
    )
  }
  if (h.kind === 'edges') return <span className="font-medium">Analyze this edge list</span>
  return <span className="text-muted underline decoration-line underline-offset-2">Show {h.label}</span>
}
