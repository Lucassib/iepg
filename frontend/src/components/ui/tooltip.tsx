import {
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

/**
 * Tooltips. One tooltip is open at a time (a tiny global store holds the id of the open one). A tooltip opens on
 * hover after a delay (at once while another one was just open), and on keyboard focus; it closes on Esc, blur and
 * leave. On touch, a tap toggles it, except on controls, where a tap keeps its action. The bubble is rendered in a
 * portal on document.body, so no `overflow` container clips it, and, being a portal of the trigger, it keeps the
 * React context of the page (thesis labels, query client).
 */

export type TooltipPlacement = 'top' | 'bottom' | 'right'

// --- one tooltip at a time ----------------------------------------------------------------------------------------

let openId: string | null = null
let lastClose = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const tooltipStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  open(id: string) {
    if (openId !== id) {
      openId = id
      emit()
    }
  },
  close(id: string) {
    if (openId === id) {
      openId = null
      lastClose = performance.now()
      emit()
    }
  },
  isOpen(id: string) {
    return openId === id
  },
  /** another tooltip is open, or was a moment ago: the next one opens without delay */
  warm() {
    return openId !== null || performance.now() - lastClose < 400
  },
}

function useIsOpen(id: string): boolean {
  return useSyncExternalStore(
    tooltipStore.subscribe,
    () => openId === id,
    () => false,
  )
}

function useTipId(): string {
  return 'tip-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

// --- input modality: focus opens a tooltip only when it comes from the keyboard ------------------------------------

let keyboardModality = false
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) keyboardModality = true
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    () => {
      keyboardModality = false
    },
    true,
  )
}

/** Elements whose tap keeps its own action on touch devices (the tooltip does not intercept it). */
const INTERACTIVE =
  'a[href], button, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="gridcell"], [role="link"], [role="menuitem"]'

// --- positioning --------------------------------------------------------------------------------------------------

const MARGIN = 8
const GAP = 6

function computePosition(r: DOMRect, w: number, h: number, placement: TooltipPlacement): { left: number; top: number } {
  const vw = document.documentElement.clientWidth || window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - MARGIN - w))
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - MARGIN - h))
  if (placement === 'right' && r.right + GAP + w <= vw - MARGIN) return { left: r.right + GAP, top: clampY(r.top + r.height / 2 - h / 2) }
  const above = r.top - GAP - h
  const below = r.bottom + GAP
  const fitsAbove = above >= MARGIN
  const fitsBelow = below + h <= vh - MARGIN
  let top: number
  if (!fitsAbove && !fitsBelow) top = r.top > vh - r.bottom ? above : below
  else if (placement === 'bottom') top = fitsBelow ? below : above
  else top = fitsAbove ? above : below
  return { left: clampX(r.left + r.width / 2 - w / 2), top: clampY(top) }
}

const BUBBLE =
  'fixed z-[60] max-h-[min(26rem,70vh)] overflow-y-auto rounded-md border border-line bg-surface px-2.5 py-1.5 text-left font-sans text-[0.85rem] font-normal normal-case leading-snug tracking-normal whitespace-normal text-ink shadow-[0_2px_10px_rgba(0,0,0,0.14)]'

function Bubble({
  id,
  anchor,
  placement,
  children,
  onEnter,
  onLeave,
}: {
  id: string
  anchor: Element
  placement: TooltipPlacement
  children: ReactNode
  onEnter: () => void
  onLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      if (!anchor.isConnected) {
        tooltipStore.close(id)
        return
      }
      const r = anchor.getBoundingClientRect()
      const vw = document.documentElement.clientWidth || window.innerWidth
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > vw) {
        tooltipStore.close(id)
        return
      }
      const p = computePosition(r, el.offsetWidth, el.offsetHeight, placement)
      setPos((old) => (old && old.left === p.left && old.top === p.top ? old : p))
    }
    update()
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    ro?.observe(el)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
    }
  }, [anchor, placement, id])

  // Esc closes the tooltip first (and only the tooltip: dialogs and pages see the next Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        tooltipStore.close(id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [id])

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={BUBBLE}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden', maxWidth: 'min(34rem, calc(100vw - 16px))' }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {children}
    </div>,
    document.body,
  )
}

// --- declarative tooltip ------------------------------------------------------------------------------------------

export type TooltipProps = {
  /** null, undefined or false: the children are rendered without a tooltip */
  content: ReactNode
  children: ReactNode
  placement?: TooltipPlacement
  delay?: number
  /**
   * Wrap the trigger in an inline-flex box instead of a `display: contents` span. Needed when the trigger can be
   * disabled (a disabled button receives no pointer events); chosen automatically when the child has a `disabled` prop.
   */
  box?: boolean
  /** classes of the box wrapper (default "inline-flex"; "block" for a block trigger such as a menu item) */
  className?: string
}

