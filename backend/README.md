# IEP-G backend (FastAPI)

Exact engine and API for the application *seeds, bricks and the minimum number of distinct eigenvalues of a tree*.
Contract: `../API_CONTRACT.md` and `../API_CONTRACT_v2.md`. Everything is exact (`fractions.Fraction`, `sympy` for
algebraic eigenvalues). No numerical heuristics anywhere. Every certificate served by the catalog is re-verified with
the engine when the catalog is built.

## Run

The backend reads the thesis from a compiled copy in `../build/thesis`, made by `../scripts/bundle_thesis.py` from the
LaTeX sources of the thesis, which are not in this repository (see `../README.md`). Without it the server does not
start and the tests do not run.

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python ../scripts/bundle_thesis.py --source DIR    # DIR is the folder with main.tex; needs tectonic
.venv/bin/python -m uvicorn iepg.main:app --reload --port 8000
```

Docs: http://localhost:8000/docs (turned off in production).

`requirements.txt` keeps the ranges used in development; `requirements.lock` pins the exact versions installed in the
container. Settings come from environment variables, described in `iepg/config.py` (`IEPG_ENV`, `IEPG_THESIS_DIR`,
`IEPG_DIST_DIR`, `IEPG_CLIENT_IP_HEADER`, `IEPG_CORS_ORIGINS`, `IEPG_RATE_LIMITS`), `iepg/limits.py`
(`IEPG_TIME_LIMITS`) and `iepg/algorithms.py` (`IEPG_COMMIT`).

## Tests (adherence to the thesis)

```bash
.venv/bin/python -m pytest -q tests
```

`test_adherence.py` reproduces numbers and examples of the thesis, `test_constructions.py` the constructions of the
bricks, the Playground and the other classes of graphs, `test_algorithms.py` the page Algorithms and the seeds beyond
the catalog, `test_thesis_text.py` the statements, glossary and macros read from the LaTeX source, and
`test_security.py` the guard, the static route and the input limits.

## Layout

| File | Content |
|---|---|
| `iepg/main.py` | the API: the endpoints, the input limits, the checks at start-up (catalog, thesis text, Playground seeds), and the built frontend served at `/` when it exists |
| `iepg/config.py` | settings read from the environment: where the thesis copy and the built frontend are, production mode, proxy header, CORS, rate limits; the date of the thesis that is read |
| `iepg/security.py` | the ASGI guard in front of the application: request bodies up to 64 kB (413), rate limits per visitor (429), at most three computations at once (503), security and cache headers, one log line per request without the visitor's address |
| `iepg/limits.py` | the hard time limit: each computation runs in a forked child process killed after 10 s (422 `TOO_SLOW`); on by default in production on Linux |
| `iepg/trees.py` | tree parsing (edge list, adjacency, parent array, Prüfer, parentheses, graph6), canonical forms, diameter, centers, kinds, seeds, rooted seeds, the seeds $S_d$, $S'$, $S''$, $S^{(3)}$, $S^{(4)}$, $S^{(5)}$, gallery (paths, stars, generalized stars, caterpillars, Barioli–Fallat, whirls, $S_d$), the drawing convention of the thesis |
| `iepg/diag.py` | `Diagonalize` with temporary and final values and the full trace, characteristic polynomials of rooted subtrees (Schur recursion), $\mathcal Z(M)$, latent and confined latent values, brick test, latent-value bound |
| `iepg/fold.py` | `FoldToSeed` with the recorded branches, regular $s$-ABD, transport of a realization from the seed to an unfolding |
| `iepg/realize.py` | the constructions of the thesis in exact arithmetic: φ, BaseStrongRealization, StrongRealization, the explicit admissible family $\Lambda^{(j)}$, the admissibility test, the conditions (C1)–(C6), RootedSeedRealization, TowerChain, the bricks of $S_d$ and of the tower seeds, and `verify`, the exact check of every brick |
| `iepg/realize_tree.py` | Algorithm `RealizeTree`, line by line: for a tree in the family of $S_d$, a matrix with $d + 1$ distinct eigenvalues |
| `iepg/recognize.py` | the seeds of the thesis beyond the catalog ($S_d$, the tower seeds $S^{(i,j)}_d$ and $S^{[b]}_d$, the seeds $S'$, $S''$, $S^{(3)}$, $S^{(4)}$, $S^{(5)}$), recognized by rebuilding the seeds of the diameter, with the brick when the site computes it |
| `iepg/playground.py` | the Playground: the seeds the thesis realizes in each diameter 1–15, the duplications chosen by clicks, and the matrix of the construction of the thesis carried to the unfolding by regular 1-ABDs |
| `iepg/graphs.py` | unicyclic graphs (cycles, tadpoles, sunlets, published bounds), threshold graphs (Algorithm 1 of the LAA paper), cographs (construction of Theorem 4 of the arXiv paper); matrices in Q(√2, √3, …) verified exactly |
| `iepg/catalog.py` | seeds of diameter ≤ 7 in the numbering of the thesis, rooted seeds $R_1,\ldots,R_{12}$, the 78 seeds of diameter 7 with the 21 bricks and the 57 propagation certificates, the non-diminimal unfoldings of $S_6^{(7)},S_6^{(8)},S_6^{(9)}$ and the tree of Barioli and Fallat, the matrices $M_S$ of the bound $C(6) = 8$, $S_d$ for $8 \le d \le 15$ with bricks by `RealizeTree`, counts, gallery, open questions, the notation table |
| `iepg/labels.py` | theorem numbers read from the `.aux` files of the thesis, and the chapters included in `main.tex` |
| `iepg/thesis_text.py` | statements, glossary and macros read from the LaTeX source of the included chapters, so that the tooltips quote the thesis with its current numbers |
| `iepg/bib.py` | reader and formatter (thesis style) for `bib/thesis.bib`, and the short labels of the citation chips |
| `iepg/algorithms.py` | the page Algorithms: the pseudocode of each named algorithm, read from its tabbing block in the thesis, next to the Python functions that run it, read with `inspect` and linked to GitHub at the commit `IEPG_COMMIT`; also four computations of the site that are not named algorithms |
| `data/bricks_d7_raw.json` | the 21 bricks of the diminimal seeds of diameter 7 (exact), exported from a notebook of the author, re-verified at start-up |
| `data/unfoldings_d6_raw.json` | trees parsed from the thesis figures |

## Where the certificates come from

- Diameter at most 5: every tree is diminimal (Johnson and Saiago). The site does not compute the bricks of these seeds.
- Diameter 6, diminimal: bricks derived from the rooted seed realizations (restriction of a diameter-7 brick to $R_i$, then a regular 1-ABD when $S_6^{(i)}$ is $R_i$ with its deepest branch duplicated), verified exactly. The thesis credits the diminimality of these six seeds to Johnson and Saiago; the bricks are a corollary of the constructions of the thesis.
- Diameter 6, defective: the non-diminimal unfoldings of $S_6^{(7)}, S_6^{(8)}, S_6^{(9)}$ of the thesis (34, 32 and 33 vertices), the tree of Barioli and Fallat for $S_6^{(11)}$, and the examples of Johnson and Saiago for $S_6^{(10)}$ and $S_6^{(12)}$ (cited, not drawn). For $S_6^{(7)}, S_6^{(8)}, S_6^{(9)}$ the catalog also holds the matrix $M_S$ of the thesis (eight temporary zeros, 1 its only latent value, checked at start-up), which the analysis carries to every unfolding to show $q(T) \le 8$.
- Diameter 7, diminimal: bricks built by `RootedSeedRealization` on the two rooted seeds and composed along the main edge, exported from the notebook, re-verified here.
- Diameter 7, defective: propagation from the defective rooted seed of depth 3 (Corollary cor:odd-seed).
- Larger diameters: $S_d$ for $8 \le d \le 15$ is in the catalog, with its brick computed by `RealizeTree` at start-up and verified. Any other seed is passed to `recognize.py`: $S_d$ and the tower seeds come with a verified brick, the seeds $S'$, $S''$, $S^{(3)}$, $S^{(4)}$, $S^{(5)}$ with the theorem of the thesis and no brick. A seed is declared defective when the propagation recursion reaches a defective rooted seed of depth 3; otherwise the status is "unknown".
