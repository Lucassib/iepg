# IEP-G frontend

React 18 + TypeScript + Vite + Tailwind v4 frontend of the Inverse Eigenvalue Problem for Graphs application (seeds, bricks and the minimum number of distinct eigenvalues of a tree). The interface is in English only.

## Run

```sh
npm install
npm run dev        # http://localhost:5173, proxies /api to http://localhost:8000
npm run build      # type-check (tsc -b) and bundle into dist/
npm run preview    # serve dist/
npm run lint       # oxlint
```

The backend (FastAPI) must run on port 8000 and follow `../API_CONTRACT.md` and `../API_CONTRACT_v2.md`. Real responses are in `../api_samples/`, a snapshot taken on 2026-09-27 whose theorem numbers are those of the thesis on that date. Without the backend the interface still renders; a failed request shows a "Server unavailable" note instead of crashing.

## Structure

```
index.html                  meta tags and /theme-init.js (in public/: applies the stored theme before the first paint, no flash)
public/                     favicon.svg, robots.txt, theme-init.js
vite.config.ts              react + tailwind plugins, /api proxy
src/index.css               design tokens on :root and [data-theme="dark"], Tailwind @theme mapping, base styles
src/main.tsx                React Query + Router providers, KaTeX macros, the fonts (Source Serif 4, Inter and JetBrains Mono
                            from fontsource, bundled and served by the site itself, with system fallbacks in index.css)
src/App.tsx                 routes, redirects of old addresses, an error boundary around the pages
src/api/types.ts            types of API_CONTRACT.md and API_CONTRACT_v2.md (v2 checked field by field against api_samples/)
src/api/client.ts           fetch wrapper (ApiError, base /api/v1)
src/api/hooks.ts            React Query hooks per endpoint
src/lib/exact.ts            exact rationals and square roots for display (simplifies sqrt(p/q))
src/lib/tree.ts             edge keys, default matrix, fallback layout, kind labels
src/lib/theme.ts            theme store (light / dark / system), persisted in localStorage
src/lib/tour.ts             state of the guided tours; the tours seen are kept in localStorage
src/lib/citations.ts        bib keys used by the static prose (must exist in the backend bibliography)
src/lib/graph.ts            union-find, components, the unique cycle, circle layouts, edge lists
src/lib/growGraph.ts        the drawing of Analyze a tree: a tree or a unicyclic graph on 0..n-1 that grows by hanging leaves,
                            closing and attaching cycles, the address encoding (?g=, ?c=)
src/lib/playground.ts       ops in the URL ("y-u" pairs joined by "_"), branch vertices, the Playground seed of a diminimal catalog seed
src/lib/admissible.ts       Definition def:admissible in BigInt (port of the backend) and the random samplers
src/lib/cograph.ts          cograph expressions: text, size, graph (leaves numbered as the backend numbers them)
src/lib/search.ts           suggestions of the header search (a diameter, a seed, a page, an edge list)
src/lib/algorithms.ts       the algorithms of the thesis as search entries that open their section of the page Algorithms
src/lib/history.tsx         the chronology of the page History and what was known after each step
src/lib/seedLabel.ts        TeX label of a catalog seed name (S6_3, R2xR5, S_9, R3)
src/lib/symbols.ts          the symbols of SymbolTip and where their meaning comes from (glossary, notation table, quoted sentence)
src/lib/glossText.ts        first occurrence of glossary terms in backend prose (Questions page)
src/lib/katexMacros.tsx     GET /macros once, handed to every Tex (\DSpec, \tL, \lmin{j}, …)
src/lib/colors.ts           copy colors from the --copy-a / --copy-b tokens
src/lib/cn.ts               class name helper
src/lib/useDebounced.ts     debounced value hook
src/store/references.ts     Zustand store of the open sections and their bib keys
src/components/ui/          hand-written shadcn-style primitives: button, tabs, card, badge, accordion, dialog/sheet, input, popover, tooltip, segmented
src/components/ThesisTips   Term (glossary), GlossaryTip, StatementTip / StatementRef / RefText (numbered statements), SymbolTip
src/components/CellTip      delegated tooltips of matrix cells (one tooltip element per table)
src/components/             Tex, TreeView, TreeInput, MatrixEditor, MatrixView, SpectrumBar, CertificatePanel,
                            DiagonalizePlayer, LatentPanel, UnfoldingPlayer, LabWorkbench, SeedGrid, SeedDetail,
                            SeedSheet, CatalogSeeds, RootedSeedGrid, Section, CiteChip, ReferencesPanel, ThemeToggle, ErrorNote,
                            GraphView (general graphs), ExactMatrixTable, BrickSummary, BoundsPanel, UnicyclicResult,
                            ClassResult, CotreeView, AdmissibleTree, SetLine, PhiStepView, StrongTrace, TowerView,
                            PlaygroundSeedList, ProportionBars, ThesisBadges, ThesisRef (numbers from GET /labels)
src/components/analyze/     GrowEditor (the drawing, Start from, the cycle tools), TreeResult (the analysis of a tree)
src/components/tour/        tours (the steps of each tour), TourOverlay (veil and card), HelpMenu (the question mark of the header)
src/components/layout/      AppShell, Header, Sidebar (the menu), SearchBox, Footer
src/pages/                  Home, Analyze (also /tree/:canonical), Trees (small, d6, d7, large), Lab (Diagonalize, latent values),
                            Questions, About (also the page not found), and (lazy-loaded) Playground, SeedsSd, Threshold,
                            Cographs, Unicyclic, Admissibility, BuildSd, Towers, History, Algorithms
```

