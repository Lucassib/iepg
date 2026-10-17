import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Section } from '../components/Section'
import { Button } from '../components/ui/button'
import { TOURS } from '../components/tour/tours'
import { useTour, type TourId } from '../lib/tour'

export function AboutPage() {
  const { hash } = useLocation()
  const start = useTour((s) => s.start)
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView({ block: 'start' })
  }, [hash])
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
