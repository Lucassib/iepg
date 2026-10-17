import { useMemo } from 'react'
import { useQuestions } from '../api/hooks'
import { Section } from '../components/Section'
import { MathText, Tex } from '../components/Tex'
import { CiteChips } from '../components/CiteChip'
import { ErrorNote, Loading } from '../components/ErrorNote'
import { ThesisChip } from '../components/ThesisBadges'
import { Term } from '../components/ThesisTips'
import { glossSegments, type GlossSegment } from '../lib/glossText'

/** Glossary terms linked at their first occurrence on the page (longer phrases win over their parts). */
const TERMS = [
  'diminimal seed',
  'defective seed',
  'rooted seed',
  'brick',
  'unfolding',
  'seed',
  'diminimal',
  'main root',
  'latent value',
  'realization',
  'regular s-algebraic branch duplication',
  'tower',
  'admissible',
]

/** Prose with math, where the term segments carry the glossary tooltip. */
function GlossedText({ segments }: { segments: GlossSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.term ? (
          <Term key={i} k={s.term}>
            {s.text}
          </Term>
        ) : (
          <MathText key={i} text={s.text} />
        ),
      )}
    </>
  )
}

/** Statements come either as prose with $...$ or as a bare TeX expression. */
export function Statement({ text, className }: { text: string; className?: string }) {
  const bareTex = !text.includes('$') && /\\[a-zA-Z]+/.test(text)
  return bareTex ? <Tex tex={text} display className={className} /> : <MathText text={text} className={className} />
}

export function QuestionsPage() {
  const q = useQuestions()
  // the first occurrence of each term on the page, in reading order, question by question
  const glossed = useMemo(() => {
    const used = new Set<string>()
    return (q.data ?? []).map((item) => {
      const bare = !item.statement.includes('$') && /\\[a-zA-Z]+/.test(item.statement)
      return { statement: bare ? null : glossSegments(item.statement, TERMS, used) }
    })
  }, [q.data])
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Open questions</h1>
      <p className="prose">The questions of the last chapter of the thesis, each with the results it relates to.</p>
      {q.isLoading && <Loading />}
      {q.error && <ErrorNote error={q.error} />}
      {q.data?.map((item, i) => (
        <Section key={item.id} id={`question-${item.id}`} title={`Question ${i + 1} (${item.id})`} citeKeys={item.references} defaultOpen={i === 0}>
          <div className="space-y-2">
            <p className="prose">
              {glossed[i]?.statement ? <GlossedText segments={glossed[i].statement!} /> : <Statement text={item.statement} />}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {item.thesis.map((t) => (
                <ThesisChip key={t} refText={t} />
              ))}
              <CiteChips keys={item.references} />
            </div>
          </div>
        </Section>
      ))}
      {q.isSuccess && q.data.length === 0 && <p className="font-sans text-sm text-muted">No questions returned by the API.</p>}
    </div>
  )
}
