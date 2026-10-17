"""FastAPI application: the API of the contract in iepg_app/API_CONTRACT.md."""
from __future__ import annotations

import hashlib
import json
from fractions import Fraction
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel

from . import algorithms as _algorithms, bib, config, labels
from .limits import time_limited
from .catalog import _notation, catalog, counts as catalog_counts, gallery_public, load_questions, tree_iso, transport
from .diag import Matrix, diagonalize, frac, latent_report, num_json, real_roots, subtree_charpolys
from .fold import fold_to_seed, unfold_realization
from .realize_tree import realize_tree
from .recognize import MAX_D, recognize
from .trees import PARSERS, S_seed, Tree, TreeError, from_canonical, gallery_build, tree_info

import logging  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from .security import Guard  # noqa: E402

_access = logging.getLogger("iepg.access")
if not _access.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    _access.addHandler(_h)
    _access.setLevel(logging.INFO)
    _access.propagate = False


@asynccontextmanager
async def lifespan(_app):
    """Loads and re-verifies the catalog and reads the thesis once at start-up, so that a missing file or a failed
    certificate stops the deployment instead of the first visitor's request."""
    from . import thesis_text

    cat = catalog()
    n_statements = len(thesis_text.statements())
    n_terms = len(thesis_text.glossary())
    if n_statements == 0 or n_terms == 0 or not labels.numbers().get("thm:brick-diminimal"):
        raise RuntimeError(f"the thesis sources in {config.THESIS} are incomplete")
    # the seeds of the playground, built once here: the computations run in children forked from this process
    # (limits.py), which inherit these caches
    from . import playground

    n_pg = 0
    for d in range(1, playground.MAX_D + 1):
        for e in playground.seeds_for(d):
            try:
                playground.default_tree(e["id"], d)
                n_pg += 1
            except TreeError:
                pass
        playground._seed_ids(d)
    labels.numbers()
    bib.load_bib()
    _access.info("start: %d seeds, %d statements, %d terms, %d playground seeds, thesis at %s",
                 len(cat.by_canonical), n_statements, n_terms, n_pg, config.THESIS)
    stale = config.thesis_changed_since_bundle()
    if stale:
        _access.warning("the thesis changed after the compiled copy was made (%s); run scripts/bundle_thesis.py", ", ".join(stale[:5]))
    yield


app = FastAPI(
    title="IEP-G: seeds, bricks and the minimum number of distinct eigenvalues of a tree",
    version="0.1.0",
    docs_url=None if config.PRODUCTION else "/docs",
    redoc_url=None if config.PRODUCTION else "/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)
if config.CORS_ORIGINS:
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["content-type"])
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(Guard)  # added last, so it is the outermost layer

MAX_N = 200


class TreeInput(BaseModel):
    format: Optional[str] = None
    data: Optional[str] = None
    params: Optional[Dict[str, float]] = None
    canonical: Optional[str] = None


class AnalyzeBody(BaseModel):
    tree: TreeInput
    matrix: Optional[Dict[str, Any]] = None


class FoldBody(BaseModel):
    tree: TreeInput


class DiagBody(BaseModel):
    tree: TreeInput
    root: int
    matrix: Dict[str, Any]
    lam: str


class LatentBody(BaseModel):
    tree: TreeInput
    root: int
    matrix: Dict[str, Any]


def _err(code: str, detail: str, status: int = 400):
    raise HTTPException(status_code=status, detail=dict(code=code, detail=detail))


