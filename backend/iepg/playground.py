"""Playground: choose a diameter, a seed that the thesis knows how to realize, duplicate branches by clicking,
and generate the matrix given by the algorithms of the thesis (StrongRealization for S_d, the tower bricks
of Proposition prop:tower-bricks, RootedSeedRealization for diameter 7, and the derived bricks of diameter 6),
carried to the unfolding by regular 1-ABDs (Theorem thm:brick-diminimal)."""
from __future__ import annotations

from fractions import Fraction as F
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from . import labels
from .diag import Matrix, fstr
from .fold import regular_abd
from .realize import (BASE_OF_R, RT, TABLE_D7, arm_conditions, realize_S_d, seed6_brick, tower_seed_brick, verify)
from .trees import Tree, TreeError, tree_info

MAX_D = 15
MAX_OPS = 150
MAX_N = 200  # as MAX_N of main.py


def _entry(sid: str, label: str, family: str, d: int, params: List[dict], note: str = "") -> dict:
    return dict(id=sid, label=label, family=family, d=d, params=params, note=note)


def _p_int(name: str, default: int, text: str) -> dict:
    return dict(name=name, kind="int", default=default, text=text)


def _p_set(name: str, default: List[int], text: str) -> dict:
    return dict(name=name, kind="set", default=default, text=text)


def seeds_for(d: int) -> List[dict]:
    if not 1 <= d <= MAX_D:
        raise TreeError(f"the playground covers diameters 1 to {MAX_D}")
    k = (d + 1) // 2
    out = [_entry(f"S_{d}", f"S_{{{d}}}", "S_d", d,
                  [_p_int("alpha", 0, "α"), _p_int("beta", 2 ** k, "β (δ_i = (β − α)/2^i; the spectrum is integral when 2^(k−1) divides β − α)")],
                  "StrongRealization on Λ₁^(k)(α, β)" + (", then a regular 1-ABD" if d % 2 == 0 else ""))]
    if d == 6:
        for i in range(1, 7):
            alias = " (the tree S_6)" if i == 6 else ""
            out.append(_entry(f"S6_{i}", f"S_6^{{({i})}}", "diameter 6", 6,
                              [_p_set("Lambda", TABLE_D7[(i, i)][0], f"Λ = {{λ₀ < … < λ₆}} for RootedSeedRealization({i}, Λ)")],
                              f"RootedSeedRealization({i}, Λ) on R_{i}, then a regular 1-ABD of its deepest branch (derived from {labels.chapter('chap:diminimal')}, verified)" + alias))
    if d >= 7 and d % 2 == 1:
        kk = (d - 1) // 2
        for i in range(1, 7):
            for j in range(i, 7):
                row = TABLE_D7[(i, j)]
                alias = " (the tree S_7)" if (d == 7 and i == j == 6) else ""
                out.append(_entry(f"T_{i}_{j}", f"S^{{({i},{j})}}_{{{d}}}", "towers over R_i, R_j", d,
                                  [_p_set("Lambda", row[0], f"Λ for R_{i}"), _p_int("lambda7", row[1], "λ₇ (Λ′ = {λ₁, …, λ₇} for R_" + str(j) + ")")],
                                  ("R_i ⊙ R_j by RootedSeedRealization and φ" if d == 7 else f"towers R̂_{i}, R̂_{j} of depth {kk} by TowerChain, composed by φ") + alias))
        for b in range(4, kk):
            out.append(_entry(f"B_{b}", f"S^{{[{b}]}}_{{{d}}}", "towers over S_d", d,
                              [_p_int("alpha", 0, "α"), _p_int("beta", 2 ** kk, "β")],
                              f"towers B̂_{b} of depth {kk} over (S_{2 * b - 3}, S_{2 * b - 1}) by TowerChain, composed by φ"))
    if d >= 8 and d % 2 == 0:
        kk = (d - 2) // 2
        for i in range(1, 7):
            for j in range(1, 7):
                lo, hi = min(i, j), max(i, j)
                row = TABLE_D7[(lo, hi)]
                alias = " (the tree S_8)" if (d == 8 and i == j == 6) else ""
                out.append(_entry(f"T_{i}_{j}", f"S^{{({i},{j})}}_{{{d}}}", "towers over R_i, R_j", d,
                                  [_p_set("Lambda", row[0], f"Λ for R_{lo}"), _p_int("lambda7", row[1], "λ₇")],
                                  f"R̂_{i} ⊙ (R̂_{j}, R̂_{j}): the odd brick and a regular 1-ABD of the tower R̂_{j}" + alias))
        for b in range(4, kk):
            out.append(_entry(f"B_{b}", f"S^{{[{b}]}}_{{{d}}}", "towers over S_d", d,
                              [_p_int("alpha", 0, "α"), _p_int("beta", 2 ** kk, "β")],
                              f"B̂_{b} ⊙ (B̂_{b}, B̂_{b})"))
    return out


MAX_PARAM = 10 ** 15


