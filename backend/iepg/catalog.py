"""The catalog: seeds of diameter at most 7, rooted seeds of depth at most 3, their status and certificates,
counts, the gallery, the open questions and the notation table. Built once at start-up from

  * tese/Tese_fable_51/tikzfigures/seeds_seis.tex   the twelve seeds of diameter 6 in the thesis numbering
  * data/bricks_d7_raw.json                          the 21 bricks of the diminimal seeds of diameter 7
  * data/unfoldings_d6_raw.json                       the non-diminimal unfoldings of S_6^(7), S_6^(8), S_6^(9)
                                                     and the tree of Barioli and Fallat (thesis figures)
  * the matrices M_S of Figure fig:C6-weights, written out in _c6_matrix, and the bricks of S_d for 8 <= d <= 15,
    computed by RealizeTree

Every certificate stored here is re-verified with the exact engine (latent_report) when the catalog is built.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from fractions import Fraction
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from . import labels
from .diag import Matrix, fstr, latent_report, num_json
from .fold import fold_to_seed, regular_abd, unfold_realization
from .realize import realize_S_d
from .trees import GALLERY, Layout, Tree, TreeError, S_d_tree, tree_info

from .config import THESIS

DATA = Path(__file__).resolve().parents[1] / "data"

# ------------------------------------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------------------------------------

def rooted_iso(t1: Tree, a: int, pa: Optional[int], t2: Tree, b: int, pb: Optional[int]) -> Dict[int, int]:
    """Root-preserving isomorphism from the subtree of t1 at a to the subtree of t2 at b (they must be isomorphic)."""
    phi = {a: b}
    ka = sorted([w for w in t1.adj[a] if w != pa], key=lambda w: t1.rooted_canon(w, a))
    kb = sorted([w for w in t2.adj[b] if w != pb], key=lambda w: t2.rooted_canon(w, b))
    if len(ka) != len(kb):
        raise TreeError("not isomorphic")
    for wa, wb in zip(ka, kb):
        if t1.rooted_canon(wa, a) != t2.rooted_canon(wb, b):
            raise TreeError("not isomorphic")
        phi.update(rooted_iso(t1, wa, a, t2, wb, b))
    return phi


def transport(M: Matrix, phi: Dict[int, int]) -> Matrix:
    return Matrix({phi[v]: q for v, q in M.diag.items()},
                  {(min(phi[u], phi[v]), max(phi[u], phi[v])): q for (u, v), q in M.w2.items()})


def tree_iso(t1: Tree, t2: Tree) -> Optional[Dict[int, int]]:
    """Isomorphism between two unrooted trees through their centers, or None."""
    k1, c1 = t1.center()
    k2, c2 = t2.center()
    if k1 != k2:
        return None
    if k1 == "vertex":
        try:
            return rooted_iso(t1, c1[0], None, t2, c2[0], None)
        except TreeError:
            return None
    a, b = c1
    for (c, d) in ((c2[0], c2[1]), (c2[1], c2[0])):
        try:
            phi = rooted_iso(t1, a, b, t2, c, d)
            phi.update(rooted_iso(t1, b, a, t2, d, c))
            return phi
        except TreeError:
            continue
    return None


def matrix_from_raw(b: dict) -> Tuple[Tree, Matrix]:
    n = b["n"]
    t = Tree.from_edges(n, [(v, p) for v, p in enumerate(b["parent"]) if p is not None])
    M = Matrix({v: Fraction(b["diag"][v]) for v in range(n)},
               {(min(int(a), int(c)), max(int(a), int(c))): Fraction(q) for k, q in b["w2"].items() for a, c in [k.split("-")]})
    return t, M


# ------------------------------------------------------------------------------------------------
# rooted seeds of small depth (enumeration) and the twelve seeds of diameter 6 (thesis figure)
# ------------------------------------------------------------------------------------------------

@lru_cache(maxsize=None)
def rooted_seeds_of_depth(k: int) -> List[str]:
    """Canonical strings of all rooted seeds of depth k: a nonempty set of rooted seeds of depth k-1 (the
    deepest branches) together with an arbitrary set of rooted seeds of depth < k-1 (Chapter 6)."""
    if k == 0:
        return ["()"]
    from itertools import combinations
    deep = rooted_seeds_of_depth(k - 1)
    shallow = [s for j in range(k - 1) for s in rooted_seeds_of_depth(j)]
    out = []
    for r in range(1, len(deep) + 1):
        for D in combinations(deep, r):
            for r2 in range(0, len(shallow) + 1):
                for S in combinations(shallow, r2):
                    out.append("(" + "".join(sorted(D + S)) + ")")
    return sorted(set(out))


def seed_from_rooted(canon: str) -> Tree:
    """The seed of even diameter 2k that corresponds to a rooted seed of depth k: if the deepest branch is
    unique, duplicate it; otherwise the rooted seed is the seed itself (Proposition prop:even-count)."""
    from .trees import parse_parentheses
    t = parse_parentheses(canon)
    root = 0
    kids = list(t.adj[root])
    dmax = max((t.rooted_depth(w, root) for w in kids), default=0)
    deep = [w for w in kids if t.rooted_depth(w, root) == dmax]
    if len(deep) == 1:
        M = Matrix({v: Fraction(0) for v in range(t.n)}, {e: Fraction(1) for e in t.edges()})
        t2, _, _, _ = regular_abd(t, M, root, deep[0], 1)
        return t2
    return t


def load_thesis_seeds6() -> Dict[int, Tree]:
    """The twelve seeds of diameter 6 in the numbering of the thesis (S_6^(i) <-> R_i for i <= 6)."""
    raw = (THESIS / "tikzfigures" / "seeds_seis.tex").read_text().split("\n")
    s = "\n".join(l for l in raw if not l.strip().startswith("%"))
    parts = re.split(r"\\newcommand\{\\(\w+)\}", s)
    macros = {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}
    old = {"um": 1, "sete": 2, "quatro": 3, "dois": 4, "oito": 5, "cinco": 6, "tres": 7, "nove": 8, "seis": 9, "dez": 10, "onze": 11, "doze": 12}
    renum = {2: 1, 5: 2, 6: 3, 3: 4, 4: 5, 1: 6}
    out = {}
    for name, body in macros.items():
        edges = re.findall(r"\\draw\[[^\]]*\]\s*\((\w+)\)\s*--\s*\((\w+)\)", body)
        labs = {}
        for a, b in edges:
            for x in (a, b):
                labs.setdefault(x, len(labs))
        t = Tree.from_edges(len(labs), [(labs[a], labs[b]) for a, b in edges])
        out[renum.get(old[name], old[name])] = t
    assert len(out) == 12
    return out


# ------------------------------------------------------------------------------------------------
# the catalog
# ------------------------------------------------------------------------------------------------

class Catalog:
    def __init__(self):
        self.seeds: Dict[str, dict] = {}          # name -> entry
        self.by_canonical: Dict[str, str] = {}    # canonical -> name
        self.rooted: Dict[str, dict] = {}         # "R1".. -> entry
        self.rooted_by_canon: Dict[str, str] = {}
        self.certified_bad: Dict[str, dict] = {}  # canonical of certified non-diminimal trees -> info
        self.log: List[str] = []
        self._build()

    # ----- construction -------------------------------------------------------------------------
    @staticmethod
    def _defect_reason(k: int) -> str:
        """Why S_6^(k), k >= 7, is defective, in a few words."""
        if k in (7, 8, 9):
            return labels.ref("thm:three-defective")
        if k == 11:
            return f"the tree of Barioli and Fallat, {labels.ref('fig:intro-bf')}"
        return "Johnson and Saiago, 2016, Appendix 2"

    def _c6_matrix(self, i: int, t6: Tree) -> Optional[dict]:
        """The matrix M_S of Figure fig:C6-weights for S = S_6^(i), i in {7, 8, 9}, on the catalog tree of S_6^(i).
        Proposition prop:C6-Z: Z(M_S) has eight elements and 1 is its only latent value. Checked here exactly."""
        R = labels.ref
        # v = 0, the branches B_1 = r_1 c_1 l_1 and B_2 (r_2 with the leaf z and the path c_2 l_3), common to the three seeds
        diag = {0: {7: 0, 8: 2, 9: -1}[i], 1: 0, 2: 0, 3: 0, 4: -1, 5: -1, 6: 1, 7: 0}
        w2 = {(0, 1): {7: 7, 8: 5, 9: 8}[i], (1, 2): 8, (2, 3): 1, (0, 4): 1, (4, 5): 1, (4, 6): 5, (6, 7): 2}
        if i == 7:
            diag.update({8: 0, 9: -2, 10: -1})
            w2.update({(0, 8): 1, (0, 9): 12, (9, 10): 2})
        elif i == 8:
            diag.update({8: 0})
            w2.update({(0, 8): 3})
        else:
            diag.update({8: -2, 9: -1})
            w2.update({(0, 8): 18, (8, 9): 2})
        tf = Tree.from_edges(len(diag), list(w2))
        M = Matrix({v: Fraction(q) for v, q in diag.items()}, {e: Fraction(q) for e, q in w2.items()})
        phi = tree_iso(tf, t6)
        if phi is None:
            self.log.append(f"WARNING: the tree of Figure fig:C6-weights for S6_{i} is not the catalog seed")
            return None
        M6 = transport(M, phi)
        v = phi[0]
        rep = latent_report(t6, v, M6)
        if len(rep.Z) != 8 or [str(x) for x in rep.latent] != ["1"]:
            self.log.append(f"WARNING: the matrix M_S of S6_{i} does not satisfy Proposition prop:C6-Z ({len(rep.Z)} temporary zeros)")
            return None
        return dict(matrix=M6.to_json(), root=v, Z=[num_json(x) for x in rep.Z], latent=[num_json(x) for x in rep.latent],
                    thesis=[R("fig:C6-weights"), R("prop:C6-Z"), R("q8thm")])

    def _add_seed(self, name: str, label: str, t: Tree, status: str, certificate: dict, history: str,
                  references: List[str], roots: Optional[List[int]] = None, **extra):
        info = tree_info(t, roots=roots)
        entry = dict(name=name, label=label, canonical=info["canonical"], status=status, tree=info,
                     certificate=certificate, history=history, references=references, diameter=t.diameter(), **extra)
        self.seeds[name] = entry
        self.by_canonical[info["canonical"]] = name
        return entry

    def _build(self):
        R = labels.ref
        # --- seeds of diameter <= 5 (all diminimal, Johnson and Saiago) ---
        small: List[Tuple[int, Tree]] = []
        for k in (1, 2):
            for c in rooted_seeds_of_depth(k):
                small.append((2 * k, seed_from_rooted(c)))
        from itertools import combinations_with_replacement
        for k in (0, 1, 2):
            rs = rooted_seeds_of_depth(k)
            for a, b in combinations_with_replacement(rs, 2):
                from .trees import parse_parentheses
                ta, tb = parse_parentheses(a), parse_parentheses(b)
                edges = ta.edges() + [(u + ta.n, v + ta.n) for u, v in tb.edges()] + [(0, ta.n)]
                small.append((2 * k + 1, Tree.from_edges(ta.n + tb.n, edges)))
        counters: Dict[int, int] = defaultdict(int)
        for d, t in sorted(small, key=lambda x: (x[0], x[1].n, x[1].canonical())):
            counters[d] += 1
            i = counters[d]
            name = f"S{d}_{i}"
            cert = dict(kind="literature", references=["JS08", "JSdiminimal"], thesis=[R("def:Sd"), R("def_seeds"), R("sec:new-seeds-bricks")],
                        summary=(f"Every tree of diameter at most 5 is diminimal (Johnson and Saiago, 2008 and 2016, by branch duplication). "
                                 f"This seed is one of the seeds of {R('def:Sd')} and {R('def_seeds')}, and the thesis also gives a brick of it "
                                 f"({R('sec:new-seeds-bricks')}); this version of the site does not compute that brick."))
            self._add_seed(name, _small_label(t, d) or f"S_{d}^{{({i})}}", t, "diminimal", cert,
                           "Johnson and Saiago proved that every tree of diameter at most 5 is diminimal.", ["JS08", "JSdiminimal"])
        # --- diameter 6: the twelve seeds, rooted seeds of depth 3 ---
        seeds6 = load_thesis_seeds6()
        depth3 = set(rooted_seeds_of_depth(3))
        bricks = json.load(open(DATA / "bricks_d7_raw.json"))["bricks"]
        unf = json.load(open(DATA / "unfoldings_d6_raw.json"))
        self.rooted_trees: Dict[int, Tuple[Tree, int]] = {}
        for i in range(1, 13):
            t = seeds6[i]
            c = t.main_roots()[0]
            kids = list(t.adj[c])
            deep = sorted([w for w in kids if t.rooted_depth(w, c) == 2], key=lambda w: t.rooted_canon(w, c))  # branches of depth 3 (their roots are at distance 1)
            deleted: List[int] = []
            if len(deep) == 2 and t.rooted_canon(deep[0], c) == t.rooted_canon(deep[1], c):
                deleted = sorted(t.subtree(deep[1], c))
            if deleted:
                rt, relabel = t.remove_vertices(deleted)
                rroot = relabel[c]
            else:
                rt, rroot = t, c
            rcanon = rt.rooted_canon(rroot)
            assert rcanon in depth3, f"R_{i} is not a rooted seed of depth 3"
            self.rooted_trees[i] = (rt, rroot)
            good = i <= 6
            self.rooted[f"R{i}"] = dict(name=f"R{i}", label=f"R_{{{i}}}", canonical=rcanon, good=good, seed_name=f"S6_{i}",
                                        tree=tree_info(t), root=c, deleted_branch=deleted,
                                        rooted_tree=tree_info(rt, roots=[rroot]), rooted_root=rroot)
            self.rooted_by_canon[rcanon] = f"R{i}"
        # certificates of the six defective seeds
        bad_unfoldings = {}
        for key, dst in (("S6_7", 7), ("S6_8", 8), ("S6_9", 9), ("BF", 11)):
            raw = unf[key]
            tu = Tree.from_edges(raw["n"], [tuple(e) for e in raw["edges"]])
            st = fold_to_seed(tu)
            seed_c = st[-1].tree.canonical()
            if seed_c != seeds6[dst].canonical():
                self.log.append(f"WARNING: the unfolding {key} folds to a seed different from S6_{dst}")
            bad_unfoldings[dst] = (key, tu)
        for i in range(1, 13):
            t = seeds6[i]
            name, label = f"S6_{i}", f"S_6^{{({i})}}"
            if i <= 6:
                cert, hist = self._derived_brick_d6(i, t, bricks)
                self._add_seed(name, label, t, "diminimal", cert, hist, cert["references"], rooted_seed=f"R{i}")
            elif i in (7, 8, 9):
                key, tu = bad_unfoldings[i]
                thm = "thm:three-defective"
                info_u = tree_info(tu)
                cert = dict(kind="non_diminimal_unfolding", references=["allem2026minimum", "JSdiminimal"],
                            thesis=[R(thm), R("thm:d6-classification")],
                            summary=(f"The tree drawn here, an unfolding of S_6^({i}) with {tu.n} vertices and diameter 6, has no matrix with seven distinct "
                                     f"eigenvalues: by counting the zeros produced by Diagonalize for a putative realization, {R(thm)} shows q(T) ≥ 8. "
                                     f"Hence the seed is defective. Johnson and Saiago had stated that this seed is diminimal."),
                            unfolding=dict(tree=info_u, q_lower=8, reason=f"{R(thm)}: no matrix in S(T) has seven distinct eigenvalues."))
                self.certified_bad[info_u["canonical"]] = dict(q_lower=8, source=f"{R(thm)} of the thesis", references=["allem2026minimum"], thesis=[R(thm)], seed=name)
                hist = ("Stated to be diminimal by Johnson and Saiago (2016, Section 4 and Appendix 1) and shown to be defective in this thesis. "
                        "Its unfoldings still satisfy q(T) ≤ 8 by the construction behind C(6) = 8.")
                self._add_seed(name, label, t, "defective", cert, hist, cert["references"], rooted_seed=f"R{i}", q8_matrix=self._c6_matrix(i, t))
            elif i == 11:
                key, tu = bad_unfoldings[11]
                info_u = tree_info(tu)
                cert = dict(kind="non_diminimal_unfolding", references=["barioli2004two"], thesis=[R("fig:intro-bf")],
                            summary="The tree of Barioli and Fallat (sixteen vertices, diameter 6) is an unfolding of this seed and satisfies q(T) = 8: no multiplicity list with seven parts is compatible with its Parter vertices.",
                            unfolding=dict(tree=info_u, q_lower=8, reason="Barioli and Fallat (2004): q(T) = 8 = d(T) + 2."))
                self.certified_bad[info_u["canonical"]] = dict(q_lower=8, source="Barioli and Fallat (2004)", references=["barioli2004two"], thesis=[], seed=name)
                self._add_seed(name, label, t, "defective", cert, "Defective since 2004: its family contains the first counterexample to the conjecture of Leal-Duarte and Johnson.",
                               ["barioli2004two"], rooted_seed=f"R{i}")
            else:
                cert = dict(kind="literature", references=["JSdiminimal", "JohnsonSaiago2018"], thesis=[R("thm:d6-classification")],
                            summary="Johnson and Saiago (2016, Theorem 4 and Appendix 2) exhibited a non-diminimal unfolding of this seed.")
                self._add_seed(name, label, t, "defective", cert, "Known to be defective by an example of Johnson and Saiago (2016).", cert["references"], rooted_seed=f"R{i}")
        # --- diameter 7: the 78 pairs ---
        brick_by_pair: Dict[Tuple[int, int], dict] = {}
        for b in bricks:
            a, c = b["R"]
            brick_by_pair[(min(a, c), max(a, c))] = b
        for i in range(1, 13):
            for j in range(i, 13):
                name, label = f"R{i}xR{j}", f"R_{{{i}}} \\odot R_{{{j}}}"
                if i <= 6 and j <= 6:
                    b = brick_by_pair[(i, j)]
                    t, M = matrix_from_raw(b)
                    rep = latent_report(t, b["root"], M)
                    if not rep.is_brick:
                        self.log.append(f"WARNING: stored brick for {name} failed verification: {rep.reason}")
                    r_side = b["R"][0]
                    roots = [b["root"], b["other_main_root"]] if r_side == i else [b["other_main_root"], b["root"]]
                    # S_7, S'_7 and S''_7 were proved diminimal in the first paper; the brick is the construction of Chapter 6
                    cert = dict(kind="brick", references=["allem2023diminimal"] if (i, j) in ((6, 6), (1, 1), (1, 6)) else [],
                                thesis=[R("prop:d7"), R("thm:brick-diminimal"), R("many_seeds")],
                                summary=(f"A brick of R_{i} ⊙ R_{j}: a matrix with q(M) = 8 = d + 1 whose only latent value is confined to the other main root, "
                                         f"built by RootedSeedRealization on the two rooted seeds and composed along the main edge ({labels.chapter("chap:diminimal")}, prescribed integral spectrum). "
                                         f"By {R('thm:brick-diminimal')}, every unfolding inherits a realization with the same eight distinct eigenvalues, so the whole family is diminimal. "
                                         f"Verified exactly by this application."),
                                brick=dict(matrix=M.to_json(), root=b["root"], other_main_root=b["other_main_root"],
                                           dspec=[num_json(r) for r in rep.dspec], latent=[num_json(r) for r in rep.latent], confined=[num_json(r) for r in rep.confined],
                                           prescribed=b["Lambda"]))
                    self._add_seed(name, label, t, "diminimal", cert,
                                   "One of the 21 diminimal seeds of diameter 7 (this thesis). Three of them, S_7, S'_7 and S''_7, were known from Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan (2023); the other eighteen are new.",
                                   cert["references"], roots=roots, pair=[f"R{i}", f"R{j}"])
                else:
                    ta, ra = self.rooted_trees[i]
                    tb, rb = self.rooted_trees[j]
                    edges = ta.edges() + [(u + ta.n, v + ta.n) for u, v in tb.edges()] + [(ra, rb + ta.n)]
                    t = Tree.from_edges(ta.n + tb.n, edges)
                    bad = [k for k in (i, j) if k > 6]
                    k0 = bad[0]
                    src = self.seeds[f"S6_{k0}"]
                    cert = dict(kind="propagation", references=src["certificate"]["references"],
                                thesis=[R("cor:odd-seed"), R("thm:odd-prop")] + src["certificate"]["thesis"],
                                summary=(f"The rooted seed R_{k0} is defective, because D(R_{k0}) = S_6^({k0}) is a defective seed ({R('def:bad-arm')}). "
                                         f"By {R('cor:odd-seed')}, which follows from the odd propagation theorem ({R('thm:odd-prop')}), "
                                         f"a seed of diameter 7 one of whose two rooted seeds is defective is defective."),
                                chain=dict(steps=[f"S_6^({k0}) is defective ({self._defect_reason(k0)}).",
                                                  f"Hence R_{k0} is defective, since D(R_{k0}) = S_6^({k0}) ({R('def:bad-arm')}).",
                                                  f"By {R('cor:odd-seed')}, R_{i} ⊙ R_{j} is defective."]))
                    self._add_seed(name, label, t, "defective", cert,
                                   f"One of the 57 defective seeds of diameter 7 ({R('thm:d7-classification')}).",
                                   cert["references"], roots=[ra, rb + ta.n], pair=[f"R{i}", f"R{j}"])
        # --- S_d for larger d, with the brick computed by RealizeTree (lines 2-5) ---
        for d in range(8, 16):
            t, r, dashed = S_d_tree(d)
            name = f"S_{d}"
            k = (d + 1) // 2
            brick, _ = realize_S_d(d)
            phi = tree_iso(brick.X.tree(), t) if brick else None
            if phi is None:
                self.log.append(f"WARNING: RealizeTree gave no brick on S_{d}")
                continue
            M = transport(brick.X.matrix(), phi)
            c = t.main_roots()[0]
            rep = latent_report(t, c, M)
            if not rep.is_brick:
                self.log.append(f"WARNING: the brick of S_{d} failed verification: {rep.reason}")
                continue
            how = f"StrongRealization on the explicit admissible set Λ_1^({k}) ({R('prop:explicit-family')})" + (", followed by a regular 1-ABD" if d % 2 == 0 else "")
            cert = dict(kind="brick", references=["allem2023diminimal"], thesis=[R("prop:algorithms"), R("cor:odd-diminimal"), R("thm:brick-diminimal")],
                        summary=(f"A brick of S_{d}, computed by RealizeTree ({R('prop:algorithms')}): {how}. "
                                 f"By {R('thm:brick-diminimal')}, every unfolding inherits a realization with the same {d + 1} distinct eigenvalues. Verified exactly by this application."),
                        brick=dict(matrix=M.to_json(), root=c, dspec=[num_json(x) for x in rep.dspec], latent=[num_json(x) for x in rep.latent],
                                   confined=[num_json(x) for x in rep.confined], prescribed=[fstr(x) for x in brick.prescribed]))
            info = tree_info(t, dashed=dashed)
            entry = dict(name=name, label=f"S_{{{d}}}", canonical=info["canonical"], status="diminimal", tree=info, certificate=cert,
                         history="The simplest infinite family of diminimal seeds, from Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan (2023).",
                         references=cert["references"], diameter=d)
            self.seeds[name] = entry
            self.by_canonical[info["canonical"]] = name
        self.log.append(f"catalog built: {len(self.seeds)} seeds, {len(self.rooted)} rooted seeds")

    def _derived_brick_d6(self, i: int, t6: Tree, bricks: List[dict]) -> Tuple[dict, str]:
        """A brick of S_6^(i) derived from the arm realization of R_i inside a brick of diameter 7:
        restrict the brick to the rooted seed R_i and, when S_6^(i) is R_i with its deepest branch duplicated,
        apply a regular 1-ABD. The result is verified exactly; if it is not a brick, the certificate is the
        statement of Johnson and Saiago."""
        R = labels.ref
        for b in bricks:
            if b["R"][0] != i:
                continue
            t, M = matrix_from_raw(b)
            r, u = b["root"], b["other_main_root"]
            arm = sorted(t.subtree(r, u))
            keep = set(arm)
            sub, relabel = t.remove_vertices([v for v in range(t.n) if v not in keep])
            Ms = Matrix({relabel[v]: q for v, q in M.diag.items() if v in keep},
                        {(min(relabel[a], relabel[c]), max(relabel[a], relabel[c])): q for (a, c), q in M.w2.items() if a in keep and c in keep})
            rr = relabel[r]
            rt, rroot = self.rooted_trees[i]
            try:
                phi = rooted_iso(sub, rr, None, rt, rroot, None)
            except TreeError:
                continue
            Mr = transport(Ms, phi)
            # S_6^(i) = rt with the deepest branch duplicated when that branch is unique
            kids = list(rt.adj[rroot])
            dmax = max(rt.rooted_depth(w, rroot) for w in kids)
            deep = [w for w in kids if rt.rooted_depth(w, rroot) == dmax]
            if len(deep) == 1:
                tcand, Mcand, _, _ = regular_abd(rt, Mr, rroot, deep[0], 1)
                how = f"restricting the brick of R_{i} ⊙ R_{b['R'][1]} to the rooted seed R_{i} and duplicating its deepest branch by a regular 1-ABD ({R('def:abd')})"
            else:
                tcand, Mcand = rt, Mr
                how = f"restricting the brick of R_{i} ⊙ R_{b['R'][1]} to the rooted seed R_{i}, which is the seed itself"
            phi2 = tree_iso(tcand, t6)
            if phi2 is None:
                self.log.append(f"WARNING: candidate brick tree for S6_{i} is not isomorphic to the catalog seed")
                continue
            M6 = transport(Mcand, phi2)
            c = t6.main_roots()[0]
            rep = latent_report(t6, c, M6)
            if rep.is_brick:
                cert = dict(kind="brick", references=["JSdiminimal"],
                            thesis=[R("thm:brick-diminimal"), R("def:abd"), R("thm:d6-classification")],
                            summary=(f"A brick of S_6^({i}): a matrix with q(M) = 7 = d + 1 and no latent value, obtained by {how}. "
                                     f"By {R('thm:brick-diminimal')} every unfolding inherits a realization with the same seven distinct eigenvalues. "
                                     f"Derived from the constructions of {labels.chapter('chap:diminimal')} and verified exactly by this application (the thesis credits the diminimality of the six seeds to Johnson and Saiago)."),
                            brick=dict(matrix=M6.to_json(), root=c, dspec=[num_json(x) for x in rep.dspec], latent=[], confined=[]))
                return cert, "Diminimal, as stated by Johnson and Saiago (2016); here with an explicit brick derived from the rooted seed realizations of " + labels.chapter("chap:diminimal") + "."
            self.log.append(f"note: derived matrix for S6_{i} from pair {b['R']} is not a brick ({rep.reason})")
        cert = dict(kind="literature", references=["JSdiminimal"], thesis=[labels.ref("thm:d6-classification")],
                    summary="Diminimal by Johnson and Saiago (2016). No brick from the constructions of this thesis is available for this seed yet.")
        return cert, "Diminimal, as stated by Johnson and Saiago (2016)."

    # ----- queries ---------------------------------------------------------------------------------
    def lookup(self, t: Tree) -> Optional[str]:
        return self.by_canonical.get(t.canonical())

    def seed_summaries(self, d: int) -> List[dict]:
        out = []
        for e in self.seeds.values():
            if e["diameter"] == d:
                out.append(dict(name=e["name"], label=e["label"], canonical=e["canonical"], status=e["status"], tree=e["tree"],
                                pair=e.get("pair"), rooted_seed=e.get("rooted_seed")))
        return out

    def rooted_seed_defective(self, t: Tree, root: int) -> Optional[List[str]]:
        """Chain of reasons if the rooted seed (t rooted at root) is certified defective, else None.
        Depth 3: one of R_7..R_12. Depth j >= 4: some branch of depth j-1 at the root is defective (lem:heredity)."""
        j = t.rooted_depth(root)
        c = t.rooted_canon(root)
        if j < 3:
            return None
        if j == 3:
            name = self.rooted_by_canon.get(c)
            if name and not self.rooted[name]["good"]:
                return [f"The rooted seed of depth 3 is {name.replace('R', 'R_')}, which is defective, since D({name.replace('R', 'R_')}) = S_6^({name[1:]}) is defective ({labels.ref('def:bad-arm')})."]
            return None
        for w in t.adj[root]:
            if t.rooted_depth(w, root) == j - 1:
                sub = t.subtree(w, root)
                st, relabel = t.remove_vertices([v for v in range(t.n) if v not in set(sub)])
                chain = self.rooted_seed_defective(st, relabel[w])
                if chain is not None:
                    return chain + [f"A branch of depth {j - 1} at the root is defective, so the rooted seed of depth {j} is defective ({labels.ref('lem:heredity')})."]
        return None

    def seed_defective_by_propagation(self, s: Tree) -> Optional[List[str]]:
        d = s.diameter()
        kind, c = s.center()
        if d < 6:
            return None
        if kind == "edge":
            a, b = c
            for (x, y) in ((a, b), (b, a)):
                sub = s.subtree(x, y)
                st, relabel = s.remove_vertices([v for v in range(s.n) if v not in set(sub)])
                chain = self.rooted_seed_defective(st, relabel[x])
                if chain is not None:
                    return chain + [f"One of the two rooted seeds of the seed of diameter {d} is defective, so the seed is defective ({labels.ref('cor:odd-seed')})."]
            return None
        r = c[0]
        k = d // 2
        for w in s.adj[r]:
            if s.rooted_depth(w, r) == k - 1:
                sub = s.subtree(w, r)
                st, relabel = s.remove_vertices([v for v in range(s.n) if v not in set(sub)])
                chain = self.rooted_seed_defective(st, relabel[w])
                if chain is not None:
                    if k >= 4:
                        return chain + [f"A standard branch of the seed of diameter {d} is a defective rooted seed, so the seed is defective ({labels.ref('cor:even-seed')})."]
        return None


_CAT: Catalog | None = None


def catalog() -> Catalog:
    global _CAT
    if _CAT is None:
        _CAT = Catalog()
    return _CAT


# ------------------------------------------------------------------------------------------------
# counts, questions, notation
# ------------------------------------------------------------------------------------------------

COUNTS = dict(
    E={"0": "1", "1": "1", "2": "2", "3": "12", "4": "65520"},
    s={"2": "1", "3": "1", "4": "2", "5": "3", "6": "12", "7": "78", "8": "65520", "9": "2146467960"},
)


def _small_label(t: Tree, d: int) -> Optional[str]:
    """The name in the thesis of a seed of diameter at most 5: S_d, S'_d or S''_d."""
    from .trees import S_seed, def_seeds_families
    can = t.canonical()
    if S_seed(d).to_tree()[0].canonical() == can:
        return f"S_{{{d}}}"
    for _name, tex, rooted in def_seeds_families(d):
        if rooted.to_tree()[0].canonical() == can:
            return f"{tex}_{{{d}}}"
    return None