def resolve(inp: TreeInput):
    """Returns (tree, dashed_edges, roots)."""
    try:
        if inp.canonical:
            t = from_canonical(inp.canonical)
            if t.n < 2:
                _err("TOO_SMALL", "a tree needs at least two vertices here", 422)
            return t, [], None
        if not inp.format:
            _err("NO_FORMAT", "give a format and data, or a canonical string")
        fmt = inp.format
        data = inp.data or ""
        if fmt in PARSERS:
            t = PARSERS[fmt](data)
            if t.n < 2:
                _err("TOO_SMALL", "a tree needs at least two vertices here", 422)
            return t, [], None
        if fmt == "gallery":
            t, dashed = gallery_build(data.strip(), inp.params or {})
            return t, dashed, None
        if fmt == "catalog":
            cat = catalog()
            name = data.strip().replace(" ", "")
            name = name.replace("⊙", "x").replace("\\odot", "x")
            # names are read without regard to case: s6_3 is S6_3, r2xr5 is R2xR5
            by_lower = {k.lower(): k for k in list(cat.seeds) + list(cat.rooted)}
            name = by_lower.get(name.lower(), name)
            if name[:2].lower() == "s_" and name[2:].isdigit():
                name = "S_" + name[2:]
            if name.startswith("S_") and name[2:].isdigit():
                d = int(name[2:])
                from .trees import S_d_tree
                if d < 1 or d > 15:
                    _err("BAD_CATALOG", "S_d is available for 1 ≤ d ≤ 15")
                t, r, dashed = S_d_tree(d)
                return t, dashed, None
            if name in cat.seeds:
                e = cat.seeds[name]
                t = Tree.from_edges(e["tree"]["n"], [tuple(x) for x in e["tree"]["edges"]])
                return t, [tuple(x) for x in e["tree"].get("dashed_edges", [])], e["tree"]["main_roots"]
            if name in cat.rooted:
                e = cat.rooted[name]
                t = Tree.from_edges(e["rooted_tree"]["n"], [tuple(x) for x in e["rooted_tree"]["edges"]])
                return t, [], [e["rooted_root"]]
            _err("BAD_CATALOG", f"unknown catalog name '{data}'. Use S6_3, R2xR5, S_9, R4, ...")
        _err("BAD_FORMAT", f"unknown format '{fmt}'")
    except (TreeError, IndexError, ValueError) as e:
        _err("BAD_TREE", str(e) or "cannot read this tree", 422)
    return None, [], None  # unreachable


def check_size(t: Tree):
    if t.n > MAX_N:
        _err("TOO_LARGE", f"at most {MAX_N} vertices in this version", 422)


@app.api_route("/api/v1/health", methods=["GET", "HEAD"], include_in_schema=False)
def health():
    return dict(ok=True)


@app.get("/api/v1/meta")
def meta():
    cat = catalog()
    h = hashlib.sha256(json.dumps(sorted(cat.by_canonical.items())).encode()).hexdigest()[:12]
    return dict(version="0.1.0", thesis_version=config.thesis_date(), catalog_hash=h, catalog_log=cat.log)


@app.post("/api/v1/trees/parse")
@time_limited()
def parse(inp: TreeInput):
    t, dashed, roots = resolve(inp)
    check_size(t)
    return tree_info(t, dashed=dashed, roots=roots)


def _carry(seed_tree_json: dict, matrix_json: dict, seed: Tree, steps) -> Matrix:
    """A matrix stored on a catalog seed, moved to the seed found by FoldToSeed and carried to T by regular 1-ABDs."""
    tcat = Tree.from_edges(seed_tree_json["n"], [tuple(e) for e in seed_tree_json["edges"]])
    phi = tree_iso(tcat, seed)
    if phi is None:
        raise TreeError("the catalog seed is not isomorphic to the seed of T")
    return unfold_realization(steps, transport(Matrix.parse(tcat, matrix_json), phi))


def _realization(t: Tree, M: Matrix, source: str, kind: str) -> dict:
    root = t.main_roots()[0]
    ds = real_roots(subtree_charpolys(t, root, M)[root])
    return dict(matrix=M.to_json(), root=root, dspec=[num_json(r) for r in ds], source=source, kind=kind)


def _fold_steps_json(steps):
    return [dict(tree=tree_info(s.tree), removed_branch=s.removed_branch, at_vertex=s.at_vertex, isomorphic_to=s.isomorphic_to) for s in steps]


@app.post("/api/v1/trees/fold")
@time_limited()
def fold(body: FoldBody):
    t, dashed, roots = resolve(body.tree)
    check_size(t)
    steps = fold_to_seed(t)
    seed = steps[-1].tree
    return dict(seed=tree_info(seed), seed_name=catalog().lookup(seed), steps=_fold_steps_json(steps))