## Pages

| Route | Page | Endpoints |
| --- | --- | --- |
| `/` | Home: the question of the thesis and its seeds, diameter by diameter, with the rooted seeds of depth 3. A diminimal seed opens in the Playground, a defective one opens its certificate. | `GET /catalog/seeds`, `/catalog/seeds/{name}`, `/catalog/rooted-seeds`, `/playground/seeds` |
| `/analyze`, `/tree/:canonical` | Analyze a tree: the tree is drawn by clicks (a click on a vertex hangs a leaf on it, × removes a vertex and what hangs from it, undo and redo, Start from) or typed in eight formats; the analysis below follows every change. "Close a cycle" and "Attach to a cycle" turn it into a unicyclic graph. The address keeps the drawing (`?g=n.a-b_a-b…`, and `c` for the edge that closed the cycle); `/tree/:canonical` and `/analyze?format=…&data=…` (and `params` for the gallery) load a tree into the drawing. `/draw` redirects here. | `POST /trees/parse`, `/trees/analyze`, `/graphs/unicyclic`, `GET /catalog/gallery` |
| `/playground` | Playground: diameter 1–15, a seed the thesis realizes, branch duplication by clicking vertices, **Generate matrix**. The URL (`?d=&seed=&ops=0-1_0-12`) is a permalink. | `GET /playground/seeds`, `POST /playground/state`, `POST /playground/generate` |
| `/trees/small`, `/trees/d6`, `/trees/d7`, `/trees/large` | The catalog: seeds of diameter at most 5, the twelve seeds of diameter 6 with the twelve rooted seeds of depth 3 (`/rooted-seeds` redirects there), the 78 seeds of diameter 7, the seeds $S_d$ of larger diameters and the counts. | `GET /catalog/seeds`, `/catalog/seeds/{name}`, `/catalog/rooted-seeds`, `/catalog/counts` |
| `/seeds/sd` | The seeds $S_d$: the recursion and a gallery, the almost-every-spectrum theorem, a random search for a non-admissible set (BigInt, in the browser, checked by the server on Stop), a brick of $S_d$. Theorem numbers from `GET /labels`. | `POST /trees/parse`, `/admissible`, `/lab/strong-realization`, `GET /labels` |
| `/classes/threshold` | Threshold graphs: binary sequence builder, bags, the matrix of Algorithm 1, the verified spectrum, bounds. | `POST /graphs/threshold` |
| `/classes/cographs` | Cographs: pieces combined by union and join, cotree, twin sequence, matrix, bounds. | `POST /graphs/cograph` |
| `/classes/unicyclic` | Unicyclic graphs: cycle, tadpole and sunlet builders, published results, "Edit the drawing" (opens the graph in Analyze a tree). | `POST /graphs/unicyclic`, `/graphs/couple` |
| `/lab/diagonalize`, `/lab/latent` | `Diagonalize(M, −λ)` step by step; the temporary zeros, latent and confined values of a matrix and the brick test (`?catalog=` or `?canonical=` opens a tree). | `POST /trees/parse`, `/diagonalize`, `/latent` |
| `/lab/admissibility` | The recursion tree of the admissibility test (`?set=`), the explicit family, the two examples of the thesis figure. | `POST /admissible`, `/lab/family` |
| `/lab/build-sd` | `StrongRealization` level by level along the interior chain, lateral and interior children on demand (`?set=` or `?k=&alpha=&beta=&even=1`). | `POST /lab/strong-realization` |
| `/lab/towers` | Two `TowerChain` towers with a level slider, compact view (copies, seams) and tree view, the composed seed. | `POST /lab/tower` |
| `/algorithms` | The algorithms of the thesis (Diagonalize, φ, StrongRealization, RootedSeedRealization, TowerChain, FoldToSeed, RealizeTree), the pseudocode of the thesis next to the Python functions that run it, with links to GitHub; a second tab with the computations of the site that are not named algorithms. | `GET /algorithms`, `/meta` |
| `/questions` | The open questions of the last chapter of the thesis. | `GET /questions` |
| `/history` | How the question evolved, as a timeline that can be played (`?step=`), with what was known after each step and the proportion of diminimal seeds by diameter. | `GET /catalog/seeds`, `/bibliography` |
| `/about` | The thesis, how to cite the site, the papers, the guides, the AI use declaration. | `GET /bibliography` |

