import { create } from 'zustand'

/**
 * The guided tours. `site` opens by itself on the first visit; the page tours open from the help menu. Whether a
 * tour was seen is kept in localStorage, per browser; when storage is unavailable nothing opens by itself.
 */
export type TourId = 'site' | 'playground' | 'analyze'

const KEY = (id: TourId) => `iepg-tour-${id}`

function readSeen(id: TourId): boolean | null {
  try {
    return localStorage.getItem(KEY(id)) !== null
  } catch {
    return null // storage unavailable
  }
}

function writeSeen(id: TourId) {
  try {
    localStorage.setItem(KEY(id), new Date().toISOString().slice(0, 10))
  } catch {
    /* storage unavailable */
  }
}

type TourState = {
  tour: TourId | null
  step: number
  /** +1 while moving forward, -1 backward: an optional step whose target is missing is skipped in this direction */
  dir: 1 | -1
  /** null: storage unavailable */
  seen: Record<TourId, boolean | null>
  start: (id: TourId) => void
  go: (step: number) => void
  stop: () => void
}

export const useTour = create<TourState>((set, get) => ({
  tour: null,
  step: 0,
  dir: 1,
  seen: { site: readSeen('site'), playground: readSeen('playground'), analyze: readSeen('analyze') },
  start: (id) => set({ tour: id, step: 0, dir: 1 }),
  go: (step) => set({ step, dir: step >= get().step ? 1 : -1 }),
  stop: () => {
    const id = get().tour
    if (id) {
      writeSeen(id)
      set((s) => ({ tour: null, step: 0, seen: { ...s.seen, [id]: s.seen[id] === null ? null : true } }))
    }
  },
}))

/** The page tour of a path, if the path has one. */
export function pageTourOf(pathname: string): TourId | null {
  if (pathname === '/playground') return 'playground'
  if (pathname === '/analyze' || pathname.startsWith('/tree/')) return 'analyze'
  return null
}
