import { createContext, useContext, type ReactNode } from 'react'
import { useMacros } from '../api/hooks'

const MacrosCtx = createContext<Record<string, string> | undefined>(undefined)

/** Loads the thesis macros once (GET /macros) and hands them to every Tex below, so \DSpec, \tL, \lmin{j} render. */
export function KatexMacrosProvider({ children }: { children: ReactNode }) {
  const q = useMacros()
  return <MacrosCtx.Provider value={q.data}>{children}</MacrosCtx.Provider>
}

/** The thesis macros for KaTeX (undefined while loading or when the backend is down). */
export function useKatexMacros(): Record<string, string> | undefined {
  return useContext(MacrosCtx)
}