def check_seed(sid: str, d: int) -> None:
    """The seed must be one of the list of its diameter: nothing else is ever built."""
    if not isinstance(d, int) or not 1 <= d <= MAX_D:
        raise TreeError(f"the playground covers diameters 1 to {MAX_D}")
    if sid not in _seed_ids(d):
        raise TreeError(f"{sid} is not a seed of diameter {d} in the playground")


@lru_cache(maxsize=MAX_D)
def _seed_ids(d: int) -> frozenset:
    return frozenset(e["id"] for e in seeds_for(d))


def _int(v, name: str) -> int:
    try:
        x = int(v)
    except (TypeError, ValueError) as e:
        raise TreeError(f"{name} must be an integer") from e
    if isinstance(v, float) and v != x:
        raise TreeError(f"{name} must be an integer")
    if abs(x) > MAX_PARAM:
        raise TreeError(f"{name} is limited to |{name}| ≤ 10^15 in this version")
    return x


def check_params(params: Optional[dict]) -> dict:
    """alpha, beta and lambda7 are integers, Lambda is a list of seven integers, all of absolute value ≤ 10^15."""
    out = {}
    for k, v in (params or {}).items():
        if k in ("alpha", "beta", "lambda7"):
            out[k] = _int(v, k)
        elif k == "Lambda":
            if not isinstance(v, list) or len(v) != 7:
                raise TreeError("Λ is a list of seven integers")
            out[k] = [_int(x, "Λ") for x in v]
    return out


def build(sid: str, d: int, params: Optional[dict] = None):
    """Returns (Brick or None, info)."""
    params = params or {}
    if sid.startswith("S_"):
        k = (d + 1) // 2
        alpha = int(params.get("alpha", 0))
        beta = int(params.get("beta", alpha + 2 ** k))
        if beta <= alpha:
            return None, dict(fail="β must be larger than α")
        b, node = realize_S_d(d, alpha, beta)
        info = dict(method=b.method if b else "StrongRealization", fail=node.fail if not node.ok else "")
        return b, info
    if sid.startswith("S6_"):
        i = int(sid[3:])
        Lam = params.get("Lambda") or TABLE_D7[(i, i)][0]
        b, info = seed6_brick(i, (Lam, 0))
        if b is None:
            info["conditions"] = arm_conditions(i, Lam) if len(Lam) == 7 else []
        return b, info
    if sid.startswith("T_"):
        _, i, j = sid.split("_")
        i, j = int(i), int(j)
        even = d % 2 == 0
        k = (d - 2) // 2 if even else (d - 1) // 2
        lo, hi = min(i, j), max(i, j)
        row = TABLE_D7[(lo, hi)]
        Lam = params.get("Lambda") or row[0]
        l7 = int(params.get("lambda7", row[1]))
        b, info = tower_seed_brick("R", i, j, k, even, (Lam, l7))
        if b is None and len(Lam) == 7:
            Lp = sorted(int(x) for x in Lam)[1:] + [l7]
            info["conditions"] = dict(first=arm_conditions(lo, Lam), second=arm_conditions(hi, Lp))
        return b, info
    if sid.startswith("B_"):
        bb = int(sid[2:])
        even = d % 2 == 0
        k = (d - 2) // 2 if even else (d - 1) // 2
        alpha = int(params.get("alpha", 0))
        beta = int(params.get("beta", alpha + 2 ** k))
        return tower_seed_brick("B", bb, None, k, even, alpha=alpha, beta=beta)
    raise TreeError(f"unknown seed id {sid}")


@lru_cache(maxsize=256)
def default_tree(sid: str, d: int) -> Tuple[Tree, List[int]]:
    b, info = build(sid, d, None)
    if b is None:
        raise TreeError(f"the default construction of {sid} failed: {info.get('fail')}")
    t = b.X.tree()
    roots = [0] + list(b.other_roots)
    if d % 2 == 1 and not b.other_roots:
        roots = t.main_roots()
    return t, roots


def _apply_ops(t: Tree, ops: List[List[int]], M: Optional[Matrix] = None):
    """Applies the duplications [y, u] (duplicate the branch at y rooted at u) in order; checks the diameter."""
    d = t.diameter()
    new_edges: List[Tuple[int, int]] = []
    if len(ops) > MAX_OPS:
        raise TreeError(f"at most {MAX_OPS} duplications")
    for step, op in enumerate(ops):
        if len(op) != 2:
            raise TreeError(f"duplication {step + 1}: give a pair [y, u]")
        y, u = op
        if not (0 <= y < t.n and 0 <= u < t.n) or u not in t.adj[y]:
            raise TreeError(f"duplication {step + 1}: {u} is not a neighbour of {y}")
        Mt = M if M is not None else Matrix({v: F(0) for v in range(t.n)}, {e: F(1) for e in t.edges()})
        t2, M2, nv, ne = regular_abd(t, Mt, y, u, 1)
        if t2.diameter() != d:
            raise TreeError(f"duplication {step + 1} would change the diameter")
        new_edges += [e for e in ne if y in e]
        t = t2
        if t.n > MAX_N:
            raise TreeError(f"duplication {step + 1}: the tree would have more than {MAX_N} vertices")
        if M is not None:
            M = M2
    return t, M, new_edges