@app.post("/api/v1/trees/analyze")
@time_limited()
def analyze(body: AnalyzeBody):
    cat = catalog()
    R = labels.ref
    t, dashed, roots = resolve(body.tree)
    check_size(t)
    d = t.diameter()
    info = tree_info(t, dashed=dashed, roots=roots)
    steps = fold_to_seed(t)
    seed = steps[-1].tree
    seed_name = cat.lookup(seed)
    notes: List[str] = []
    refs: List[str] = ["leal2002minimum"]
    # ---- status of the seed ----
    recognized = None
    if seed_name:
        entry = cat.seeds[seed_name]
        status, cert = entry["status"], entry["certificate"]
    else:
        chain = cat.seed_defective_by_propagation(seed)
        if chain:
            status = "defective"
            cert = dict(kind="propagation", references=[], thesis=[R("cor:even-seed"), R("cor:odd-seed"), R("lem:heredity")],
                        summary="The seed inherits defectivity from one of its rooted seeds. " + " ".join(chain), chain=dict(steps=chain))
        elif d <= 5:
            status = "diminimal"
            cert = dict(kind="literature", references=["JS08", "JSdiminimal"], thesis=[],
                        summary="Every tree of diameter at most 5 is diminimal (Johnson and Saiago).")
        else:
            recognized = recognize(seed)
            if recognized:
                status = "diminimal"
                cert = dict(kind="brick" if recognized.brick else "theorem", references=recognized.references, thesis=recognized.thesis, summary=recognized.summary)
            else:
                status = "unknown"
                cert = dict(kind="none", references=[], thesis=[R("def:Sd"), R("def_seeds"), R("many_seeds"), R("cor:even-seed"), R("cor:odd-seed")],
                            summary=(f"This seed is not among the seeds for which the thesis provides a brick, namely S_d ({R('def:Sd')}), the seeds of "
                                     f"{R('def_seeds')} and those of {R('many_seeds')}, and no defective rooted seed of depth 3 propagates to it "
                                     f"({R('cor:even-seed')} and {R('cor:odd-seed')}). The thesis does not decide whether it is diminimal."))
    refs += cert.get("references", [])
    # ---- what we know about T ----
    q_lower = dict(value=d + 1, source=f"q(T) ≥ d(T) + 1 for every tree ({R('thm:LB')}, Leal-Duarte and Johnson 2002).", references=["leal2002minimum"], thesis=[R("thm:LB")])
    q_upper = None
    q_exact = None
    realization = None
    bad = cat.certified_bad.get(info["canonical"])
    if bad:
        q_lower = dict(value=bad["q_lower"], source=f"this tree is certified non-diminimal: {bad['source']}.", references=bad["references"], thesis=bad["thesis"])
        refs += bad["references"]
    if status == "diminimal":
        q_exact = dict(value=d + 1, source=f"the seed is diminimal, so every tree in its family satisfies q(T) = d(T) + 1.", references=cert.get("references", []), thesis=cert.get("thesis", []))
        M_T, how = None, ""
        if d <= MAX_D and S_seed(d).to_tree()[0].canonical() == seed.canonical():
            # T is in the family of S_d: Algorithm RealizeTree
            M_T = realize_tree(t)
            how = (f"RealizeTree(T, 0, {2 ** ((d + 1) // 2 - 1)}) ({R('prop:algorithms')}): StrongRealization gives the brick of S_{d}"
                   f"{', a regular 1-ABD gives the even diameter' if d % 2 == 0 else ''}, and {len(steps) - 1} regular 1-ABD(s) ({R('def:abd')}) carry it to T.")
        elif cert.get("kind") == "brick" and seed_name:
            # carry the brick of the catalog to T by regular 1-ABDs along the fold steps
            entry = cat.seeds[seed_name]
            M_T = _carry(entry["tree"], cert["brick"]["matrix"], seed, steps)
            how = f"the brick of ${entry['label']}$ carried to T by {len(steps) - 1} regular 1-ABD(s) ({R('def:abd')}, {R('thm:brick-diminimal')})."
        elif recognized and recognized.brick is not None:
            M_T = unfold_realization(steps, recognized.brick)
            how = f"the brick of {recognized.name} carried to T by {len(steps) - 1} regular 1-ABD(s) ({R('def:abd')}, {R('thm:brick-diminimal')})."
        if M_T is not None:
            realization = _realization(t, M_T, how, "exact")
            if len(realization["dspec"]) != d + 1:
                notes.append("Internal check failed: the computed matrix does not have d + 1 distinct eigenvalues. Please report this tree.")
                realization = None
    else:
        if t.is_linear():
            q_exact = dict(value=d + 1, source="T is a linear tree, and every linear tree is diminimal (Johnson and Wakhare 2022); this holds even when the seed of T is defective.", references=["johnson2022inverse"], thesis=[])
            refs.append("johnson2022inverse")
        elif d == 6:
            m8 = cat.seeds[seed_name].get("q8_matrix") if seed_name else None
            if m8:
                # the matrix M_S of the thesis carried to T, as in the proof of the bound C(6) = 8
                M_T = _carry(cat.seeds[seed_name]["tree"], m8["matrix"], seed, steps)
                how = (f"the matrix M_S of {R('fig:C6-weights')}, whose only latent value is 1 ({R('prop:C6-Z')}), carried to T by "
                       f"{len(steps) - 1} regular 1-ABD(s) ({R('def:abd')}), as in the proof of {R('q8thm')}.")
                cand = _realization(t, M_T, how, "upper")
                if len(cand["dspec"]) <= 8:
                    realization = cand
                    q_upper = dict(value=len(cand["dspec"]), source=f"the matrix below has q(M) = {len(cand['dspec'])}: {how}", references=["allem2026minimum"], thesis=m8["thesis"] + [R("def:abd")])
            if q_upper is None:
                q_upper = dict(value=8, source=f"every tree of diameter 6 satisfies q(T) ≤ 8 (C(6) = 8, {R('cor:C6')}).", references=["allem2026minimum", "JSdiminimal"], thesis=[R("cor:C6")])
            refs += ["allem2026minimum"]
        if status == "defective" and not bad:
            # a tree certified non-diminimal needs no reminder that some unfoldings are not
            notes.append("Defective is a property of the family 𝒯(S), not of each tree in it: some unfoldings of a defective seed are not diminimal, not necessarily this one.")
    if body.matrix:
        try:
            M = Matrix.parse(t, body.matrix)
            root_T = t.main_roots()[0]
            rep = latent_report(t, root_T, M)
            q_user = dict(value=rep.bound, source=f"your matrix: |Z(M)| − |Δ_c(M)| = {rep.bound} bounds q(T') for every unfolding T' of this tree rooted at {root_T}, by the argument of {R('prop:latent-bound')}; q(M) = {rep.q_M}.", references=[], thesis=[R("prop:latent-bound")])
            if q_upper is None or rep.q_M < q_upper["value"]:
                q_upper = dict(value=rep.q_M, source=f"your matrix has q(M) = {rep.q_M} distinct eigenvalues.", references=[], thesis=[])
            notes.append(q_user["source"])
        except TreeError as e:
            notes.append(f"The matrix was ignored: {e}")
    if q_exact is None and q_upper and q_upper["value"] == q_lower["value"]:
        # the two bounds meet: the matrix shown attains the lower bound
        q_exact = dict(value=q_lower["value"], source=f"{q_lower['source'][:-1]}, and {q_upper['source']}",
                       references=list(dict.fromkeys(q_lower["references"] + q_upper["references"])),
                       thesis=list(dict.fromkeys(q_lower["thesis"] + q_upper["thesis"])))
        if realization:
            realization["kind"] = "exact"
    if q_exact:
        q_upper = dict(value=q_exact["value"], source=q_exact["source"], references=q_exact["references"], thesis=q_exact["thesis"])
    refs = list(dict.fromkeys(k for k in refs if k))
    return dict(tree=info, seed=tree_info(seed), seed_name=seed_name, seed_label=cat.seeds[seed_name]["label"] if seed_name else None,
                fold_steps=_fold_steps_json(steps), seed_status=status, seed_certificate=cert,
                q_lower=q_lower, q_upper=q_upper, q_exact=q_exact, realization=realization, notes=notes, references=refs)


