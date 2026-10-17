import { create } from 'zustand'

export type OpenSection = { id: string; title: string; keys: string[]; order: number }

type ReferencesState = {
  sections: Record<string, OpenSection>
  counter: number
  openSection: (id: string, title: string, keys: string[]) => void
  closeSection: (id: string) => void
  reset: () => void
}

/** Sections that are currently open on the page, with the bib keys they cite. */
export const useReferences = create<ReferencesState>((set) => ({
  sections: {},
  counter: 0,
  openSection: (id, title, keys) =>
    set((s) => {
      const prev = s.sections[id]
      const order = prev ? prev.order : s.counter + 1
      return { sections: { ...s.sections, [id]: { id, title, keys, order } }, counter: prev ? s.counter : s.counter + 1 }
    }),
  closeSection: (id) =>
    set((s) => {
      if (!s.sections[id]) return s
      const next = { ...s.sections }
      delete next[id]
      return { sections: next }
    }),
  reset: () => set({ sections: {} }),
}))

export function allKeys(sections: Record<string, OpenSection>): string[] {
  const keys = new Set<string>()
  for (const s of Object.values(sections)) for (const k of s.keys) keys.add(k)
  return Array.from(keys)
}
