import { useEffect, useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Tooltip } from '../ui/tooltip'

/** `tip`: one line on what the page holds, shown to the right of the menu item. */
type Item = { to: string; label: string; tip: string }
/** `collapsible`: the group opens and closes with a click; it starts closed unless the open page is inside it. */
type Group = { label: string; items: Item[]; collapsible?: boolean }

export const MENU: (Item | Group)[] = [
  {
    to: '/',
    label: 'Home',
    tip: 'The question of the thesis and its seeds, diameter by diameter.',
  },
  {
    to: '/analyze',
    label: 'Analyze a tree',
    tip: 'Draw a tree with clicks or type it in any format: its seed, the status of the seed, the bounds on q(T) and a realizing matrix. A cycle turns it into a unicyclic graph.',
  },
  {
    to: '/playground',
    label: 'Playground',
    tip: 'Pick a seed the thesis realizes, duplicate branches and generate a matrix with d + 1 distinct eigenvalues.',
  },
  {
    label: 'Trees',
    collapsible: true,
    items: [
      {
        to: '/trees/small',
        label: 'Diameter ≤ 5',
        tip: 'The seeds of diameter at most 5, all diminimal (Johnson and Saiago).',
      },
      {
        to: '/trees/d6',
        label: 'Diameter 6',
        tip: 'The twelve seeds of diameter 6, six diminimal and six defective, with their certificates, and the twelve rooted seeds of depth 3.',
      },
      {
        to: '/trees/d7',
        label: 'Diameter 7',
        tip: 'The 78 seeds R_i ⊙ R_j of diameter 7 and the 21 diminimal ones.',
      },
      {
        to: '/trees/large',
        label: 'Larger diameters',
        tip: 'The seeds S_d of diameters 8 to 11 and the counts ρ_k, s_d and p_d.',
      },
      {
        to: '/seeds/sd',
        label: 'The seeds S_d',
        tip: 'The recursion of S_d, bricks for almost every spectrum and a random search for a non-admissible set.',
      },
    ],
  },
  {
    label: 'Other classes',
    collapsible: true,
    items: [
      {
        to: '/classes/threshold',
        label: 'Threshold graphs',
        tip: 'Threshold graphs: a matrix with DSpec(M) ⊆ {−λ, 0, λ, 2λ} and the bounds on q(G).',
      },
      {
        to: '/classes/cographs',
        label: 'Cographs',
        tip: 'Cographs built by unions and joins, the twin construction and the bounds on q(G).',
      },
      {
        to: '/classes/unicyclic',
        label: 'Unicyclic graphs',
        tip: 'Cycles, tadpoles and sunlets, with the published bounds on q(G).',
      },
    ],
  },
  {
    label: 'Lab',
    collapsible: true,
    items: [
      {
        to: '/lab/diagonalize',
        label: 'Diagonalize',
        tip: 'Run Diagonalize(M, −λ) step by step on a tree and a matrix of your choice.',
      },
      {
        to: '/lab/latent',
        label: 'Latent values and bricks',
        tip: 'The set of temporary zeros, the latent and confined values of a matrix, and whether it is a brick.',
      },
      {
        to: '/lab/admissibility',
        label: 'Admissibility',
        tip: 'The recursion tree of the admissibility test of a set, and the explicit family of admissible sets.',
      },
      {
        to: '/lab/build-sd',
        label: 'Build S_d',
        tip: 'StrongRealization level by level: a brick of S_d with a prescribed set of eigenvalues.',
      },
      {
        to: '/lab/towers',
        label: 'Towers',
        tip: 'Two towers built by TowerChain level by level, and the composed seed with its brick.',
      },
    ],
  },
  {
    to: '/algorithms',
    label: 'Algorithms',
    tip: 'Diagonalize, φ, StrongRealization, RootedSeedRealization, TowerChain, FoldToSeed and RealizeTree: the pseudocode of the thesis next to the Python code that runs on this site.',
  },
  {
    to: '/questions',
    label: 'Open questions',
    tip: 'The questions of the last chapter of the thesis.',
  },
  {
    to: '/history',
    label: 'History',
    tip: 'How the question evolved, from the lower bound of 2002 to bricks, towers and almost all seeds being defective, one discovery at a time.',
  },
  {
    to: '/about',
    label: 'About',
    tip: 'The thesis, the author and the AI use declaration.',
  },
]

function Item({ item, onNavigate, nested }: { item: Item; onNavigate?: () => void; nested?: boolean }) {
  return (
    <Tooltip content={item.tip} placement="right" box className="block">
      <NavLink
        to={item.to}
        end={item.to === '/'}
        data-tour={`nav:${item.to}`}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'block rounded-md px-2.5 py-1.5 font-sans text-sm no-underline transition-colors',
            nested && 'ml-3',
            isActive ? 'bg-surface font-medium text-ink border border-line' : 'text-muted hover:bg-surface hover:text-ink border border-transparent',
          )
        }
      >
        {item.label}
      </NavLink>
    </Tooltip>
  )
}

function GroupView({ group, onNavigate }: { group: Group; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const inside = group.items.some((it) => pathname === it.to || pathname.startsWith(it.to + '/'))
  const [open, setOpen] = useState(inside)
  const id = useId()
  // arriving at a page of the group (from a link, the search or the tour) opens it
  useEffect(() => {
    if (inside) setOpen(true)
  }, [inside])
  if (!group.collapsible) {
    return (
      <div className="pt-1">
        <div className="px-2.5 py-1 font-sans text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</div>
        {group.items.map((it) => (
          <Item key={it.to} item={it} onNavigate={onNavigate} nested />
        ))}
      </div>
    )
  }
  return (
    <div className="pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-left font-sans text-xs font-semibold uppercase tracking-wide text-muted hover:bg-surface hover:text-ink"
      >
        <span aria-hidden className={cn('inline-block w-3 text-center text-sm leading-none transition-transform', open ? 'rotate-90' : '')}>
          ▸
        </span>
        {group.label}
      </button>
      {open && (
        <div id={id}>
          {group.items.map((it) => (
            <Item key={it.to} item={it} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" data-tour="sidebar" className="space-y-0.5">
      {MENU.map((entry) =>
        'items' in entry ? (
          <GroupView key={entry.label} group={entry} onNavigate={onNavigate} />
        ) : (
          <Item key={entry.to} item={entry} onNavigate={onNavigate} />
        ),
      )}
    </nav>
  )
}
