# API contract v1

Base path `/api/v1`. JSON only. All exact numbers are strings: rationals as `"p/q"` or `"n"`. The off-diagonal entries
of a matrix on a tree are given by their squares, so a certificate never holds a floating-point number; eigenvalues
come as exact expressions with a float for display. This file describes the first endpoints (trees, catalog,
laboratory, thesis text, algorithms) and lists all of them at the end; the Playground, the constructions of the
laboratory and the other classes of graphs are described in `API_CONTRACT_v2.md`. The backend also serves its OpenAPI
schema at `/api/v1/openapi.json`, and the interactive documentation at `/docs` outside production.

## Errors

The errors of the application have the form `{"detail": {"code": "...", "detail": "..."}}`, where the inner `detail`
is a sentence for the visitor:

- 400 `NO_FORMAT`, `BAD_FORMAT`, `BAD_CATALOG`: a `TreeInput` without format, with an unknown format, or with an
  unknown catalog name;
- 404 `NOT_FOUND`: an unknown seed in `/catalog/seeds/{name}`, or an unknown path under `/api` when the backend serves
  the built frontend;
- 413 `TOO_LARGE`: a request body over 64 kB;
- 422 for an input the computation refuses, for example `BAD_TREE`, `TOO_SMALL`, `TOO_LARGE`, `BAD_ROOT`,
  `BAD_MATRIX`, `UNSUPPORTED` (and the codes of `API_CONTRACT_v2.md`), and `TOO_SLOW` when a computation takes more
  than 10 s (the time limit is on by default in production on Linux);
- 429 `RATE_LIMITED` (with `Retry-After`), 503 `BUSY` (the server waited 20 s for one of its three computation
  slots), 500 `INTERNAL`.

Some answers come from FastAPI itself and keep its format: a body or a query parameter that fails validation gives 422
with a list, `{"detail": [{"type": ..., "loc": [...], "msg": ..., "input": ...}, ...]}`; a method the path does not
accept gives 405 `{"detail": "Method Not Allowed"}` (when the backend serves the built frontend, a `GET` on a `POST`
endpoint gives the 404 `NOT_FOUND` above instead); without the built frontend, an unknown path gives 404
`{"detail": "Not Found"}`.

Every endpoint that takes a `TreeInput` refuses a tree with fewer than 2 vertices given in a text format or as a
canonical string (422 `TOO_SMALL`) and a tree with more than 200 vertices (422 `TOO_LARGE`).

Successful `GET` answers under `/api` may be cached for 5 minutes; `POST` answers are not cached.

## Shared types

```ts
type Rational = string;                       // "3", "-1/2"
type Num = { exact: string; approx: number; display: string }; // eigenvalues: exact expression (the rational, or sympy srepr), float, text shown

type TreeInput =
  | { format: "edges" | "adjacency" | "parents" | "prufer" | "parentheses" | "graph6"; data: string }
  | { format: "catalog"; data: string }     // "S6_3", "R2xR5", "S_9" (1 ≤ d ≤ 15), or a rooted seed "R4"
  | { format: "gallery"; data: string; params?: Record<string, number> }   // data = gallery id
  | { canonical: string };

type Layout = Record<string, [number, number]>;   // vertex id -> (x, y); y grows downward; unit edge length

type TreeInfo = {
  canonical: string;          // permalink id: "v" (center vertex) or "e" (center edge) followed by rooted parenthesis strings
  n: number;
  diameter: number;           // in edges
  edges: [number, number][];  // vertex ids 0..n-1
  center: { type: "vertex" | "edge"; vertices: number[] };
  main_roots: number[];       // = center vertices
  linear: boolean;
  kind: "path" | "star" | "generalized_star" | "double_generalized_star" | "caterpillar" | "other";
  is_seed: boolean;
  layout: Layout;             // thesis convention: root(s) in the middle, deep branches down, shallow branches up
  dashed_edges: [number, number][];  // edges to draw dashed (composition or duplicated copy), often empty
};

type Matrix = {
  diag: Record<string, Rational>;   // vertex id -> diagonal entry
  w2: Record<string, Rational>;     // "u-v" (u<v) -> square of the off-diagonal entry (positive)
};

type Certificate = {
  kind: "brick" | "non_diminimal_unfolding" | "propagation" | "literature" | "theorem" | "none";
  summary: string;                  // one paragraph, English, thesis wording
  references: string[];             // bib keys
  thesis: string[];                 // references with the numbers of the current compilation, like "Theorem 6.1", "Definition 4.18"
  brick?: { matrix: Matrix; root: number; other_main_root?: number; dspec: Num[]; latent: Num[]; confined: Num[]; prescribed?: Rational[] };
  unfolding?: { tree: TreeInfo; q_lower: number; reason: string };
  chain?: { steps: string[] };      // propagation chain in words
};
// "theorem": a seed recognized by the analysis whose diminimality the thesis proves, without a brick computed by the site.
// "none": a seed the thesis does not decide (status "unknown").

type Bound = { value: number; source: string; references: string[]; thesis: string[] };
```

