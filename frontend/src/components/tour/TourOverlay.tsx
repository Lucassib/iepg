import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTour } from '../../lib/tour'
import { Button } from '../ui/button'
import { TOURS, type TourPlacement, type TourStep } from './tours'

/**
 * The guided tour. A veil covers the page except for a hole around the target of the step, which stays usable
 * (a term can be hovered, a button clicked); a card next to the hole explains it. The veil is an SVG path with an
 * even-odd hole, so the pointer passes through the hole only. Esc closes the tour, the arrow keys move between
 * steps while the focus is on the card.
 */

type Box = { x: number; y: number; w: number; h: number }

const PAD = 6 // space between the target and the ring
const GAP = 14 // space between the ring and the card
const MARGIN = 12 // space between the card and the viewport edge
const HEADER = 64 // the sticky header

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function visible(el: Element): DOMRect | null {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? r : null
}

/** The smallest box around the first visible match of each selector, or null. */
function locate(selectors: string[] | undefined): Box | null {
  if (!selectors) return null
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const sel of selectors) {
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const r = visible(el)
      if (!r) continue
      x0 = Math.min(x0, r.left)
      y0 = Math.min(y0, r.top)
      x1 = Math.max(x1, r.right)
      y1 = Math.max(y1, r.bottom)
      break
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function hole(b: Box, vw: number, vh: number): Box {
  const x = Math.max(4, b.x - PAD)
  const y = Math.max(4, b.y - PAD)
  const r = Math.min(vw - 4, b.x + b.w + PAD)
  const bt = Math.min(vh - 4, b.y + b.h + PAD)
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, bt - y) }
}

function roundRect({ x, y, w, h }: Box, r: number): string {
  r = Math.min(r, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}

/** Where the card goes: the preferred side if it fits, then below, above, right, left; else at the foot of the window. */
function place(b: Box | null, cw: number, ch: number, pref: TourPlacement, vw: number, vh: number): { left: number; top: number } {
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, vw - cw - MARGIN))
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), Math.max(MARGIN, vh - ch - MARGIN))
  if (!b) return { left: clampX((vw - cw) / 2), top: clampY((vh - ch) / 2) }
  // a corner: out of the way of a large target the reader should watch
  if (pref === 'corner') return { left: clampX(vw - cw - MARGIN), top: clampY(vh - ch - MARGIN) }
  if (pref === 'corner-left') return { left: MARGIN, top: clampY(vh - ch - MARGIN) }
  const order = Array.from(new Set<TourPlacement>([pref, 'bottom', 'top', 'right', 'left'])).filter((p) => !isCorner(p))
  for (const p of order) {
    if (p === 'right' && b.x + b.w + GAP + cw <= vw - MARGIN) return { left: b.x + b.w + GAP, top: clampY(b.y) }
    if (p === 'left' && b.x - GAP - cw >= MARGIN) return { left: b.x - GAP - cw, top: clampY(b.y) }
    if (p === 'bottom' && b.y + b.h + GAP + ch <= vh - MARGIN) return { left: clampX(b.x), top: b.y + b.h + GAP }
    if (p === 'top' && b.y - GAP - ch >= MARGIN) return { left: clampX(b.x), top: b.y - GAP - ch }
  }
  return { left: clampX((vw - cw) / 2), top: vh - ch - MARGIN }
}

function isCorner(p: TourPlacement): boolean {
  return p === 'corner' || p === 'corner-left'
}

function sideFits(b: Box, cw: number, pref: TourPlacement, vw: number): boolean {
  return (pref === 'right' && b.x + b.w + GAP + cw <= vw - MARGIN) || (pref === 'left' && b.x - GAP - cw >= MARGIN)
}

/** A target too tall to share the window with a card above or below it is highlighted from its top down. */
function clip(b: Box, cw: number, ch: number, pref: TourPlacement, vw: number, vh: number): Box {
  if (isCorner(pref) || sideFits(b, cw, pref, vw)) return b
  const room = vh - (HEADER + 8) - GAP - ch - MARGIN - 2 * PAD
  return b.h <= room ? b : { ...b, h: Math.max(120, room) }
}