@app.get("/api/v1/catalog/seeds")
def catalog_seeds(d: int = Query(6)):
    return catalog().seed_summaries(d)


@app.get("/api/v1/catalog/seeds/{name}")
def catalog_seed(name: str):
    cat = catalog()
    if name not in cat.seeds:
        _err("NOT_FOUND", f"no seed named {name}", 404)
    return cat.seeds[name]


@app.get("/api/v1/catalog/rooted-seeds")
def rooted_seeds(depth: int = Query(3)):
    if depth != 3:
        _err("UNSUPPORTED", "only depth 3 is drawn in this version", 422)
    return list(catalog().rooted.values())


@app.get("/api/v1/algorithms")
def algorithms_page():
    return _algorithms.algorithms()


@app.get("/api/v1/catalog/counts")
def counts():
    return catalog_counts()


@app.get("/api/v1/catalog/gallery")
def gallery():
    return gallery_public()


@app.post("/api/v1/diagonalize")
@time_limited()
def diag(body: DiagBody):
    t, _, _ = resolve(body.tree)
    check_size(t)
    if not 0 <= body.root < t.n:
        _err("BAD_ROOT", "root must be a vertex of the tree", 422)
    try:
        M = Matrix.parse(t, body.matrix)
        lam = frac(body.lam)
    except TreeError as e:
        _err("BAD_MATRIX", str(e), 422)
    return diagonalize(t, body.root, M, lam).to_json()


