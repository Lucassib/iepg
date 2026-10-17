# API contract, addendum v2 (2026-09-27)

New endpoints of the backend: the Playground, the constructions of the laboratory and the other classes of graphs.
Real responses of these endpoints are saved in `iepg_app/api_samples/*.json`, a snapshot taken on 2026-09-27 (with
`glossary.json`, `macros.json` and `statements.json` of the endpoints of the thesis text, described in
`API_CONTRACT.md`). The TypeScript types follow those samples field by field, and their fields still match the API;
the numbers of theorems, lemmas and definitions in them, and the quoted texts, are those of the thesis on that date,
while the API returns the numbers of the current compilation.

Exact numbers are strings (`"p/q"`); entries of matrices of general graphs are strings like `"1/2√2 - √3"` (sums of
rational multiples of square roots), with `matrix_approx` for display. The errors of these endpoints are HTTP 422 with
`{"detail": {"code", "detail"}}`, with the codes given below; validation errors of FastAPI, the limits on requests and
the other statuses are described in `API_CONTRACT.md`.

`TreeInfo` is the same object as in `API_CONTRACT.md` (with `layout`, `main_roots`, `dashed_edges`).
Graph drawings of non-trees come as `{n, edges, layout}` with `layout: {id: [x, y]}` (y downward).

## Playground (constructions of the thesis)

- `GET /api/v1/playground/seeds?d=` (1 ≤ d ≤ 15, else `BAD_D`) → list of seeds the thesis can realize in diameter d:
  `{id, label (TeX), family, d, params: [{name, kind: "int"|"set", default, text}], note, tree: TreeInfo, n}`.
  Families: `S_d`; for d = 6 the six `S6_i`; for odd d ≥ 7 the 21 `T_i_j` (i ≤ j) and `B_b` for 4 ≤ b < (d − 1)/2;
  for even d ≥ 8 the 36 ordered `T_i_j` and `B_b` for 4 ≤ b < (d − 2)/2. Sample: `playground_seeds_d7.json`,
  `playground_seeds_d10.json`.
- `POST /api/v1/playground/state` `{seed, d, ops: [[y, u], ...]}` → the seed after the duplications
  (each op duplicates the branch at y rooted at u, once): `{tree: TreeInfo (dashed_edges = the new edges),
  root, main_roots, duplicable: {u: y}, n, d, seed_n, ops}`. `duplicable` lists every vertex u whose branch
  (seen from the root) can be duplicated at its parent y without changing the diameter; clicking u appends
  `[y, u]`. `BAD_OP` if an op changes the diameter, if the seed is not in the list of its diameter, or beyond 150
  duplications or 200 vertices. Samples: `playground_state.json`, `playground_state_after.json`, `error_example.json`.
- `POST /api/v1/playground/generate` `{seed, d, ops, params?}` → on success `{ok: true, method, prescribed,
  seed: {tree, matrix, root, other_main_roots, spectrum: [{value, multiplicity}], latent, confined, witnesses,
  is_brick, reason}, tree: {tree, matrix, root, n, spectrum, q, check}, duplications, theorems, references, info}`;
  on failure `{ok: false, reason, conditions?, info}` where `conditions` lists the conditions C1–C6 of the
  lemma on the six rooted seeds with `ok` flags. `params`: `alpha`, `beta`, `lambda7` integers and `Lambda` a list of
  seven integers, all of absolute value at most 10^15 (`BAD_OP` otherwise). Samples: `playground_generate.json`,
  `playground_generate_fail.json`.

## Laboratory

- `POST /api/v1/lab/strong-realization` `{k, alpha, beta, even?}` (1 ≤ k ≤ 7) or `{set, even?}` (an odd number of
  values, 3 to 15) → `{k, set, ok, fail, trace, verification, tree, matrix, even?, theorems}`. `trace` is the
  recursion: each node `{k, set, ok, gammaL, gammaR, choice ('+'|'-'|null), mu, fail, phi: {lam, dx, dy, w2, edge,
  left, right}, n, tree: TreeInfo, matrix, lateral, interior}`; `phi.left` are the ids of the lateral copy,
  `phi.right` those of the interior copy. Errors `BAD_K`, `BAD_SET`. Sample: `lab_strong_realization.json`.