## Endpoints

### `GET /meta`
`{ version: string, thesis_version: string, catalog_hash: string, catalog_log: string[] }`

`thesis_version` is the date of the last change of the `.tex` files of the thesis copy that is read, `catalog_hash`
identifies the catalog, and `catalog_log` holds the messages written while the catalog was built (the last one counts
the seeds; a line that starts with `WARNING` means a stored certificate failed its check).

### `GET /health`
`{ ok: true }`. Not in the OpenAPI schema; used by the health check of the container.

### `POST /trees/parse`  body: `TreeInput`
→ `TreeInfo`

### `POST /trees/fold`  body: `{ tree: TreeInput }`
→ `{ seed: TreeInfo, seed_name: string | null, steps: FoldStep[] }`
```ts
type FoldStep = { tree: TreeInfo; removed_branch: number[]; at_vertex: number; isomorphic_to: number[]; };
// steps[0].tree is the input tree, steps[k].tree is the tree after k removals; the last equals seed.
```

### `POST /trees/analyze`  body: `{ tree: TreeInput, matrix?: Matrix }`
→
```ts
{
  tree: TreeInfo;
  seed: TreeInfo;
  seed_name: string | null;          // "S6_3", "R2xR5", "S_9", or null when not in the catalog
  seed_label: string | null;         // TeX label of the catalog seed
  fold_steps: FoldStep[];
  seed_status: "diminimal" | "defective" | "unknown";
  seed_certificate: Certificate;
  q_lower: Bound;
  q_upper: Bound | null;             // equal to q_exact when q_exact is known
  q_exact: Bound | null;
  realization: { matrix: Matrix; root: number; dspec: Num[]; source: string; kind: "exact" | "upper" } | null;
  notes: string[];                   // e.g. the "defective is a property of the family" note, the bound of the user's matrix
  references: string[];              // union of bib keys used
}
```
The status of a seed outside the catalog comes from the propagation of defectivity, from the recognition of the seeds
of the thesis ($S_d$, the tower seeds, $S'$, $S''$, $S^{(3)}$, $S^{(4)}$, $S^{(5)}$), or is `"unknown"`. `realization`
is, for a diminimal seed, a matrix with $q(M) = d + 1$ (`RealizeTree` for the family of $S_d$, else the brick of the
seed carried to the tree by regular 1-ABDs); for an unfolding of $S_6^{(7)}$, $S_6^{(8)}$ or $S_6^{(9)}$, the matrix
$M_S$ of the thesis carried to the tree (`kind: "upper"`, unless it attains the lower bound); otherwise `null`. A
`matrix` in the body is read on the tree rooted at its first main root: its bound $|\mathcal Z(M)| - |\Delta_c(M)|$
goes to `notes` and its $q(M)$ can lower `q_upper`; an invalid matrix is ignored with a note.

### `GET /catalog/seeds?d=6`
→ `SeedSummary[]`: for 1 ≤ d ≤ 7 all the seeds of diameter d, for 8 ≤ d ≤ 15 the seed $S_d$, and `[]` for any other d.
```ts
type SeedSummary = { name: string; label: string; canonical: string; status: "diminimal"|"defective"|"unknown"; tree: TreeInfo;
                     pair: [string, string] | null; rooted_seed: string | null };
// name is the URL id ("S6_3", "R2xR5", "S_9"), label is the display TeX ("S_6^{(3)}", "R_{2} \\odot R_{5}");
// pair: the two rooted seeds of a seed of diameter 7; rooted_seed: the rooted seed R_i of S_6^(i)
```

### `GET /catalog/seeds/{name}`
→ `{ name, label, canonical, status, tree, diameter: number; certificate: Certificate; history: string; references: string[]; rooted_seed?: string; pair?: [string, string]; q8_matrix?: Q8 | null }`
```ts
type Q8 = { matrix: Matrix; root: number; Z: Num[]; latent: Num[]; thesis: string[] };
// only on S6_7, S6_8, S6_9: the matrix M_S of the thesis behind q(T) ≤ 8 for their unfoldings (null if its check failed)
```
404 `NOT_FOUND` for an unknown name.

### `GET /catalog/rooted-seeds?depth=3`
→ `{ name: "R1".."R12"; label: string; canonical: string; good: boolean; seed_name: string; tree: TreeInfo; root: number; deleted_branch: number[]; rooted_tree: TreeInfo; rooted_root: number }[]`
(`tree` is the seed $S_6^{(i)}$ drawn with its root `root`; `deleted_branch` are the vertices of the second copy of
its deepest branch, deleted to obtain $R_i$, empty when the rooted seed is the seed itself, so the frontend can gray
them; `rooted_tree` is $R_i$ alone, rooted at `rooted_root`.) Any other depth: 422 `UNSUPPORTED`.

### `GET /catalog/counts`
→ `{ E: Record<string, string>; s: Record<string, string>; bounds: { d: number | string; p?: string; p_upper?: string; p_limit?: string; source: string }[] }`

`E` is the number of rooted seeds of each depth, `s` the number of seeds of each diameter; in `bounds`, `p` is the
exact proportion of diminimal seeds, `p_upper` an upper bound, and `p_limit` the limit (with `d: "→ ∞"`).

### `GET /catalog/gallery`
→ `{ id: string; name: string; description: string; params: { name: string; min: number; max: number; default: number }[]; references: string[] }[]`

Ids: `path`, `star`, `generalized_star`, `double_generalized_star`, `caterpillar`, `barioli_fallat`, `whirl`, `S_d`.

### `POST /diagonalize`  body: `{ tree: TreeInput, root: number, matrix: Matrix, lam: Rational }`
→
```ts
{
  order: number[];                      // bottom-up order used
  steps: { k: number; vertex: number; line: 3|5|8; hat_d: Rational; final_d: Rational; consumed_child: number|null; cut_edge: [number, number]|null; d_after: Record<string, Rational> }[];
  final: Record<string, Rational>;      // d_v at the end
  temporary_zeros: number[];
  zeros: number; positives: number; negatives: number;   // multiplicity of lam, eigenvalues > lam, eigenvalues < lam
  in_Z: boolean;
}
```
422 `BAD_ROOT` when `root` is not a vertex of the tree, `BAD_MATRIX` for a missing or invalid entry.

### `POST /latent`  body: `{ tree: TreeInput, root: number, matrix: Matrix }`
→ `{ dspec: Num[]; Z: Num[]; latent: Num[]; confined: Num[]; is_brick: boolean; reason: string; bound: number; witnesses: Record<string, number[]>; q_M: number }`

`bound` is $|\mathcal Z(M)| - |\Delta_c(M)|$ and `witnesses` maps each latent value (its display text) to the vertices
where it is a temporary zero. Latent and confined values are defined for the tree rooted at a main root, so `root` must
be one of `main_roots`: otherwise 422 `BAD_ROOT` (also when `root` is not a vertex). At most 60 vertices (422
`TOO_LARGE`); `BAD_MATRIX` as in `/diagonalize`.

### `GET /bibliography?keys=a,b,c`
→ `{ key: string; formatted: string; authors: string; title: string; venue: string; year: string; doi: string|null; arxiv: string|null; url: string|null; bibtex: string; short: string }[]`

In the order of `keys`; `short` is the label of the citation chips ("Leal Duarte and Johnson 2002"). An unknown key
gives an entry whose `formatted` says it is not in the bibliography; no keys give `[]`.

### `GET /labels?keys=a,b`
→ `Record<string, { number: string | null; ref: string }>`, the numbers of the current compilation of the thesis:
`"thm:LB"` → `{ number: "3.2", ref: "Theorem 3.2" }`; `chap:` labels give `"Chapter n"`, `eq:` labels `"(n)"`; an
unknown label has `number: null`.

### `GET /statements?keys=a,b`
→ `Record<string, Statement | null>`; without `keys`, every statement.
```ts
type Statement = { label: string; kind: string; number: string | null; ref: string; title: string | null; text: string; chapter: string };
// kind: "Theorem", "Lemma", "Proposition", "Corollary", "Definition", "Remark", "Question", ...;
// text: prose with $...$, read from the LaTeX source, references replaced by their numbers and citations by short labels
```

### `GET /statements-by-ref?refs=Theorem 3.2,Definition 4.18`
→ `Record<string, Statement | null>`, the same statements looked up by their printed reference; without `refs`, every
numbered statement, keyed by its reference.

### `GET /glossary`
→ `{ key: string; term: string; text: string; ref: string; label: string; source: "definition" | "text" | "list" }[]`:
the terms defined in the thesis, each with the definition or the sentence that introduces it.

### `GET /macros`
→ `Record<string, string>`: the macros of the thesis in KaTeX form (`"\\DSpec": "\\operatorname{DSpec}"`, `#1` for an argument).

### `GET /questions`
→ `{ id: string; statement: string; evidence: string; references: string[]; thesis: string[] }[]`: the questions of the
conclusion chapter, as the thesis states them (`evidence` and `references` are empty, `thesis` is `["Question n.m"]`).

### `GET /notation`
→ `{ symbol: string; meaning: string; where: string }[]`: the list of notation of the thesis, and a row for the bound
$|\mathcal Z(M)| - |\Delta_c(M)|$. There is no notation page; the tooltips of the symbols use this table.

### `GET /algorithms`
→
```ts
{
  thesis: Algorithm[];   // Diagonalize, φ, StrongRealization, RootedSeedRealization, TowerChain, FoldToSeed, RealizeTree
  site: Computation[];   // computations of the site that are not named algorithms: latent, verify, propagation, recognize
  repository: string;    // the GitHub repository the code links point to
  commit: string;        // IEPG_COMMIT, set when the image is built, else "main"
}
type Algorithm = { id: string; name: string; about: string; where: string | null; lines: Line[]; python: PyFunction[]; lab: { to: string; label: string } | null };
type Computation = { id: string; name: string; about: string; thesis: string[]; python: PyFunction[]; lab: { to: string; label: string } | null };
type Line = { n: string | null; kind: "title" | "head" | "step" | "cont" | "blank"; indent: number; parts: { t: "text" | "math" | "kw" | "code" | "pad"; v: string }[] };
type PyFunction = { name: string; path: string; start: number; end: number; code: string; url: string };
```
`lines` is the pseudocode of the thesis, read from its tabbing block in the LaTeX source, and `where` the figure or
section that holds it; `python` are the functions that run it, read from the running code, with `url` pointing to
their lines on GitHub at `commit`; `lab` is the page of the site where it runs.

## All endpoints

| Method and path | Described in |
|---|---|
| `GET /meta`, `GET /health` | this file |
| `POST /trees/parse`, `/trees/fold`, `/trees/analyze` | this file |
| `GET /catalog/seeds`, `/catalog/seeds/{name}`, `/catalog/rooted-seeds`, `/catalog/counts`, `/catalog/gallery` | this file |
| `POST /diagonalize`, `/latent` | this file |
| `GET /bibliography`, `/labels`, `/statements`, `/statements-by-ref`, `/glossary`, `/macros`, `/questions`, `/notation` | this file |
| `GET /algorithms` | this file |
| `GET /playground/seeds`, `POST /playground/state`, `/playground/generate` | `API_CONTRACT_v2.md` |
| `POST /lab/strong-realization`, `/lab/family`, `/admissible`, `/lab/tower` | `API_CONTRACT_v2.md` |
| `POST /graphs/unicyclic`, `/graphs/couple`, `/graphs/threshold`, `/graphs/cograph` | `API_CONTRACT_v2.md` |

## Frontend routes
`/`, `/analyze`, `/tree/:canonical`, `/playground`, `/trees/small`, `/trees/d6`, `/trees/d7`, `/trees/large`,
`/seeds/sd`, `/classes/threshold`, `/classes/cographs`, `/classes/unicyclic`, `/lab/diagonalize`, `/lab/latent`,
`/lab/admissibility`, `/lab/build-sd`, `/lab/towers`, `/algorithms`, `/questions`, `/history`, `/about`.

Redirects: `/draw` → `/analyze`, `/trees` → `/trees/small`, `/rooted-seeds` → `/trees/d6#rooted-seeds`, `/classes` →
`/classes/threshold`, `/lab` → `/lab/diagonalize`, `/notation` → `/`. Any other path shows a page not found. When the
backend serves the built frontend, it answers every path outside `/api` with `index.html`, apart from `/assets`, the
files at the top of `dist`, and `/docs` and `/redoc` outside production.

Dev: Vite proxies `/api` to `http://localhost:8000`.
