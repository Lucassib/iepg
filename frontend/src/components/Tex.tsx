import { useMemo } from 'react'
import katex from 'katex'
import { useKatexMacros } from '../lib/katexMacros'
import { cn } from '../lib/cn'

/** Renders a TeX string with KaTeX. Labels such as S_6^{(3)} or R_2 \odot R_5 come from the API as TeX. */
export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const macros = useKatexMacros()
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        throwOnError: false,
        displayMode: display,
        // MathML next to the HTML, so screen readers read the formulas
        output: 'htmlAndMathml',
        strict: 'ignore',
        // a copy: KaTeX writes \gdef definitions into the object it is given
        macros: macros ? { ...macros } : undefined,
      }),
    [tex, display, macros],
  )
  return <span className={cn(display ? 'block' : 'inline', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

const SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g

/** Prose with $...$, $$...$$, \(...\) and \[...\] segments rendered as math (thesis statements, summaries, history). */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(SPLIT), [text])
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith('$$') && p.endsWith('$$') && p.length > 4) return <Tex key={i} tex={p.slice(2, -2)} display />
        if (p.startsWith('$') && p.endsWith('$') && p.length > 2) return <Tex key={i} tex={p.slice(1, -1)} />
        if (p.startsWith('\\[') && p.endsWith('\\]') && p.length > 4) return <Tex key={i} tex={p.slice(2, -2)} display />
        if (p.startsWith('\\(') && p.endsWith('\\)') && p.length > 4) return <Tex key={i} tex={p.slice(2, -2)} />
        return <span key={i}>{p}</span>
      })}
    </span>
  )
}