`/trees`, `/classes` and `/lab` redirect to their first page, and `/notation` (a page that was removed) to the Home page. On every page the tooltips, citation chips and the footer call `GET /glossary`, `/statements-by-ref`, `/labels`, `/macros`, `/notation`, `/bibliography` and `/meta`, and the header search calls `GET /catalog/seeds`.

## Conventions

- Colors only through the tokens in `src/index.css` (`bg-paper`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `text-diminimal` / `text-defective` / `text-unknown`). The red `--root-red` is used only for the root vertex of trees. The copies of a composition (lateral / interior copy, the copies of a tower level, the bags of a threshold graph, the cycle of a unicyclic graph) use the two neutral accents `--copy-a` and `--copy-b` (and mixtures of them, `src/lib/colors.ts`), defined in both themes.
- Tree SVGs use `currentColor` for edges and `var(--vertex-fill)` for vertices, so one drawing serves both themes. Layout coordinates come from the API (`TreeInfo.layout`, unit edge length, y downward). The scale is fixed, never fit-to-container: `SCALE_GRID` (26 px per unit) in grids and `SCALE_CARD` (40 px) in the analyze cards and the lab, with vertex radius 4 px (root 5 px) and stroke 1.2 px, so every figure keeps the same proportions; a wide tree scrolls horizontally inside its card.
- Citation chips (`CiteChip`) show the entry's `short` label from `GET /bibliography` (the key only while loading) and open the formatted entry in a popover. The static prose cites only keys listed in `src/lib/citations.ts`.
- The analyze page keeps its drawing in the URL: `/analyze?g=…` is the permalink of a drawn tree or unicyclic graph. A tree given as `/analyze?format=…&data=…` or `/tree/:canonical` is read by `POST /trees/parse`, becomes the drawing, and the address is then rewritten to `?g=…`.
- Exact numbers: `Num.display` (when the backend sends it) is the text shown for eigenvalues and latent values; `exact` (a sympy expression) stays in the tooltip.
- Every page section is a `Section` (accordion) that declares `citeKeys`; open sections feed the "References on this page" panel. Every literature statement carries a `CiteChip`.
- Math is rendered by KaTeX through `Tex` (pure TeX) and `MathText` (prose with `$...$`).
- Thesis labels: on the new pages, statements of the thesis are referred to through `ThesisRef` (numbers of the current compilation from `GET /labels`), and raw labels inside backend sentences ("Lemma lem:six-arms") are resolved by `LabelledText`.
- Tooltips (`ui/tooltip.tsx`): one open at a time, hover after 250 ms, keyboard focus, Esc, tap on touch (controls keep their tap), rendered in a portal so no scroll container clips them. `Tooltip` wraps one trigger; `FloatingTip` is the imperative variant used with event delegation (`TreeView` vertices and edges, matrix cells). Definitions and results are always quoted from the thesis: `Term k="brick"` shows the glossary text (`GET /glossary`) with its reference, `ThesisChip` / `StatementRef` show the numbered statement (`GET /statements-by-ref`, batched: all lookups of a render go into one request, cached per reference), `SymbolTip` shows the meaning of a symbol from the glossary or the notation table. A missing key or reference renders plainly. Inside a button (accordion headings, cards) use `focusable={false}`. Numbers of thesis results in control tooltips come from `GET /labels` (`ThesisRef plain`), never hard-coded.
- Errors (`src/api/client.ts`): an answer `{"detail": {"code", "detail"}}` shows its `detail` text, FastAPI validation arrays are joined into one line, and a network failure or a 5xx answer shows "Server unavailable".
