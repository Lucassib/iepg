import { Link } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { Button } from '../ui/button'
import { SearchBox } from './SearchBox'
import { HelpMenu } from '../tour/HelpMenu'

export function Header({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2 sm:gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open the menu" data-tour="menu-button" onClick={onMenu}>
          ☰
        </Button>
        <Link to="/" className="flex shrink-0 items-baseline gap-2 whitespace-nowrap no-underline">
          <span className="font-serif text-xl font-semibold tracking-tight">IEP-G</span>
          <span className="hidden font-serif text-sm text-muted md:inline">seeds, bricks and the minimum number of distinct eigenvalues of a tree</span>
        </Link>
        <SearchBox />
        <HelpMenu />
        <span data-tour="theme" className="inline-flex shrink-0">
          <ThemeToggle />
        </span>
      </div>
    </header>
  )
}
