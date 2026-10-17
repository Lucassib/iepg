import { useMemo, type ReactNode } from 'react'
import type { GlossaryEntry, ThesisStatement } from '../api/types'
import { lookupGlossary, useGlossary, useLabels, useNotation, useStatement } from '../api/hooks'
import { sameSymbol, SYMBOLS, type SymbolKey, type SymbolSpec } from '../lib/symbols'
import { Tooltip, TipCaption, TipTitle, type TooltipPlacement } from './ui/tooltip'
import { MathText, Tex } from './Tex'
import { cn } from '../lib/cn'

/** Dotted underline of a word or reference that has a tooltip. */
export const DOTTED = 'cursor-help underline decoration-muted/70 decoration-dotted decoration-1 underline-offset-[3px]'

// --- glossary -----------------------------------------------------------------------------------------------------

/** The definition, or the sentence that introduces the term, and its reference as a caption. */
export function GlossaryContent({ entry }: { entry: GlossaryEntry }) {
  return (
    <div>
      <MathText text={entry.text} />
      <TipCaption>{entry.ref}</TipCaption>
    </div>
  )
}

/** The glossary entry of `k` (case-insensitive, through `alias_of`), or null while loading or when it is missing. */
export function useGlossaryEntry(k: string): GlossaryEntry | null {
  const g = useGlossary()
  return useMemo(() => lookupGlossary(g.data, k), [g.data, k])
}

/**
 * A term of the thesis: the child with a dotted underline and the glossary text in a tooltip. A missing key renders
 * the child plainly. `focusable={false}` inside buttons (accordion headings, cards), where a tab stop is not allowed.
 */
export function Term({ k, children, focusable = true, className }: { k: string; children: ReactNode; focusable?: boolean; className?: string }) {
  const entry = useGlossaryEntry(k)
  if (!entry) return <>{children}</>
  return (
    <Tooltip content={<GlossaryContent entry={entry} />}>
      <span tabIndex={focusable ? 0 : undefined} className={cn(DOTTED, className)}>
        {children}
      </span>
    </Tooltip>
  )
}

/** The glossary text of `k` as the tooltip of any trigger (a badge, a button), which keeps its own look. */
export function GlossaryTip({ k, children, placement }: { k: string; children: ReactNode; placement?: TooltipPlacement }) {
  const entry = useGlossaryEntry(k)
  return (
    <Tooltip content={entry ? <GlossaryContent entry={entry} /> : null} placement={placement}>
      {children}
    </Tooltip>
  )
}

// --- numbered statements ------------------------------------------------------------------------------------------

/** Header "Theorem 6.12" (and the title of the statement, if any), then the statement word for word. */
export function StatementContent({ s }: { s: ThesisStatement }) {
  return (
    <div className="space-y-1">
      <TipTitle>
        {s.ref}
        {s.title && <span className="font-normal"> ({s.title})</span>}
      </TipTitle>
      {/* wide displayed matrices scroll inside the bubble, which stays open while the pointer is on it */}
      <div className="max-w-full overflow-x-auto pb-0.5">
        <MathText text={s.text} className="block" />
      </div>
    </div>
  )
}

/** The statement printed as `refText` in the tooltip of `children`; a reference not found keeps the child as it is. */
export function StatementTip({ refText, children, placement }: { refText: string; children: ReactNode; placement?: TooltipPlacement }) {
  const q = useStatement(refText)
  return (
    <Tooltip content={q.data ? <StatementContent s={q.data} /> : null} placement={placement}>
      {children}
    </Tooltip>
  )
}