/** Wraps one trigger (a button, an input, a span of text) and shows `content` in a bubble above it. */
export function Tooltip({ content, children, placement = 'top', delay = 250, box, className }: TooltipProps) {
  const id = useTipId()
  const wrap = useRef<HTMLSpanElement>(null)
  const open = useIsOpen(id)
  const [anchor, setAnchor] = useState<Element | null>(null)
  const openTimer = useRef(0)
  const closeTimer = useRef(0)
  const pointer = useRef('mouse')
  const viaTouch = useRef(false)
  const suppressed = useRef(false)
  const useBox = box ?? (isValidElement(children) && (children.props as { disabled?: unknown }).disabled !== undefined)

  const clear = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }
  const anchorEl = (): Element | null => {
    const w = wrap.current
    if (!w) return null
    return useBox ? w : (w.firstElementChild ?? null)
  }
  const show = (immediate: boolean) => {
    clear()
    const go = () => {
      const a = anchorEl()
      if (!a) return
      setAnchor(a)
      tooltipStore.open(id)
    }
    if (immediate || tooltipStore.warm()) go()
    else openTimer.current = window.setTimeout(go, delay)
  }
  const hide = (immediate = false) => {
    clear()
    if (immediate) tooltipStore.close(id)
    else closeTimer.current = window.setTimeout(() => tooltipStore.close(id), 100)
  }

  // the trigger is described by the bubble while it is open
  useEffect(() => {
    const t = wrap.current?.firstElementChild
    if (!open || !t) return
    const prev = t.getAttribute('aria-describedby')
    t.setAttribute('aria-describedby', prev ? `${prev} ${id}` : id)
    return () => {
      if (prev) t.setAttribute('aria-describedby', prev)
      else t.removeAttribute('aria-describedby')
    }
  }, [open, id])

  // opened by a tap: a tap anywhere else closes it
  useEffect(() => {
    if (!open || !viaTouch.current) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (t && (wrap.current?.contains(t) || document.getElementById(id)?.contains(t))) return
      tooltipStore.close(id)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, id])

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
      tooltipStore.close(id)
    },
    [id],
  )

  if (content === null || content === undefined || content === false) return <>{children}</>

  const handlers = {
    onPointerEnter: (e: ReactPointerEvent) => {
      if (e.pointerType === 'touch') return
      viaTouch.current = false
      if (!suppressed.current) show(false)
    },
    onPointerLeave: (e: ReactPointerEvent) => {
      if (e.pointerType === 'touch') return
      suppressed.current = false
      hide()
    },
    onPointerDown: (e: ReactPointerEvent) => {
      pointer.current = e.pointerType
      if (e.pointerType !== 'touch') {
        // a click hides the tooltip until the pointer leaves the trigger
        suppressed.current = true
        hide(true)
      }
    },
    onFocus: () => {
      if (keyboardModality) {
        viaTouch.current = false
        show(true)
      }
    },
    onBlur: () => hide(true),
    onClick: (e: ReactMouseEvent) => {
      if (pointer.current !== 'touch') return
      const a = anchorEl()
      if (!a || a.closest(INTERACTIVE)) return
      e.preventDefault()
      e.stopPropagation()
      viaTouch.current = true
      if (tooltipStore.isOpen(id)) hide(true)
      else show(true)
    },
  }

  return (
    <>
      <span ref={wrap} className={useBox ? cn(className ?? 'inline-flex') : 'contents'} {...handlers}>
        {children}
      </span>
      {open && anchor && (
        <Bubble id={id} anchor={anchor} placement={placement} onEnter={() => window.clearTimeout(closeTimer.current)} onLeave={() => hide()}>
          {content}
        </Bubble>
      )}
    </>
  )
}

// --- imperative tooltip, for event delegation (tree vertices, matrix cells) ----------------------------------------

export type FloatingTipHandle = {
  /**
   * shows `content` at `anchor`, after the hover delay unless a tooltip is already open or `immediate`; a pointer
   * press outside the bubble and outside `owner` (default: the anchor) closes it
   */
  show: (anchor: Element, content: ReactNode, immediate?: boolean, owner?: Element) => void
  hide: (immediate?: boolean) => void
  isOpen: () => boolean
}

/**
 * A single tooltip driven by a parent that handles the events itself (one element for a whole drawing or table,
 * no per-item state). The parent does not re-render when the tooltip moves.
 */
export const FloatingTip = forwardRef<FloatingTipHandle, { placement?: TooltipPlacement; delay?: number }>(function FloatingTip(
  { placement = 'top', delay = 250 },
  ref,
) {
  const id = useTipId()
  const open = useIsOpen(id)
  const [state, setState] = useState<{ anchor: Element; content: ReactNode; owner: Element } | null>(null)
  const timer = useRef(0)

  useImperativeHandle(
    ref,
    () => ({
      show(anchor, content, immediate = false, owner) {
        window.clearTimeout(timer.current)
        const go = () => {
          setState({ anchor, content, owner: owner ?? anchor })
          tooltipStore.open(id)
        }
        if (immediate || tooltipStore.warm()) go()
        else timer.current = window.setTimeout(go, delay)
      },
      hide(immediate = false) {
        window.clearTimeout(timer.current)
        if (immediate) tooltipStore.close(id)
        else timer.current = window.setTimeout(() => tooltipStore.close(id), 80)
      },
      isOpen: () => tooltipStore.isOpen(id),
    }),
    [id, delay],
  )

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      tooltipStore.close(id)
    },
    [id],
  )

  // a press elsewhere closes it (touch users have no pointer leave)
  const owner = open ? state?.owner : undefined
  useEffect(() => {
    if (!owner) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (t && (owner.contains(t) || document.getElementById(id)?.contains(t))) return
      tooltipStore.close(id)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [owner, id])

  if (!open || !state) return null
  return (
    <Bubble
      id={id}
      anchor={state.anchor}
      placement={placement}
      onEnter={() => window.clearTimeout(timer.current)}
      onLeave={() => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => tooltipStore.close(id), 80)
      }}
    >
      {state.content}
    </Bubble>
  )
})

// --- content helpers ----------------------------------------------------------------------------------------------

/** The bold first line of a tooltip ("Theorem 6.12", "vertex 3 · degree 2"). */
export function TipTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('font-semibold', className)}>{children}</div>
}

/** The small muted caption under a tooltip text (the reference "Definition 6.9"). */
export function TipCaption({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-1 text-[0.75rem] text-muted', className)}>{children}</div>
}
