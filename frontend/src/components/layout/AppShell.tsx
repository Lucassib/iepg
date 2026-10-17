import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { MENU, Sidebar } from './Sidebar'
import { Footer } from './Footer'
import { ReferencesPanel } from '../ReferencesPanel'
import { Sheet } from '../ui/dialog'
import { cn } from '../../lib/cn'
import { TourOverlay } from '../tour/TourOverlay'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false)
  const location = useLocation()
  // the history carries its references in the story card and needs the width for its two columns
  const refsColumn = !['/history', '/algorithms'].includes(location.pathname)
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])
  // the title of the browser tab names the page
  useEffect(() => {
    document.title = pageTitle(location.pathname)
  }, [location.pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-paper focus:px-3 focus:py-1.5 focus:font-sans focus:text-sm focus:shadow">
        Skip to content
      </a>
      <Header onMenu={() => setMenu(true)} />
      <div
        className={cn(
          'mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-5 lg:grid-cols-[210px_minmax(0,1fr)]',
          refsColumn && 'xl:grid-cols-[210px_minmax(0,1fr)_290px]',
        )}
      >
        <div className="hidden lg:block">
          <div className="sticky top-16">
            <Sidebar />
          </div>
        </div>
        <main id="main" className="min-w-0">
          {children}
        </main>
        {refsColumn && (
        <div className="border-t border-line pt-4 xl:border-t-0 xl:pt-0">
          <div data-tour="references" className="xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto xl:border-l xl:border-line xl:pl-4">
            <ReferencesPanel />
          </div>
        </div>
        )}
      </div>
      <Footer />
      <Sheet side="left" open={menu} onOpenChange={setMenu} title="IEP-G">
        <Sidebar onNavigate={() => setMenu(false)} />
      </Sheet>
      <TourOverlay />
    </div>
  )
}

/** "History · IEP-G" from the menu; the redirects and the drawn tree keep the name of the site. */
function pageTitle(path: string): string {
  if (path === '/') return 'IEP-G: seeds, bricks and the minimum number of distinct eigenvalues of a tree'
  const items = MENU.flatMap((e) => ('items' in e ? e.items : [e]))
  const hit = items.find((i) => i.to === path)
  if (hit) return `${hit.label} · IEP-G`
  if (path.startsWith('/tree/')) return 'Analyze a tree · IEP-G'
  return REDIRECTS.has(path) ? 'IEP-G' : 'Page not found · IEP-G'
}

const REDIRECTS = new Set(['/draw', '/trees', '/classes', '/lab', '/rooted-seeds', '/notation'])