/** A reference inside a sentence ("Theorem 6.12"): dotted underline and the statement in a tooltip when it is found. */
export function StatementRef({ refText, children, className }: { refText: string; children?: ReactNode; className?: string }) {
  const q = useStatement(refText)
  if (!q.data) return <span className={className}>{children ?? refText}</span>
  return (
    <Tooltip content={<StatementContent s={q.data} />}>
      <span tabIndex={0} className={cn(DOTTED, className)}>
        {children ?? refText}
      </span>
    </Tooltip>
  )
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * A backend sentence in which the given thesis references ("Theorem 6.12", the `thesis` list sent with it) become
 * StatementRefs. Only the listed references are linked, so theorem numbers of the cited papers are left alone.
 */
export function RefText({ text, refs }: { text: string; refs: string[] }) {
  const parts = useMemo(() => {
    const list = Array.from(new Set(refs.filter((r) => r.trim() !== ''))).sort((a, b) => b.length - a.length)
    if (list.length === 0) return [text]
    const re = new RegExp(`(${list.map(escapeRe).join('|')})(?![\\d]|\\.\\d)`, 'g')
    return text.split(re)
  }, [text, refs])
  const set = useMemo(() => new Set(refs), [refs])
  return (
    <>
      {parts.map((p, i) => (set.has(p) && i % 2 === 1 ? <StatementRef key={i} refText={p} /> : <PlainMath key={i} text={p} />))}
    </>
  )
}

/**
 * The names of seeds in the sentences of the backend, written in plain text there ("S_6^(7)", "R_2 ⊙ R_5", "S^(2,5)_9"),
 * and any $…$, shown as formulas.
 */
const PLAIN_MATH: [RegExp, (m: RegExpExecArray) => string][] = [
  [/\$([^$]+)\$/y, (m) => m[1]],
  [/R_(\d+|[ij]) ⊙ R_(\d+|[ij])/y, (m) => `R_{${m[1]}}\\odot R_{${m[2]}}`],
  [/R̂_(\d+)/y, (m) => `\\widehat R_{${m[1]}}`],
  [/D\(R_(\d+)\)/y, (m) => `\\mathcal D(R_{${m[1]}})`],
  [/S_6\^\((\d+)\)/y, (m) => `S_6^{(${m[1]})}`],
  [/S\^\((\d+),(\d+)\)_(\d+)/y, (m) => `S^{(${m[1]},${m[2]})}_{${m[3]}}`],
  [/S\^\[(\d+)\]_(\d+)/y, (m) => `S^{[${m[1]}]}_{${m[2]}}`],
  [/S\^\((\d)\)_(\d+)/y, (m) => `S^{(${m[1]})}_{${m[2]}}`],
  [/S('{1,2})_(\d+)/y, (m) => `S${m[1]}_{${m[2]}}`],
  [/S_(\d+|d)(?![\w^(])/y, (m) => `S_{${m[1]}}`],
  [/R_(\d+)(?![\w^])/y, (m) => `R_{${m[1]}}`],
]

export function PlainMath({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: (string | { tex: string })[] = []
    let plain = ''
    for (let i = 0; i < text.length; ) {
      let hit: { tex: string; len: number } | null = null
      if (i === 0 || !/[\w^]/.test(text[i - 1])) {
        for (const [re, tex] of PLAIN_MATH) {
          re.lastIndex = i
          const m = re.exec(text)
          if (m) {
            hit = { tex: tex(m), len: m[0].length }
            break
          }
        }
      }
      if (hit) {
        if (plain) out.push(plain)
        plain = ''
        out.push({ tex: hit.tex })
        i += hit.len
      } else {
        plain += text[i]
        i += 1
      }
    }
    if (plain) out.push(plain)
    return out
  }, [text])
  return <>{parts.map((p, i) => (typeof p === 'string' ? <span key={i}>{p}</span> : <Tex key={i} tex={p.tex} />))}</>
}

// --- symbols ------------------------------------------------------------------------------------------------------

/** "Section 6.3" for a label of the thesis, from GET /labels. */
function LabelRefText({ label, prefix = '' }: { label: string; prefix?: string }) {
  const q = useLabels([label])
  const e = q.data?.[label]
  return (
    <>
      {prefix}
      {e && e.number ? e.ref : ''}
    </>
  )
}

/** The tooltip content of a symbol, or null when neither the thesis text nor the notation table has it. */
function useSymbolContent(spec: SymbolSpec): ReactNode {
  const notation = useNotation()
  const glossary = useGlossary()
  return useMemo(() => {
    if (spec.quote) {
      const g = spec.quote.refFromGlossary ? lookupGlossary(glossary.data, spec.quote.refFromGlossary) : null
      return (
        <div className="space-y-1">
          <TipTitle>
            <Tex tex={spec.tex} />
          </TipTitle>
          <MathText text={spec.quote.text} className="block" />
          <TipCaption>
            {spec.quote.refLabel ? <LabelRefText label={spec.quote.refLabel} prefix={spec.quote.refPrefix} /> : (spec.quote.refPrefix ?? '') + (g?.ref ?? '')}
          </TipCaption>
        </div>
      )
    }
    const entry = spec.glossary ? lookupGlossary(glossary.data, spec.glossary) : null
    if (entry)
      return (
        <div className="space-y-1">
          <TipTitle>
            <Tex tex={spec.tex} />
          </TipTitle>
          <GlossaryContent entry={entry} />
        </div>
      )
    const row = spec.notation ? notation.data?.find((r) => sameSymbol(r.symbol, spec.notation!)) : undefined
    if (row)
      return (
        <div className="space-y-1">
          <TipTitle>
            <Tex tex={row.symbol} />
          </TipTitle>
          <MathText text={row.meaning} className="block" />
          <TipCaption>Notation, {row.where}</TipCaption>
        </div>
      )
    if (spec.text)
      return (
        <div className="space-y-1">
          <TipTitle>
            <Tex tex={spec.tex} />
          </TipTitle>
          <MathText text={spec.text} className="block" />
          {spec.source && <TipCaption>{spec.source}</TipCaption>}
        </div>
      )
    return null
  }, [spec, notation.data, glossary.data])
}

/**
 * A symbol shown as a label (q(M), 𝒵(M), γ_L, S_d, …) with its meaning in a tooltip. The children are the symbol as
 * drawn on the page; they keep their look (no underline) unless `underline` is set.
 */
export function SymbolTip({
  s,
  children,
  underline = false,
  focusable = true,
  className,
}: {
  s: SymbolKey
  children: ReactNode
  underline?: boolean
  focusable?: boolean
  className?: string
}) {
  const content = useSymbolContent(SYMBOLS[s])
  if (!content) return <>{children}</>
  return (
    <Tooltip content={content}>
      <span tabIndex={focusable ? 0 : undefined} className={cn('cursor-help', underline && DOTTED, className)}>
        {children}
      </span>
    </Tooltip>
  )
}
