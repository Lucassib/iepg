# IEP-G: seeds, bricks and the minimum number of distinct eigenvalues of a tree

Companion web application to the PhD thesis *On the minimum number of distinct eigenvalues of a tree* of Lucas Siviero
Sibemberg (UFRGS, 2026), live at https://iepg.mat.br.
Backend in FastAPI with an exact engine, frontend in React. The interface is entirely in English. Only what is proved
in the thesis or in the cited literature is shown, and there are no numerical heuristics.

## How to cite

As in the bibliography of the thesis:

- Allem, L. E., Hoppen, C., and Sibemberg, L. S. IEP-G: a web application on seeds, bricks and the minimum number of distinct
  eigenvalues of trees. https://iepg.mat.br, 2026.
- Allem, L. E., Hoppen, C., and Sibemberg, L. S. IEP-G: source code. https://github.com/Lucassib/iepg, 2026. GitHub repository.

Search engines are asked not to index the site for now (`robots.txt` and the header `X-Robots-Tag`).

License: MIT for the code (`LICENSE`), CC BY 4.0 for the data in `backend/data`.

## The compiled copy of the thesis

The thesis is not in this repository. The backend reads its statements, definitions, glossary, macros, bibliography,
open questions, theorem numbers, the pseudocode of its algorithms and the seeds of diameter 6 in its numbering at run
time, from a compiled copy in `build/thesis`, which is not versioned either.
`scripts/bundle_thesis.py` makes that copy from the LaTeX sources of the thesis: it compiles a copy of the sources with
tectonic (the source folder is only read), copies into `build/thesis` the files the backend opens, and checks that the
backend answers the same from the copy as from the sources. Without `build/thesis` the backend does not start, and the
backend tests do not run. Run the script again after the thesis changes; the start-up log warns when it is due.

```bash
backend/.venv/bin/python scripts/bundle_thesis.py --source DIR   # DIR is the folder with main.tex; needs tectonic
```

Without `--source`, the script looks for the thesis where the author's working copy keeps it.

## Run in development

Commands from the root of the repository. Backend (port 8000):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python ../scripts/bundle_thesis.py --source DIR
.venv/bin/python -m uvicorn iepg.main:app --reload --port 8000
```

Frontend (port 5173, proxies `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

`run_dev.sh` starts both servers, after making the bundle with the default source, so it runs only in the author's
working copy.

## Run as a single server

```bash
cd frontend && npm run build
cd ../backend && .venv/bin/python -m uvicorn iepg.main:app --port 8000
```

The backend serves `frontend/dist` at `/` when it exists.

## Publish

See `DEPLOY.md`: Fly.io, one container. `scripts/release.sh` builds and checks everything locally without publishing,
and `scripts/smoke_test.py URL` checks a running site.

## Tests

```bash
(cd backend && .venv/bin/python -m pytest -q tests)
(cd frontend && npm run build)
```

## API

`API_CONTRACT.md` lists every endpoint and describes the first ones (trees, catalog, laboratory, thesis text,
algorithms); `API_CONTRACT_v2.md` describes the Playground, the constructions of the laboratory and the other classes
of graphs. With the backend in development, the interactive documentation is at http://localhost:8000/docs.

`api_samples/` is a snapshot of real responses of the API taken on 2026-09-27. The numbers of theorems, lemmas and
definitions in it are those of the thesis on that date; the API now returns the numbers of the current compilation.

## What the site does

- **Home**: the question of the thesis and its seeds, diameter by diameter. A diminimal seed opens in the Playground,
  a defective one opens its certificate.