@app.post("/api/v1/latent")
@time_limited()
def latent(body: LatentBody):
    t, _, _ = resolve(body.tree)
    check_size(t)
    if t.n > 60:
        _err("TOO_LARGE", "the exact computation of Z(M) is limited to 60 vertices in this version", 422)
    if not 0 <= body.root < t.n:
        _err("BAD_ROOT", "root must be a vertex of the tree", 422)
    mains = t.main_roots()
    if body.root not in mains:
        # Definition def:confined and the bound of prop:latent-bound take T rooted at a main root
        _err("BAD_ROOT", f"latent and confined values are defined for the tree rooted at a main root: choose {' or '.join(map(str, mains))}", 422)
    try:
        M = Matrix.parse(t, body.matrix)
    except TreeError as e:
        _err("BAD_MATRIX", str(e), 422)
    return latent_report(t, body.root, M).to_json()


@app.get("/api/v1/bibliography")
def bibliography(keys: str = Query("")):
    ks = [k.strip() for k in keys.split(",") if k.strip()]
    out = bib.get_entries(ks)
    for e in out:
        e["short"] = bib.short_cite(e["key"])
    return out


@app.get("/api/v1/labels")
def labels_endpoint(keys: str = Query("")):
    """Numbers of theorems, definitions, equations and chapters of the current compilation of the thesis:
    {label: {"number": "6.20", "ref": "Proposition 6.20"}}."""
    out = {}
    for k in [x.strip() for x in keys.split(",") if x.strip()]:
        num = labels.numbers().get(k)
        head = k.split(":")[0].lower()
        ref = labels.chapter(k) if head == "chap" else (f"({num})" if head == "eq" and num else labels.ref(k))
        out[k] = dict(number=num, ref=ref)
    return out


@app.get("/api/v1/statements")
def statements_endpoint(keys: str = Query("")):
    """Statements of the thesis (theorems, lemmas, propositions, corollaries, definitions, remarks, questions)
    by label, read from the LaTeX source of the chapters included in main.tex."""
    from . import thesis_text
    st = thesis_text.statements()
    ks = [x.strip() for x in keys.split(",") if x.strip()]
    if not ks:
        return st
    return {k: st.get(k) for k in ks}


@app.get("/api/v1/statements-by-ref")
def statements_by_ref(refs: str = Query("")):
    """The same statements, looked up by their printed reference ("Theorem 6.12", "Definition 4.18")."""
    from . import thesis_text
    idx = {v["ref"]: v for v in thesis_text.statements().values() if v.get("number")}
    rs = [x.strip() for x in refs.split(",") if x.strip()]
    return {r: idx.get(r) for r in rs} if rs else idx


@app.get("/api/v1/glossary")
def glossary_endpoint():
    """The terms defined in the thesis, each with the sentence or definition that introduces it."""
    from . import thesis_text
    return thesis_text.glossary()


@app.get("/api/v1/macros")
def macros_endpoint():
    """The macros of the thesis for KaTeX."""
    from . import thesis_text
    return thesis_text.macros()


@app.get("/api/v1/questions")
def questions():
    return load_questions()


@app.get("/api/v1/notation")
def notation():
    return _notation()


# ------------------------------------------------------------------------------------------------
# Constructions of Chapter 5: StrongRealization, towers, admissibility, playground
# ------------------------------------------------------------------------------------------------
from . import graphs as _graphs  # noqa: E402
from . import playground as _pg  # noqa: E402
from . import realize as _rz  # noqa: E402


class SRBody(BaseModel):
    k: Optional[int] = None
    set: Optional[List[str]] = None
    alpha: Optional[str] = None
    beta: Optional[str] = None
    even: bool = False