/** Scrolls the page once per step so that the target, and the card when it goes above or below, are in view. */
function bringIntoView(b: Box, cw: number, ch: number, pref: TourPlacement) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const top = HEADER + 8
  const bottom = vh - MARGIN
  const inView = b.y >= top - PAD && b.y + b.h <= bottom
  if (isCorner(pref)) {
    if (b.y < top - PAD || b.y > vh / 2) window.scrollBy({ top: b.y - top, behavior: reducedMotion() ? 'auto' : 'smooth' })
    return
  }
  const side = sideFits(b, cw, pref, vw)
  if (inView && (side || b.y + b.h + GAP + ch <= bottom || b.y - GAP - ch >= top)) return
  const need = side ? b.h : b.h + GAP + ch
  let desired = need <= bottom - top ? top + (bottom - top - need) / 2 : top
  if (!side && pref === 'top' && need <= bottom - top) desired += GAP + ch
  const delta = b.y - desired
  if (Math.abs(delta) > 4) window.scrollBy({ top: delta, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5)

export function TourOverlay() {
  const id = useTour((s) => s.tour)
  const step = useTour((s) => s.step)
  const dir = useTour((s) => s.dir)
  const go = useTour((s) => s.go)
  const stop = useTour((s) => s.stop)
  const start = useTour((s) => s.start)
  const seenSite = useTour((s) => s.seen.site)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const titleId = useId()
  const bodyId = useId()

  const tour = id ? TOURS[id] : null
  const s: TourStep | undefined = tour?.steps[step]
  const welcome = id === 'site' && step === 0
  // an optional step counts only while its target is on the page
  const present = (st: TourStep) => !st.optional || locate(st.target) !== null
  const counted = tour ? tour.steps.map((st, i) => !(id === 'site' && i === 0) && (i === step || present(st))) : []
  const count = counted.filter(Boolean).length
  const number = counted.slice(0, step + 1).filter(Boolean).length
  const last = tour ? !tour.steps.slice(step + 1).some(present) : false

  const [box, setBox] = useState<Box | null>(null)
  const [shown, setShown] = useState(false)
  const [usedDemo, setUsedDemo] = useState(false)
  const [taskDone, setTaskDone] = useState(false)
  const [view, setView] = useState({ w: typeof window !== 'undefined' ? window.innerWidth : 1200, h: typeof window !== 'undefined' ? window.innerHeight : 800 })
  const [card, setCard] = useState({ w: 368, h: 220 })
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const navAt = useRef(0)
  const arrived = useRef(false)
  // the identity of navigate changes with the path; the effects below must not restart because of it
  const navRef = useRef(navigate)
  navRef.current = navigate

  // The first visit: open the tour of the site once the page has rendered.
  useEffect(() => {
    if (seenSite !== false) return
    const t = window.setTimeout(() => {
      if (!useTour.getState().tour) start('site')
    }, 700)
    return () => window.clearTimeout(t)
  }, [seenSite, start])

  // A page tour opens its page, and leaving the page ends it.
  useEffect(() => {
    arrived.current = false
    if (tour?.route && pathname !== tour.route) {
      navAt.current = performance.now()
      navRef.current(tour.route)
    }
    // the path is read when the tour starts only
  }, [id])
  useEffect(() => {
    if (!tour?.route) return
    if (pathname === tour.route) arrived.current = true
    else if (arrived.current) stop()
  }, [pathname, tour, stop])

  // Room at the foot of the page while a tour is open, so that a target near the end can scroll up above its card.
  useEffect(() => {
    if (!id) return
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = '50vh'
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [id])

  // Find the target of the step, follow it while it moves, open the example when it is missing; a hands-on step
  // moves on by itself once its task is done.
  useEffect(() => {
    if (!s) return
    setShown(false)
    setBox(null)
    setUsedDemo(false)
    setTaskDone(false)
    // a route with a query (a page opened at a given state) is opened as written; a plain route only when on another page
    const here = window.location.pathname + (s.route?.includes('?') ? window.location.search : '')
    if (s.route && here !== s.route) {
      navAt.current = performance.now()
      navRef.current(s.route)
    }
    let raf = 0
    let found = false
    let demoTried = false
    let current: Box | null = null
    let captured: unknown = undefined
    let captureTaken = false
    let finished = false
    let advance = 0
    const t0 = performance.now()
    const tick = () => {
      if (s.task && found && !finished) {
        if (!captureTaken) {
          captured = s.task.capture?.()
          captureTaken = true
        } else if (s.task.done(captured)) {
          finished = true
          setTaskDone(true)
          advance = window.setTimeout(() => {
            const st = useTour.getState()
            if (st.tour && st.tour === id && st.step === step) {
              const t = TOURS[st.tour]
              if (step + 1 < t.steps.length) go(step + 1)
              else stop()
            }
          }, 900)
        }
      }
      const vw = window.innerWidth
      const vh = window.innerHeight
      setView((v) => (v.w === vw && v.h === vh ? v : { w: vw, h: vh }))
      const pref = s.placement ?? 'bottom'
      const cw = cardRef.current?.offsetWidth ?? 368
      const ch = cardRef.current?.offsetHeight ?? 220
      const b0 = s.target ? (locate(s.target) ?? locate(s.fallback)) : null
      const b = b0 && clip(b0, cw, ch, pref, vw, vh)
      if (b) {
        if (!found) {
          found = true
          bringIntoView(b, cw, ch, pref)
          setShown(true)
        }
        if (!sameBox(b, current)) {
          current = b
          setBox(b)
        }
      } else if (!s.target) {
        if (!found) {
          found = true
          setShown(true)
        }
      } else if (found) {
        if (current) {
          current = null
          setBox(null)
        }
      } else if (s.demo && !demoTried) {
        demoTried = true
        navAt.current = performance.now()
        setUsedDemo(true)
        navRef.current(s.demo)
      } else {
        const wait = performance.now() - navAt.current < 3000 ? 3000 : 700
        if (performance.now() - t0 > wait) {
          if (s.optional) {
            const n = step + dir
            if (tour && n >= 0 && n < tour.steps.length) go(n)
            else stop()
            return
          }
          found = true
          setShown(true)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(advance)
    }
  }, [s, step, dir, tour, go, stop, id])

  // The size of the card, for its placement.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measure = () => setCard((c) => (c.w === el.offsetWidth && c.h === el.offsetHeight ? c : { w: el.offsetWidth, h: el.offsetHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [id, step, shown])

  // Focus the main button of each step.
  useEffect(() => {
    if (shown) primaryRef.current?.focus({ preventScroll: true })
  }, [shown, step, id])

  // a click that lands just after the step changed, by itself after a task, was aimed at the step before: it is ignored
  const changedAt = useRef(0)
  useEffect(() => {
    changedAt.current = performance.now()
  }, [step])
  const settled = () => performance.now() - changedAt.current > 600
  const next = () => settled() && (last ? stop() : go(step + 1))
  const first = id === 'site' ? 1 : 0
  const back = () => settled() && step > first && go(step - 1)

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        stop()
        return
      }
      const a = document.activeElement
      const onCard = !a || a === document.body || !!cardRef.current?.contains(a)
      if (!onCard) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        if (last) stop()
        else go(step + 1)
      } else if (e.key === 'ArrowLeft' && step > (id === 'site' ? 1 : 0)) {
        e.preventDefault()
        e.stopPropagation()
        go(step - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [id, step, last, go, stop])

  if (!tour || !s) return null

  const h = box ? hole(box, view.w, view.h) : null
  const pos = place(h, card.w, card.h, s.placement ?? 'bottom', view.w, view.h)
  const motion = reducedMotion() ? '' : 'transition-[left,top,width,height,opacity] duration-200'

  return createPortal(
    <>
      <svg aria-hidden className="fixed inset-0 z-[55]" width={view.w} height={view.h} style={{ pointerEvents: 'none' }}>
        <path d={`M0 0H${view.w}V${view.h}H0Z${h ? roundRect(h, 8) : ''}`} fillRule="evenodd" fill="var(--tour-dim)" style={{ pointerEvents: 'auto' }} onMouseDown={stop} />
      </svg>
      {h && (
        <div
          aria-hidden
          data-tour-ring=""
          className={`pointer-events-none fixed z-[56] rounded-lg ${motion}`}
          style={{ left: h.x, top: h.y, width: h.w, height: h.h, boxShadow: '0 0 0 2px var(--bg), 0 0 0 4px var(--text)' }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tour-card=""
        className={`fixed z-[58] w-[min(23rem,calc(100vw-24px))] rounded-md border border-line bg-paper p-4 text-ink shadow-[0_6px_28px_rgba(0,0,0,0.22)] ${motion}`}
        style={{ left: pos.left, top: pos.top, opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-muted">{welcome ? tour.title : `${tour.title} · ${number} of ${count}`}</span>
          <button
            type="button"
            aria-label="Close the tour"
            onClick={stop}
            className="ml-auto -mr-1 -mt-1 h-7 w-7 rounded font-sans text-base leading-none text-muted hover:bg-surface hover:text-ink"
          >
            ×
          </button>
        </div>
        <h2 id={titleId} className="mt-0.5 font-serif text-lg font-semibold leading-snug">
          {s.title}
        </h2>
        <div id={bodyId} className="mt-1.5 space-y-2 font-serif text-[0.95rem] leading-relaxed">
          {s.body}
          {usedDemo && s.demoNote && <p className="font-sans text-sm text-muted">{s.demoNote}</p>}
          {s.task && taskDone && <p className="font-sans text-sm font-medium text-diminimal">Done.</p>}
        </div>
        {!welcome && (
          <div className="mt-3 flex gap-1" aria-hidden>
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < number ? 'bg-ink' : 'bg-line'}`} />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {welcome ? (
            <>
              <span className="font-sans text-xs text-muted">It can be reopened from the ? button.</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={stop}>
                Not now
              </Button>
              <Button ref={primaryRef} size="sm" onClick={next}>
                Take the tour
              </Button>
            </>
          ) : (
            <>
              <span className="font-sans text-xs text-muted">{s.task ? 'Your turn.' : 'Esc closes the tour.'}</span>
              {step > first && (
                <Button variant="outline" size="sm" className="ml-auto" onClick={back}>
                  Back
                </Button>
              )}
              {s.task && !taskDone ? (
                <>
                  <Button variant="ghost" size="sm" className={step > first ? '' : 'ml-auto'} onClick={next}>
                    Skip
                  </Button>
                  <Button ref={primaryRef} size="sm" onClick={() => s.task!.doIt((to) => navRef.current(to))}>
                    {s.task.doLabel}
                  </Button>
                </>
              ) : (
                <Button ref={primaryRef} size="sm" className={step > first ? '' : 'ml-auto'} onClick={next}>
                  {last ? 'Done' : 'Next'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