- **Analyze a tree** (`/analyze`): the tree is drawn by clicks (a click on a vertex hangs a new leaf on it, the ×
  removes a vertex and what hangs from it, automatic layout, undo and redo, starting points) or typed in eight formats.
  The analysis follows every change: the seed by `FoldToSeed`, the sequence of duplications, the status of the seed
  with its certificate, bounds for $q(T)$ with their sources, and a matrix when the site can build one. For a tree in
  the family of $S_d$ the matrix comes from `RealizeTree`; otherwise the brick of the seed is carried to the tree by
  regular 1-ABDs. For an unfolding of $S_6^{(7)}$, $S_6^{(8)}$ or $S_6^{(9)}$ it is the matrix $M_S$ of the thesis
  carried in the same way, which gives $q(T) \le 8$; for the other trees of diameter 6 with a defective seed the
  analysis states the bound $C(6) = 8$ with its reference. Beyond the catalog, the analysis recognizes $S_d$, the tower
  seeds $S^{(i,j)}_d$ and $S^{[b]}_d$ and the seeds $S'_d$, $S''_d$, $S^{(3)}_d$, $S^{(4)}_d$, $S^{(5)}_d$ of the thesis;
  a seed is declared defective when the propagation recursion reaches a defective rooted seed of depth 3, and
  "unknown" otherwise. Close a cycle or Attach to a cycle turns the tree into a unicyclic graph. The address keeps the
  drawing (`?g=n.a-b_a-b…`), and `/tree/:canonical` or `/analyze?format=…&data=…` open a given tree. The former page
  Draw a graph was merged into this one on 2026-10-12, and `/draw` redirects here.
- **Playground**: choose d (1–15) and a seed the thesis can realize ($S_d$, the six diminimal seeds of diameter 6, the
  tower seeds $S^{(i,j)}$ and $S^{[b]}$), duplicate branches by clicking, and generate the matrix: StrongRealization,
  RootedSeedRealization and TowerChain exactly as in the thesis, carried to the unfolding by regular 1-ABDs, verified.
- **Trees**: all seeds of diameter at most 7 (1, 1, 2, 3, 12, 78 for d = 2, …, 7), the twelve rooted seeds of depth 3
  (on the page of diameter 6), $S_d$ up to 15. Bricks for the six diminimal seeds of diameter 6, the 21 of diameter 7
  and $S_d$ for 8 ≤ d ≤ 15, all re-verified exactly at start-up. Non-diminimal unfoldings of
  $S_6^{(7)}, S_6^{(8)}, S_6^{(9)}$ and the tree of Barioli and Fallat. The page on the seeds $S_d$: the recursion,
  the almost-every theorem and a random search for non-admissible sets.
- **Other classes**: threshold graphs (Algorithm 1 of the LAA paper), cographs (construction of Theorem 4 of the
  arXiv paper), unicyclic graphs (published bounds, cycles, tadpoles, sunlets; Edit the drawing opens the graph in
  Analyze a tree). Matrices computed exactly in Q(√2, √3, …) and verified by (M + λI)M(M − λI)(M − 2λI) = 0.
- **Lab**: `Diagonalize` step by step; latent values, $\mathcal Z(M)$ and the brick test for any matrix the user gives;
  admissibility; StrongRealization step by step (Build S_d); towers with the compact view by blocks.
- **Algorithms**: Diagonalize, φ, StrongRealization, RootedSeedRealization, TowerChain, FoldToSeed and RealizeTree, the
  pseudocode read from the LaTeX sources of the thesis next to the Python functions that run them, read from the
  running code and linked to GitHub; also four computations of the site that are not named algorithms of the thesis.
- **Open questions** of the last chapter of the thesis, as the thesis states them. **History**: how the question
  evolved since 2002, as a timeline that can be played, with what was known after each step. **About**: the thesis,
  how to cite the site, the papers, the guides, the AI use declaration.
- On every page: a search in the header (a diameter, a seed, a page or an edge list), tooltips that quote the
  definitions and statements of the thesis with its current numbers, a bibliography in the style of the thesis, a
  references panel driven by the open sections, light and dark themes. The notation page was removed (`/notation`
  redirects to the Home page); the list of notation of the thesis still feeds the tooltips of the symbols.

**Guided tours**: the tour of the site opens on the first visit (welcome, the history played in about thirty seconds,
the menu, a first tree on Analyze a tree, definitions on hover, search, the help menu). The question mark in the
header reopens it and holds the guides of the Playground and of Analyze a tree; About lists them too. Seen tours are
remembered in localStorage (`iepg-tour-site`, `iepg-tour-playground`, `iepg-tour-analyze`). Automated browser tests
should set `iepg-tour-site` first, or the welcome card covers the page. Definitions:
`frontend/src/components/tour/tours.tsx`.

## Not yet

The bricks of the seeds S', S'', S^(3), S^(4), S^(5) (the analysis recognizes these seeds and cites the thesis
without computing the brick, and the Playground does not offer them), the propagation lab, results of submitted
manuscripts on unicyclic graphs.