@app.post("/api/v1/lab/strong-realization")
@time_limited()
def lab_strong_realization(body: SRBody):
    try:
        if body.set:
            if not 3 <= len(body.set) <= 15 or len(body.set) % 2 == 0:
                _err("BAD_SET", "give an odd number 2k + 1 of values, between 3 and 15 (S_13 has 128 vertices)", 422)
            L = [frac(x) for x in body.set]
            k = (len(L) - 1) // 2
        else:
            k = 3 if body.k is None else body.k
            if not 1 <= k <= 7:
                _err("BAD_K", "k must be between 1 and 7 (S_13 has 128 vertices)", 422)
            a = frac(body.alpha or "0")
            b = frac(body.beta or str(int(a) + 2 ** k))
            if b <= a:
                _err("BAD_SET", "β must be larger than α", 422)
            L = _rz.lambda_1(k, a, b, _rz.default_delta(k, a, b))
    except TreeError as e:
        _err("BAD_SET", str(e), 422)
    node = _rz.strong_realization(k, L)
    out = dict(k=k, set=[_rz.fstr(x) for x in sorted(L)], ok=node.ok, fail=node.fail, trace=node.to_json(with_matrices=True))
    if node.ok:
        other = len(node.phi.left) if node.phi else 1
        ver = _rz.verify(node.X, L, 2 * k - 1, [other])
        out["verification"] = ver.to_json()
        out["tree"] = tree_info(node.X.tree(), roots=[0, other])
        out["matrix"] = node.X.matrix_json()
        if body.even:
            X2 = _rz.abd_other_root(node.X, other)
            ver2 = _rz.verify(X2, L, 2 * k, [])
            out["even"] = dict(tree=tree_info(X2.tree(), roots=[0]), matrix=X2.matrix_json(), verification=ver2.to_json())
    out["theorems"] = [labels.ref("def:admissible"), labels.ref("thm:general_spectra"), labels.ref("prop:explicit-family")]
    return out


MAX_ADMISSIBLE = 21


class AdmBody(BaseModel):
    set: List[str]


@app.post("/api/v1/admissible")
@time_limited()
def admissible_endpoint(body: AdmBody):
    if len(body.set) > MAX_ADMISSIBLE:
        # the recursion of Definition def:admissible has 2^k leaves
        _err("TOO_LARGE", f"the admissibility test is limited to sets of at most {MAX_ADMISSIBLE} values in this version", 422)
    if len(body.set) < 3 or len(body.set) % 2 == 0:
        _err("BAD_SET", "an admissible set has an odd number 2k + 1 of values, with k ≥ 1", 422)
    try:
        L = [frac(x) for x in body.set]
    except TreeError as e:
        _err("BAD_SET", str(e), 422)
    ok, tree = _rz.admissible(L)
    return dict(admissible=ok, tree=tree, theorems=[labels.ref("def:admissible"), labels.ref("lem:low-adm")])


class FamilyBody(BaseModel):
    k: int
    alpha: str = "0"
    beta: Optional[str] = None
    delta: Optional[List[str]] = None


@app.post("/api/v1/lab/family")
@time_limited()
def lab_family(body: FamilyBody):
    k = body.k
    if not 1 <= k <= 10:
        _err("BAD_K", "k must be between 1 and 10", 422)
    try:
        a = frac(body.alpha)
        b = frac(body.beta) if body.beta else a + 2 ** k
        delta = [frac(x) for x in body.delta] if body.delta else None
    except TreeError as e:
        _err("BAD_SET", str(e), 422)
    if b <= a:
        _err("BAD_SET", "β must be larger than α", 422)
    if delta is None:
        delta = _rz.default_delta(k, a, b)
    if len(delta) != k or not _rz.delta_ok(delta):
        _err("BAD_DELTA", "δ needs k positive entries with δ_i ≤ δ_{i−1}/2", 422)
    fam = []
    for j in range(1, k + 1):
        fam.append(dict(j=j, Lambda=[_rz.fstr(x) for x in _rz.lambda_family(j, a, b, delta)],
                        Lambda1=[_rz.fstr(x) for x in _rz.lambda_1(j, a, b, delta)],
                        Lambda2=[_rz.fstr(x) for x in _rz.lambda_2(j, a, b, delta)]))
    return dict(alpha=_rz.fstr(a), beta=_rz.fstr(b), delta=[_rz.fstr(x) for x in delta], family=fam)


class TowerBody(BaseModel):
    pair: Optional[List[int]] = None      # [i, j] with 1 <= i, j <= 6
    b: Optional[int] = None               # for S^[b]
    k: int = 5
    even: bool = False
    Lambda: Optional[List[int]] = None
    lambda7: Optional[int] = None


