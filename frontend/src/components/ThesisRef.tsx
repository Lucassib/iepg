import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLabels } from '../api/hooks'
import type { LabelsResponse } from '../api/types'
import { StatementRef } from './ThesisTips'

/** undefined: no ThesisLabels above; null: its numbers are loading */
const LabelsCtx = createContext<LabelsResponse | null | undefined>(undefined)

/** Loads the numbers of the given thesis labels once for a page; ThesisRef inside reads them. */
export function ThesisLabels({ keys, children }: { keys: string[]; children: ReactNode }) {
  const q = useLabels(keys)
  return <LabelsCtx.Provider value={q.data ?? null}>{children}</LabelsCtx.Provider>
}

/**
 * "Proposition 6.20" for label="prop:generic"; `number` alone gives "6.20". Falls back to the key while loading.
 * A numbered statement shows its text in a tooltip; `plain` gives the bare text (inside another tooltip).
 */
export function ThesisRef({ label, number = false, plain = false, className }: { label: string; number?: boolean; plain?: boolean; className?: string }) {
  const labels = useContext(LabelsCtx)
  // outside a ThesisLabels provider, or when the provider does not list it, the reference loads its own number
  const own = useLabels(labels === undefined || (labels !== null && !(label in labels)) ? [label] : [])
  const entry = labels?.[label] ?? own.data?.[label]
  const text = entry ? (number ? (entry.number ?? entry.ref) : entry.ref) : label
  if (!entry || entry.number === null || plain)
    return (
      <span className={className} title={entry ? undefined : label}>
        {text}
      </span>
    )
  return (
    <StatementRef refText={entry.ref} className={className}>
      {text}
    </StatementRef>
  )
}

/** Plain-text version for strings (e.g. titles). */
export function useThesisRef(label: string): string {
  const labels = useContext(LabelsCtx)
  return labels?.[label]?.ref ?? label
}

const KEY = '(?:prop|thm|lem|def|rem|cor|eq|alg):[A-Za-z0-9_-]*[A-Za-z0-9]'
const KEYS_RE = new RegExp(`\\b${KEY}`, 'g')
const WITH_WORD_RE = new RegExp(`(\\b[A-Z][a-z]+\\s+)?(${KEY})`, 'g')

/** One replacement of resolveLabelParts: the printed reference ("Lemma 6.27") of a raw label, or the text as it was. */
type Part = string | { ref: string }

/** The pieces of a backend sentence, with the raw labels ("Lemma lem:six-arms") replaced by their references. */
function resolveLabelParts(text: string, labels: LabelsResponse | null | undefined): Part[] {
  if (!labels) return [text]
  const out: Part[] = []
  let last = 0
  for (const m of text.matchAll(WITH_WORD_RE)) {
    const [whole, word, key] = m
    const at = m.index ?? 0
    const e = labels[key]
    if (!e || e.number === null) continue
    const kind = e.ref.split(' ')[0]
    out.push(text.slice(last, at))
    if (word && word.trim() !== kind) out.push(word)
    out.push({ ref: e.ref })
    last = at + whole.length
  }
  out.push(text.slice(last))
  return out
}

/** Replaces raw labels in a backend sentence by their numbers: "Lemma lem:six-arms" → "Lemma 6.27". */
export function resolveLabels(text: string, labels: LabelsResponse | null | undefined): string {
  return resolveLabelParts(text, labels)
    .map((p) => (typeof p === 'string' ? p : p.ref))
    .join('')
}

/** A backend sentence with its thesis labels resolved (the raw text is shown while the numbers load); the resolved references show their statements. */
export function LabelledText({ text }: { text: string }) {
  const keys = useMemo(() => Array.from(new Set(text.match(KEYS_RE) ?? [])), [text])
  const q = useLabels(keys)
  const parts = useMemo(() => resolveLabelParts(text, q.data), [text, q.data])
  return (
    <>
      {parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <StatementRef key={i} refText={p.ref} />))}
    </>
  )
}
