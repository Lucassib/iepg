import type { ReactNode } from 'react'
import type { TourId } from '../../lib/tour'
import { Tex } from '../Tex'
import { Term } from '../ThesisTips'

export type TourPlacement = 'right' | 'left' | 'bottom' | 'top' | 'corner' | 'corner-left'

export type TourStep = {
  /** CSS selectors; the highlight is the smallest box around their visible matches. None: a card in the middle. */
  target?: string[]
  /** used when no target is visible, e.g. the menu button when the sidebar is folded on a phone */
  fallback?: string[]
  placement?: TourPlacement
  title: string
  body: ReactNode
  /** when the target is missing, open this address (an example) and wait for it */
  demo?: string
  /** shown under the body when the step opened its example */
  demoNote?: ReactNode
  /** skip the step when its target is missing */
  optional?: boolean
  /** the page the step happens on; the tour opens it when the step starts */
  route?: string
  /**
   * A hands-on step: the tour waits until `done` is true and then moves on by itself. `capture` is read when the step
   * starts and handed to `done`; `doIt` performs the action for whoever prefers to watch.
   */
  task?: { capture?: () => unknown; done: (captured: unknown) => boolean; doIt: (navigate: (to: string) => void) => void; doLabel: string }
}

export type Tour = {
  id: TourId
  title: string
  /** the page the tour belongs to; it is opened when the tour starts elsewhere, and leaving it ends the tour */
  route?: string
  steps: TourStep[]
}

// ---- the hands-on steps on Analyze a tree, shared by the tour of the site and the guide of the page ---------------

const canvas = () => document.querySelector<HTMLElement>('[data-tour="analyze-canvas"]')

