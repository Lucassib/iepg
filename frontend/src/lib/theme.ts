import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'iepg-theme'

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode
}

function apply(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', resolveTheme(mode))
}

type ThemeState = { mode: ThemeMode; setMode: (m: ThemeMode) => void }

export const useTheme = create<ThemeState>((set) => ({
  mode: readStored(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* storage unavailable */
    }
    apply(mode)
    set({ mode })
  },
}))

/** Applies the stored mode (the inline script in index.html already did) and follows system changes. */
export function initTheme() {
  apply(useTheme.getState().mode)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => {
    if (useTheme.getState().mode === 'system') apply('system')
  })
}