@app.post("/api/v1/lab/tower")
@time_limited()
def lab_tower(body: TowerBody):
    k = body.k
    if not 3 <= k <= 9:
        _err("BAD_K", "the depth k must be between 3 and 9", 422)
    if body.pair is not None and len(body.pair) != 2:
        _err("BAD_PAIR", "choose two of R_1, ..., R_6", 422)
    if body.pair:
        i, j = body.pair
        if not (1 <= i <= 6 and 1 <= j <= 6):
            _err("BAD_PAIR", "choose two of R_1, ..., R_6", 422)
        lo, hi = min(i, j), max(i, j)
        row = _rz.TABLE_D7[(lo, hi)]
        Lam = [_rz.F(x) for x in (body.Lambda or row[0])]
        l7 = _rz.F(body.lambda7 if body.lambda7 is not None else row[1])
        tl, tlp, ell = _rz.tower_sets(Lam, l7, 3, k)
        first = _rz.tower_view(("R", lo), tl[3], [ell[x] for x in range(4, k + 1)], k)
        second = _rz.tower_view(("R", hi), tlp[3], [ell[x] for x in range(5, k + 2)], k)
        brick, info = _rz.tower_seed_brick("R", i, j, k, body.even, ([int(x) for x in Lam], int(l7)))
        names = (f"R̂_{lo}", f"R̂_{hi}")
    elif body.b:
        bb = body.b
        if not 4 <= bb <= k:
            _err("BAD_B", "b must satisfy 4 ≤ b ≤ k", 422)
        beta = 2 ** k
        delta = _rz.default_delta(k, 0, beta)
        L1 = _rz.lambda_1(bb, 0, beta, delta)
        L2 = _rz.lambda_2(bb, 0, beta, delta)
        tl, tlp, ell = _rz.tower_sets(L1, L2[-1], bb, k)
        first = _rz.tower_view(("S", bb), tl[bb], [ell[x] for x in range(bb + 1, k + 1)], k)
        second = _rz.tower_view(("S", bb), tlp[bb], [ell[x] for x in range(bb + 2, k + 2)], k)
        brick, info = _rz.tower_seed_brick("B", bb, None, k, body.even)
        names = (f"B̂_{bb}", f"B̂_{bb}")
    else:
        _err("BAD_TOWER", "give a pair [i, j] or b", 422)
    d = 2 * k + 2 if body.even else 2 * k + 1
    seed = None
    if brick is not None:
        roots = [0] + list(brick.other_roots)
        seed = dict(d=d, n=brick.X.n, draw=brick.X.n <= 300, tree=tree_info(brick.X.tree(), roots=roots) if brick.X.n <= 300 else None,
                    matrix=brick.X.matrix_json() if brick.X.n <= 64 else None, verification=brick.verification.to_json(), method=brick.method)
    count = dict(odd=21 + (k - 3), even=36 + (k - 3), text=f"At depth k = {k}: at least 21 + (k − 3) = {21 + k - 3} diminimal seeds of diameter {2 * k + 1} and 36 + (k − 3) = {36 + k - 3} of diameter {2 * k + 2}.")
    return dict(k=k, towers=[dict(name=names[0], **first), dict(name=names[1], **second)], seed=seed, fail=info.get("fail", "") if brick is None else "",
                count=count, theorems=[labels.ref("def:tower"), labels.ref("prop:tower-bricks"), labels.ref("many_seeds")])


@app.get("/api/v1/playground/seeds")
def pg_seeds(d: int = Query(7)):
    try:
        out = _pg.seeds_for(d)
    except TreeError as e:
        _err("BAD_D", str(e), 422)
    for e in out:
        try:
            t, roots = _pg.default_tree(e["id"], d)
            e["tree"] = tree_info(t, roots=roots)
            e["n"] = t.n
        except TreeError as ex:
            e["tree"] = None
            e["error"] = str(ex)
    return out


class PGBody(BaseModel):
    seed: str
    d: int
    ops: List[List[int]] = []
    params: Optional[Dict[str, Any]] = None


@app.post("/api/v1/playground/state")
@time_limited()
def pg_state(body: PGBody):
    try:
        return _pg.state(body.seed, body.d, body.ops)
    except TreeError as e:
        _err("BAD_OP", str(e), 422)


@app.post("/api/v1/playground/generate")
@time_limited()
def pg_generate(body: PGBody):
    try:
        return _pg.generate(body.seed, body.d, body.params, body.ops)
    except TreeError as e:
        _err("BAD_OP", str(e), 422)


