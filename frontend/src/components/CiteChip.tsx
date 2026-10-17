import { useState } from 'react'
import { useBibEntry } from '../api/hooks'
import type { BibEntry } from '../api/types'
import { Popover } from './ui/popover'
import { Button } from './ui/button'
import { ErrorNote, Loading } from './ErrorNote'

export function copyText(text: string) {
  try {
    void navigator.clipboard?.writeText(text)
  } catch {
    /* clipboard unavailable */
  }
}

/** A formatted bibliography entry with links and a "copy BibTeX" button. Span-based so it can live inside a paragraph. */
export function BibEntryView({ entry, usedIn }: { entry: BibEntry; usedIn?: string[] }) {
  const [copied, setCopied] = useState(false)
  const link = 'underline decoration-line underline-offset-2 hover:decoration-ink'
  return (
    <span className="block space-y-1.5">
      <span className="block font-serif text-sm leading-snug">{entry.formatted}</span>
      <span className="flex flex-wrap items-center gap-2 font-sans text-xs">
        {entry.doi && (
          <a className={link} href={`https://doi.org/${entry.doi}`} target="_blank" rel="noreferrer">
            doi:{entry.doi}
          </a>
        )}
        {entry.arxiv && (
          <a className={link} href={`https://arxiv.org/abs/${entry.arxiv}`} target="_blank" rel="noreferrer">
            arXiv:{entry.arxiv}
          </a>
        )}
        {entry.url && !entry.doi && !entry.arxiv && (
          <a className={link} href={entry.url} target="_blank" rel="noreferrer">
            link
          </a>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            copyText(entry.bibtex)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied' : 'Copy BibTeX'}
        </Button>
        <span className="mono text-muted">{entry.key}</span>
      </span>
      {usedIn && usedIn.length > 0 && <span className="block font-sans text-xs text-muted">Used in: {usedIn.join(', ')}</span>}
    </span>
  )
}

/**
 * Inline citation chip, e.g. [Johnson and Saiago 2016]: the short label of the entry (or `text` when given),
 * the key only while the entry loads. Click opens the formatted entry.
 * Every statement attributed to the literature carries one of these.
 */
export function CiteChip({ citeKey, text, usedIn }: { citeKey: string; text?: string; usedIn?: string[] }) {
  const [open, setOpen] = useState(false)
  const q = useBibEntry(citeKey)
  const entry = q.data ?? null
  const label = text ?? entry?.short ?? citeKey
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={entry?.formatted}
          className="ml-0.5 inline-flex items-center rounded border border-line bg-surface px-1.5 py-0 align-baseline font-sans text-[0.8em] leading-5 text-ink hover:border-ink"
        >
          [{label}]
        </button>
      }
    >
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} />}
      {entry ? <BibEntryView entry={entry} usedIn={usedIn} /> : q.isSuccess && <span className="text-muted">No entry for key {citeKey}.</span>}
    </Popover>
  )
}

/** A row of chips for a list of bib keys. */
export function CiteChips({ keys, className }: { keys: string[]; className?: string }) {
  if (!keys || keys.length === 0) return null
  return (
    <span className={className}>
      {keys.map((k) => (
        <CiteChip key={k} citeKey={k} />
      ))}
    </span>
  )
}