def counts() -> dict:
    R = labels.ref
    return dict(COUNTS, bounds=[
        dict(d=6, p="1/2", source=f"{R('thm:d6-classification')} (exact)"), dict(d=7, p="21/78", source=f"{R('thm:d7-classification')} (exact)"),
        dict(d=8, p_upper="1008/65520", source=R("sec:d7class")), dict(d=9, p_upper="508536/2146467960", source=R("sec:d7class")),
        dict(d="→ ∞", p_limit="0", source=R("thm:almost-all"))])



def _tex_to_display(s: str) -> str:
    """Light cleaning of a LaTeX statement for KaTeX-in-text rendering: references become numbers."""
    s = re.sub(r"\\color\{[^}]*\}", "", s)
    s = re.sub(r"~?\\(?:ref|eqref)\{([^}]+)\}", lambda m: " " + (labels.numbers().get(m.group(1)) or m.group(1)), s)
    s = re.sub(r"\\texttt\{([^}]*)\}", r"\1", s)
    s = re.sub(r"\\emph\{([^}]*)\}", r"\1", s)
    s = s.replace("$$", "$")
    s = re.sub(r"(?<!\\)[{}]", lambda m: m.group(0), s)
    s = re.sub(r"\s+", " ", s).strip()
    # drop braces that only grouped text (a leftover of {\color{black} ...})
    if s.startswith("{") and s.endswith("}"):
        s = s[1:-1].strip()
    return s