# ------------------------------------------------------------------------------------------------
# Other classes of graphs
# ------------------------------------------------------------------------------------------------

class GraphBody(BaseModel):
    n: int
    edges: List[List[int]]


@app.post("/api/v1/graphs/unicyclic")
@time_limited()
def graphs_unicyclic(body: GraphBody):
    if not 1 <= body.n <= 200 or len(body.edges) > 400:
        _err("TOO_LARGE", "at most 200 vertices", 422)
    if any(len(e) != 2 for e in body.edges):
        _err("BAD_GRAPH", "an edge is a pair of vertices", 422)
    try:
        G = _graphs.Graph(body.n, [tuple(e) for e in body.edges])
        return _graphs.analyze_unicyclic(G)
    except TreeError as e:
        _err("BAD_GRAPH", str(e), 422)


class CoupleBody(BaseModel):
    tree: TreeInput
    attach: int = 0
    k: int = 5
    mode: str = "one"


@app.post("/api/v1/graphs/couple")
@time_limited()
def graphs_couple(body: CoupleBody):
    t, _, _ = resolve(body.tree)
    check_size(t)
    if body.mode not in ("one", "all"):
        _err("BAD_MODE", "mode is 'one' or 'all'", 422)
    if not 3 <= body.k <= 40:
        _err("BAD_K", "the cycle length must be between 3 and 40", 422)
    try:
        G = _graphs.couple(t, body.attach, body.k, body.mode)
        if G.n > 200:
            _err("TOO_LARGE", "at most 200 vertices", 422)
        return _graphs.analyze_unicyclic(G)
    except TreeError as e:
        _err("BAD_GRAPH", str(e), 422)


class ThresholdBody(BaseModel):
    sequence: str
    lam: str = "1"


@app.post("/api/v1/graphs/threshold")
@time_limited()
def graphs_threshold(body: ThresholdBody):
    seq = "".join(c for c in body.sequence if c in "01")
    if not 1 <= len(seq) <= 40:
        _err("BAD_SEQUENCE", "give between 1 and 40 digits 0/1", 422)
    try:
        return _graphs.analyze_threshold(seq, frac(body.lam))
    except TreeError as e:
        _err("BAD_GRAPH", str(e), 422)


class CographBody(BaseModel):
    expr: Dict[str, Any]
    lam: str = "1"


@app.post("/api/v1/graphs/cograph")
@time_limited()
def graphs_cograph(body: CographBody):
    try:
        return _graphs.analyze_cograph(body.expr, frac(body.lam))
    except TreeError as e:
        _err("BAD_GRAPH", str(e), 422)


# ------------------------------------------------------------------------------------------------
# Serve the built frontend (iepg_app/frontend/dist) when it exists: single-server deployment.
# ------------------------------------------------------------------------------------------------
# the addresses of the frontend (frontend/src/App.tsx), checked by a test
SPA_ROUTES = {"", "analyze", "playground", "draw", "trees", "trees/small", "trees/d6", "trees/d7", "trees/large", "seeds/sd",
              "rooted-seeds", "classes", "classes/threshold", "classes/cographs", "classes/unicyclic", "lab", "lab/diagonalize",
              "lab/latent", "lab/admissibility", "lab/build-sd", "lab/towers", "algorithms", "questions", "notation", "history", "about"}

import mimetypes as _mimetypes  # noqa: E402
import re as _re  # noqa: E402
from pathlib import Path as _Path  # noqa: E402

_mimetypes.add_type("font/woff2", ".woff2")

from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

_DIST = _Path(config.DIST).resolve()
if (_DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")
    # the files at the top of dist (favicon, robots.txt, the theme script), listed once: nothing else is served;
    # "index 2.html" and the like are copies left by file synchronization, not files of the site
    _TOP = {p.name: p for p in _DIST.iterdir() if p.is_file() and not _re.search(r" \d+\.\w+$", p.name)}

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            _err("NOT_FOUND", "no such endpoint", 404)
        if full_path in _TOP:
            return FileResponse(_TOP[full_path])
        # the page of an address the site does not have is served with status 404, so search engines do not index it
        known = full_path.rstrip("/") in SPA_ROUTES or full_path.startswith("tree/")
        return FileResponse(_DIST / "index.html", status_code=200 if known else 404)
