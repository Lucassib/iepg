import { useMemo } from 'react'
import { useBibliography } from '../api/hooks'
import { allKeys, useReferences } from '../store/references'
import { BibEntryView } from './CiteChip'
import { ErrorNote, Loading } from './ErrorNote'

/** Right-side panel: references cited by the sections currently open, grouped by section. */
export function ReferencesPanel() {
  const sections = useReferences((s) => s.sections)
  const keys = useMemo(() => allKeys(sections), [sections])
  const q = useBibliography(keys)
  const byKey = useMemo(() => new Map((q.data ?? []).map((e) => [e.key, e])), [q.data])
  const ordered = useMemo(
    () => Object.values(sections).filter((s) => s.keys.length > 0).sort((a, b) => a.order - b.order),
    [sections],
  )

  return (
    <aside aria-label="References on this page" className="font-sans text-sm">
      <h2 className="mb-2 font-serif text-base font-semibold">References on this page</h2>
      {ordered.length === 0 && <p className="text-muted">Open a section that cites the literature and its references will appear here.</p>}
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} className="mb-2" />}
      <div className="space-y-4">
        {ordered.map((s) => (
          <div key={s.id}>
            <h3 className="mb-1 font-sans text-xs font-semibold tracking-wide text-muted">{s.title}</h3>
            <ul className="space-y-3">
              {s.keys.map((k) => {
                const e = byKey.get(k)
                return (
                  <li key={k} className="border-l-2 border-line pl-2">
                    {e ? <BibEntryView entry={e} /> : <span className="mono text-xs text-muted">{k}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  )
}