def load_questions() -> List[dict]:
    """The open questions of the conclusion chapter included in main.tex, with their current numbers."""
    concl = [c for c in labels.included_chapters() if "conclusion" in c]
    path = THESIS / ((concl[0] if concl else "chap/07_conclusion_v6") + ".tex")
    if not path.exists():
        return []
    text = path.read_text(errors="ignore")
    out = []
    for m in re.finditer(r"\\begin\{question\}\\label\{([^}]+)\}(.*?)\\end\{question\}", text, re.S):
        lab, body = m.group(1), m.group(2)
        body = re.sub(r"\{\\color\{black\}(.*?)\}\s*$", r"\1", body.strip(), flags=re.S)
        num = labels.numbers().get(lab, "")
        # the questions are shown as the thesis states them, without commentary
        out.append(dict(id=lab.split(":", 1)[-1], statement=_tex_to_display(body), evidence="", references=[],
                        thesis=[f"Question {num}" if num else "Question"]))
    return out


def _notation() -> List[dict]:
    """The List of notation of the thesis, and the bound of prop:latent-bound, which the symbol tooltips also use."""
    from . import thesis_text
    rows = [dict(symbol=r["label"][1:-1] if r["label"].startswith("$") and r["label"].endswith("$") else r["label"], meaning=r["text"], where=r["where"] or "")
            for r in thesis_text.thesis_lists()["notation"]]
    rows.append(dict(symbol="|\\mathcal Z(M)|-|\\Delta_c(M)|",
                     meaning="For $M$ on a seed rooted at a main root, every unfolding $T$ satisfies $q(T)\\leq|\\mathcal Z(M)|-|\\Delta_c(M)|$.",
                     where=labels.ref("prop:latent-bound")))
    return rows


def gallery_public() -> List[dict]:
    return [dict(id=g["id"], name=g["name"], description=g["description"], params=g["params"], references=g["references"]) for g in GALLERY]