def duplicable(t: Tree, root: int) -> Dict[int, int]:
    """For every vertex u other than the root whose branch (seen from the root) can be duplicated at its
    parent without changing the diameter: u -> parent."""
    d = t.diameter()
    par = t.parents(root)
    out = {}
    for u in range(t.n):
        y = par[u]
        if y is None:
            continue
        Mt = Matrix({v: F(0) for v in range(t.n)}, {e: F(1) for e in t.edges()})
        t2, _, _, _ = regular_abd(t, Mt, y, u, 1)
        if t2.diameter() == d:
            out[u] = y
    return out


def state(sid: str, d: int, ops: List[List[int]]) -> dict:
    check_seed(sid, d)
    t0, roots = default_tree(sid, d)
    t, _, new_edges = _apply_ops(t0, ops)
    dup = duplicable(t, 0)
    info = tree_info(t, dashed=new_edges, roots=roots if len(roots) <= 2 else None)
    return dict(tree=info, root=0, main_roots=roots, duplicable={str(u): y for u, y in dup.items()}, n=t.n, d=t.diameter(),
                seed_n=t0.n, ops=ops)


def rt_from(t: Tree, M: Matrix, root: int = 0) -> Tuple[RT, Dict[int, int]]:
    """The rooted tree of (t, M) rooted at `root`, and the map RT id -> tree id."""
    par = t.parents(root)
    order = [root]
    i = 0
    ch = t.children(root)
    while i < len(order):
        order.extend(sorted(ch[order[i]]))
        i += 1
    X = RT()
    new: Dict[int, int] = {}
    for v in order:
        if par[v] is None:
            new[v] = X.add(M.diag[v])
        else:
            new[v] = X.add(M.diag[v], new[par[v]], M.w(v, par[v]))
    return X, {nv: ov for ov, nv in new.items()}


def spectrum_json(ver) -> List[dict]:
    return [dict(value=fstr(x), multiplicity=ver.mult[x]) for x in ver.dspec]


def generate(sid: str, d: int, params: Optional[dict], ops: List[List[int]]) -> dict:
    R = labels.ref
    check_seed(sid, d)
    params = check_params(params)
    b, info = build(sid, d, params)
    if b is None:
        return dict(ok=False, reason=info.get("fail") or "the construction failed", conditions=info.get("conditions"), info=_clean(info))
    seed_tree = b.X.tree()
    t0, roots = default_tree(sid, d)
    if seed_tree.canonical() != t0.canonical() or seed_tree.edges() != t0.edges():
        return dict(ok=False, reason="internal: the construction with these parameters produced a different labelling of the seed")
    ver_seed = b.verification
    M_seed = b.X.matrix()
    t, M, new_edges = _apply_ops(seed_tree, ops, M_seed)
    X, back = rt_from(t, M, 0)
    ver_T = verify(X, b.candidates, d, other_roots=[i for i, ov in back.items() if ov in set(b.other_roots)])
    out = dict(ok=bool(ver_seed and ver_seed.is_brick and ver_T.ok and ver_T.q == d + 1),
               method=b.method, prescribed=[fstr(x) for x in b.prescribed],
               seed=dict(tree=tree_info(seed_tree, roots=roots), matrix=M_seed.to_json(), root=0, other_main_roots=b.other_roots,
                         spectrum=spectrum_json(ver_seed), latent=[fstr(x) for x in ver_seed.latent],
                         confined=[fstr(x) for x in ver_seed.confined],
                         witnesses={fstr(k): v for k, v in ver_seed.witnesses.items() if k in ver_seed.latent},
                         is_brick=ver_seed.is_brick, reason=ver_seed.reason),
               tree=dict(tree=tree_info(t, dashed=new_edges, roots=roots), matrix=M.to_json(), root=0, n=t.n,
                         spectrum=spectrum_json(ver_T) if ver_T.ok else None, q=ver_T.q if ver_T.ok else None,
                         check=ver_T.reason if not ver_T.ok else f"q(M) = {ver_T.q} = d + 1, verified at the candidate values by Diagonalize."),
               duplications=len(ops),
               theorems=[R("thm:brick-diminimal"), R("def:abd")] + _theorems_for(sid),
               references=_refs_for(sid), info=_clean(info))
    return out


def _theorems_for(sid: str) -> List[str]:
    R = labels.ref
    if sid.startswith("S_"):
        return [R("thm:general_spectra"), R("prop:explicit-family"), R("prop:algorithms")]
    if sid.startswith("S6_"):
        return [R("lem:six-arms"), R("lem:chain-block")]
    return [R("prop:tower-bricks"), R("def:tower"), R("lem:six-arms"), R("many_seeds")]


def _refs_for(sid: str) -> List[str]:
    # the constructions themselves are those of the thesis, cited by their statements
    if sid.startswith("S_"):
        return ["allem2023diminimal", "JT2011"]
    if sid.startswith("S6_"):
        return ["JSdiminimal", "JS08"]
    return ["JS08"]


def _clean(info: dict) -> dict:
    return {k: v for k, v in (info or {}).items() if k not in ("levels", "levels_twin")}