/** Clicks the vertex that has a leaf hanging on it, so the new leaf copies that leaf and the seed stays the same. */
function hangSuggestedLeaf() {
  const v = canvas()?.dataset.suggest
  const el = v ? canvas()?.querySelector(`g[role="button"][aria-label^="vertex ${v}:"]`) : null
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const PICK_SEED: TourStep = {
  route: '/analyze',
  target: ['[aria-label="Start from"]'],
  placement: 'bottom',
  title: 'Try it: pick a seed of diameter 6',
  body: (
    <p>
      In <b>Start from</b>, choose one of the seeds of diameter 6, for instance S6(3). Every tree is obtained from a unique <Term k="seed">seed</Term> by
      duplicating branches without changing the diameter.
    </p>
  ),
  task: {
    done: () => (canvas()?.dataset.origin ?? '').startsWith('S6_'),
    doIt: (navigate) => navigate('/analyze?format=catalog&data=S6_3'),
    doLabel: 'Load S6(3) for me',
  },
}

const GROW: TourStep = {
  route: '/analyze',
  target: ['[data-tour="analyze-canvas"]'],
  placement: 'bottom',
  title: 'Grow a tree from it',
  body: (
    <p>
      Click a vertex that already has a leaf hanging on it. The new leaf copies that leaf, a branch duplication that keeps the diameter, so your tree is an{' '}
      <Term k="unfolding">unfolding</Term> of the seed. Elsewhere, the tree may get another seed, and the analysis finds it.
    </p>
  ),
  task: {
    capture: () => Number(canvas()?.dataset.n ?? 0),
    done: (n) => canvas()?.dataset.origin === 'draw' && Number(canvas()?.dataset.n ?? 0) > (n as number),
    doIt: () => hangSuggestedLeaf(),
    doLabel: 'Hang a leaf for me',
  },
}

const RESULT: TourStep = {
  route: '/analyze',
  target: ['[data-section="analyze-result"]'],
  placement: 'top',
  title: 'Read the result',
  body: (
    <p>
      The analysis traced your tree back to its seed, and the card The seed plays the unfolding. The status of the seed decides the bounds on{' '}
      <Tex tex="q(T)" />. A <Term k="diminimal seed">diminimal seed</Term> gives <Tex tex="q(T)=d(T)+1" /> for every tree it generates, with a matrix that
      attains it when the thesis gives one. A <Term k="defective seed">defective seed</Term> comes with its certificate.
    </p>
  ),
}

// ---- the history, played at the start of the tour of the site ----------------------------------------------------

const timeline = () => document.querySelector<HTMLElement>('[data-tour="history-timeline"]')

const HISTORY_PLAY: TourStep = {
  route: '/history?step=1&tour=1',
  target: ['[data-tour="history-timeline"]', '[data-section="history-known"]'],
  placement: 'corner-left',
  title: '24 years in 30 seconds',
  body: (
    <p>
      The question has a history. Press <b>Play it for me</b> and watch it unfold: the timeline moves one discovery at a time, the card tells each one, and the panel
      What was known shows the state of knowledge after it, up to our works of 2026.
    </p>
  ),
  task: {
    done: () => {
      const el = timeline()
      return !!el && el.dataset.historyStep === el.dataset.historyTotal
    },
    doIt: () => {
      const play = document.querySelector<HTMLElement>('[data-tour="history-play"]')
      if (play && play.getAttribute('aria-pressed') !== 'true') play.click()
    },
    doLabel: 'Play it for me',
  },
}

const HISTORY_CHANGED: TourStep = {
  route: '/history',
  target: ['[data-section="history-known"]'],
  placement: 'corner-left',
  title: 'What changed',
  body: (
    <p>
      In diameter 7, the 21 seeds built from the six good rooted seeds are diminimal, and a defective rooted seed is enough to make the other 57 defective.
      Both the number <Tex tex="s_d" /> of seeds and the number <Tex tex="r_d" /> of diminimal seeds go to infinity, yet the bars show the proportion{' '}
      <Tex tex="p_d=r_d/s_d" /> falling to zero. History stays in the menu, to read at your own pace.
    </p>
  ),
}

const SITE: Tour = {
  id: 'site',
  title: 'Tour of the site',
  steps: [
    {
      title: 'Welcome',
      body: (
        <p>
          This site accompanies the PhD thesis of Lucas Siviero Sibemberg (UFRGS, 2026) on seeds, bricks and the minimum number of distinct eigenvalues of a tree.
        </p>
      ),
    },
    HISTORY_PLAY,
    HISTORY_CHANGED,
    {
      target: ['[data-tour="sidebar"]'],
      fallback: ['[data-tour="menu-button"]'],
      placement: 'right',
      title: 'The menu',
      body: (
        <p>
          Analyze a tree and the Playground are the two places to start. Under Trees the seeds are grouped by diameter, and Other classes and the Lab hold three
          other classes of graphs and the algorithms of the proofs. The groups open with a click.
        </p>
      ),
    },
    PICK_SEED,
    GROW,
    RESULT,
    {
      target: ['main .cursor-help'],
      placement: 'bottom',
      optional: true,
      title: 'Definitions on hover',
      body: (
        <p>
          A dotted underline marks a term defined in the thesis. Hover over it, or tap it on a touch screen, to read the definition. The numbered chips of theorems and
          lemmas show the full statement in the same way.
        </p>
      ),
    },
    {
      target: ['[data-tour="search"] input'],
      placement: 'bottom',
      title: 'Search',
      body: (
        <p>
          Type a diameter, a seed or a page, such as 6, S6 3, R2 R5 or towers. Suggestions appear as you type, and a seed opens drawn and analyzed.
        </p>
      ),
    },
    {
      target: ['[data-tour="help"]'],
      placement: 'bottom',
      title: 'This guide',
      body: <p>The question mark opens this tour again. On the Playground and on Analyze a tree, it also offers a short guide to the page.</p>,
    },
  ],
}

/** The example the Playground tour opens when no seed is selected. */
const PG_DEMO = '/playground?d=7&seed=T_2_5'
const PG_NOTE = (
  <>
    The tour opened an example: the <Term k="tower">tower</Term> seed <Tex tex="S^{(2,5)}_{7}" />.
  </>
)

const PLAYGROUND: Tour = {
  id: 'playground',
  title: 'Tour of the Playground',
  route: '/playground',
  steps: [
    {
      target: ['[data-section="pg-step1"]'],
      placement: 'bottom',
      title: '1. Diameter',
      body: (
        <p>
          Choose the diameter <Tex tex="d" /> of the seed. The next step lists the seeds of that diameter whose realization the thesis constructs.
        </p>
      ),
    },
    {
      target: ['[data-section="pg-step2"]'],
      demo: PG_DEMO,
      demoNote: PG_NOTE,
      placement: 'bottom',
      title: '2. Seed',
      body: <p>The seeds are grouped by the construction that realizes them. A click on a card selects the seed.</p>,
    },
    {
      target: ['[data-section="pg-step3-section"]'],
      demo: PG_DEMO,
      demoNote: PG_NOTE,
      placement: 'bottom',
      title: '3. Duplicate branches',
      body: (
        <p>
          A click on a vertex duplicates the branch it roots at its parent. Only the branches whose duplication keeps the diameter can be chosen, so the tree stays in the{' '}
          <Term k="unfolding">unfolding</Term> of the seed. The new edges are dashed and the <Term k="main roots">main roots</Term> are red.
        </p>
      ),
    },
    {
      target: ['[data-section="pg-step4"]'],
      demo: PG_DEMO,
      demoNote: PG_NOTE,
      placement: 'top',
      title: '4. Generate the matrix',
      body: (
        <p>
          The backend runs the construction of the proof on the seed and carries it to the tree by <Term k="regular ABD">regular ABDs</Term>. The result shows the
          matrix, its distinct eigenvalues checked in exact arithmetic and the statements of the thesis that were used.
        </p>
      ),
    },
  ],
}

const ANALYZE: Tour = {
  id: 'analyze',
  title: 'Tour of Analyze a tree',
  route: '/analyze',
  steps: [
    {
      target: ['[data-tour="analyze-tabs"]'],
      placement: 'bottom',
      title: 'Draw or type',
      body: <p>Draw the tree with clicks, or type it in any of the usual formats. Switching tabs keeps the tree.</p>,
    },
    PICK_SEED,
    GROW,
    {
      target: ['[data-tour="analyze-tools"]'],
      placement: 'bottom',
      title: 'Undo, cycles and starting points',
      body: (
        <p>
          The × beside a vertex removes it and everything that hangs from it, and Undo brings it back. Close a cycle joins two vertices and turns the tree into a
          unicyclic graph, and Attach to a cycle coalesces the tree with a cycle.
        </p>
      ),
    },
    RESULT,
  ],
}

export const TOURS: Record<TourId, Tour> = { site: SITE, playground: PLAYGROUND, analyze: ANALYZE }
