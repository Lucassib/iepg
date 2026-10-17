import { useStatement } from '../api/hooks'
import { Badge } from './ui/badge'
import { Tooltip } from './ui/tooltip'
import { CiteChips } from './CiteChip'
import { StatementContent } from './ThesisTips'

/**
 * A reference to a statement of the thesis as an outline badge ("Theorem 6.12"). Hovering it shows the statement word
 * for word (GET /statements-by-ref, batched per page); a reference that is not a numbered statement keeps its look.
 */
export function ThesisChip({ refText }: { refText: string }) {
  const q = useStatement(refText)
  if (!q.data) return <Badge variant="outline">{refText}</Badge>
  return (
    <Tooltip content={<StatementContent s={q.data} />}>
      <Badge variant="outline" tabIndex={0} className="cursor-help hover:border-ink hover:text-ink">
        {refText}
      </Badge>
    </Tooltip>
  )
}

/** Labels of the thesis statements used ("Theorem 6.12", "Definition 4.18"), optionally followed by citation chips. */
export function ThesisBadges({ labels, references, className }: { labels: string[]; references?: string[]; className?: string }) {
  if (labels.length === 0 && (!references || references.length === 0)) return null
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-1.5'}>
      {labels.map((t) => (
        <ThesisChip key={t} refText={t} />
      ))}
      {references && <CiteChips keys={references} />}
    </div>
  )
}
