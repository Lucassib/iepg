import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Section } from '../components/Section'
import { BibEntryView } from '../components/CiteChip'
import { ThesisRef } from '../components/ThesisRef'
import { Tex } from '../components/Tex'
import { useBibliography } from '../api/hooks'
import { Button } from '../components/ui/button'
import { TOURS } from '../components/tour/tours'
import { useTour, type TourId } from '../lib/tour'

export function AboutPage() {
  const { hash } = useLocation()
  const start = useTour((s) => s.start)
  const bib = useBibliography(['allem2026iepg', 'allem2026iepgcode', 'allem2026minimum', 'allem2023diminimal'])
  // again once the references have arrived, since they push the sections below them down
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ block: 'start' })
  }, [hash, bib.data])
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">About</h1>
      <Section id="about-thesis" title="The thesis">
        <div className="prose space-y-2">
          <p>
            This application accompanies the PhD thesis <i>On the minimum number of distinct eigenvalues of a tree</i>, by Lucas Siviero Sibemberg, Graduate Program
            in Applied Mathematics, Universidade Federal do Rio Grande do Sul (UFRGS), Porto Alegre, 2026, advised by Luiz Emilio Allem and co-advised by Carlos Hoppen.
            Every statement shown here is taken from the thesis or from the cited literature, and every matrix shown is computed and checked in exact arithmetic.
          </p>
        </div>
      </Section>
      <Section id="about-cite" title="How to cite this site">
        <div className="space-y-3">
          {bib.data
            ?.filter((e) => e.key === 'allem2026iepg' || e.key === 'allem2026iepgcode')
            .map((e) => (
              <BibEntryView key={e.key} entry={e} />
            ))}
        </div>
      </Section>
      <Section id="about-papers" title="Papers">
        <div className="space-y-3">
          <p className="prose">Two papers on the subject of the thesis have been published.</p>
          {(['allem2026minimum', 'allem2023diminimal'] as const).map((k) => {
            const e = bib.data?.find((x) => x.key === k)
            return e ? (
              <div key={k} className="space-y-1">
                <BibEntryView entry={e} />
                <p className="prose text-[0.95rem] text-muted">
                  {k === 'allem2026minimum' ? (
                    <>
                      It contains the results of <ThesisRef label="chap:d6" plain />, namely <ThesisRef label="thm:d6-classification" />,{' '}
                      <ThesisRef label="q8thm" /> and <ThesisRef label="cor:C6" />.
                    </>
                  ) : (
                    <>
                      It introduced the seeds <Tex tex="S_d" /> and the strongly realizable sets, and its main result is recovered in{' '}
                      <ThesisRef label="chap:diminimal" plain /> by <ThesisRef label="thm:C" /> and <ThesisRef label="sec:new-seeds-bricks" />.
                    </>
                  )}
                </p>
              </div>
            ) : null
          })}
          <p className="prose">
            The remaining results are the subject of two manuscripts in preparation. The first contains the bricks of <ThesisRef label="chap:diminimal" plain /> and{' '}
            <ThesisRef label="many_seeds" /> and <ThesisRef label="thm:C" />, and the second contains the propagation theorems of <ThesisRef label="chap:almost" plain /> and{' '}
            <ThesisRef label="thm:almost-all" /> and <ThesisRef label="thm:d7-classification" />.
          </p>
        </div>
      </Section>
      <Section id="about-guides" title="Guides">
        <p className="prose">
          A short tour of the site opens on the first visit. It can be taken again here or from the question mark at the top of every page, which also holds the guides to
          the Playground and to Analyze a tree.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['site', 'playground', 'analyze'] as TourId[]).map((id) => (
            <Button key={id} variant="outline" onClick={() => start(id)}>
              {TOURS[id].title}
            </Button>
          ))}
        </div>
      </Section>
      <Section id="about-ai" title="AI use declaration">
        <p id="ai" className="prose">
          This site was built with the help of artificial intelligence. The author used Claude, by Anthropic, as a programming and writing assistant, and reviewed and
          approved the site and its texts.
        </p>
      </Section>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl">Page not found</h1>
      <p className="prose">There is nothing at this address.</p>
    </div>
  )
}