- `POST /api/v1/lab/family` `{k, alpha, beta?, delta?}` (1 ≤ k ≤ 10) → the explicit family Λ^(j), Λ₁^(j), Λ₂^(j),
  j = 1..k: `{alpha, beta, delta, family: [{j, Lambda, Lambda1, Lambda2}]}`. Errors `BAD_K`, `BAD_SET`, `BAD_DELTA`
  (δ needs k positive entries with δ_i ≤ δ_{i−1}/2). Sample: `lab_family.json`.
- `POST /api/v1/admissible` `{set}` (an odd number of values, 3 to 21) → `{admissible, tree, theorems}`; `tree` nodes
  `{set, k, tested, ok, gammaL, gammaR, choice, mu, children: [{role: 'interior'|'lateral', node}], alternative (the
  lateral not taken), fail}`. Errors `BAD_SET`, `TOO_LARGE`. Sample: `admissible.json`.
- `POST /api/v1/lab/tower` `{pair: [i, j], k, even?, Lambda?, lambda7?}` (1 ≤ i, j ≤ 6) or `{b, k, even?}`
  (4 ≤ b ≤ k), with 3 ≤ k ≤ 9 → `{k, towers: [{name, ok, fail, levels: [{j, A, n, label, built_from, phi, blocks,
  ok, copies: [{base, label, set, vertices, root}], seams: [{a, b, level}], block_layout: {copy: [x, y]}, draw,
  tree?: TreeInfo, matrix?, origin: ["baseLevel:copy" per vertex]}]}, ×2], seed: {d, n, draw, tree?, matrix?,
  verification, method}, fail, count: {odd, even, text}, theorems}`. The seed carries its tree up to 300 vertices and
  its matrix up to 64. Errors `BAD_K`, `BAD_PAIR`, `BAD_B`, `BAD_TOWER`. Sample: `lab_tower.json`.

## Other classes of graphs

- `POST /api/v1/graphs/unicyclic` `{n, edges}` (at most 200 vertices) → `{graph, kind ('cycle'|'tadpole'|'sunlet'|'unicyclic'),
  params, cycle, girth, pendant, lower: [{value, text, references, source}], lower_value, upper: {...}, exact: {...}|null,
  references}`. Errors `BAD_GRAPH` (not connected, not one cycle, an invalid edge), `TOO_LARGE`. Sample: `graphs_unicyclic.json`.
- `POST /api/v1/graphs/couple` `{tree: TreeInput, attach, k, mode: 'one'|'all'}` (3 ≤ k ≤ 40) → the same object for
  the unicyclic graph C_k with the tree coalesced at one cycle vertex (`one`) or at every cycle vertex (`all`), at most
  200 vertices in all. Errors `BAD_MODE`, `BAD_K`, `BAD_GRAPH`, `TOO_LARGE`. Sample: `graphs_couple.json`.
- `POST /api/v1/graphs/threshold` `{sequence: "0010111", lam}` (1 to 40 digits, λ ≠ 0) → `{graph, sequence, blocks,
  matrix, matrix_approx, lam, verification: {product_is_zero, spectrum, q}, lower, lower_value, upper, exact,
  references}`. Errors `BAD_SEQUENCE`, `BAD_GRAPH`. Sample: `graphs_threshold.json`.
- `POST /api/v1/graphs/cograph` `{expr, lam}` with `expr = {op: 'v'} | {op: 'union'|'join', children: [expr, ...]}`
  (at most 60 vertices, λ ≠ 0) → `{graph, cotree, twin_steps: [{added, twin_of, kind, case, new_eigenvalue}],
  spectrum_by_construction, matrix, matrix_approx, lam, verification, lower, lower_value, upper, exact, references}`.
  Error `BAD_GRAPH`. Sample: `graphs_cograph.json`.
