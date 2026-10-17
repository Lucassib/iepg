"""FoldToSeed (Chapter 5, Section 'Algorithms for computing realizations'), combinatorial branch
duplications and the regular algebraic branch duplication (Definition def:abd).

FoldToSeed(T): while T has a vertex v with two distinct isomorphic branches U, U' such that T - U' has the
same diameter as T, record U' and replace T by T - U'. Return the seed and the recorded branches. Each
recorded step is a diameter-preserving 1-CBD read backwards.

Regular s-ABD of a branch U at y with root u (Definition def:abd): the copies carry M[U], the rest of the
matrix is unchanged, and the edges from y to the copies get weight m_yu / sqrt(s + 1), that is, the square
of the weight is divided by s + 1.
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from typing import Dict, List, Optional, Tuple

from .diag import Matrix
from .trees import Tree


@dataclass
class FoldStep:
    tree: Tree
    removed_branch: List[int]      # vertices of the branch removed from `tree` (ids of `tree`)
    at_vertex: Optional[int]
    isomorphic_to: List[int]       # vertices of the isomorphic branch that stays (ids of `tree`)
    relabel: Dict[int, int]        # id in `tree` -> id in the next tree (for the kept vertices)


def fold_to_seed(t: Tree) -> List[FoldStep]:
    """steps[k].tree is the tree after k removals; the last step has an empty removed_branch and its tree is the seed."""
    steps: List[FoldStep] = []
    cur = t
    while True:
        tw = cur.removable_twin()
        if tw is None:
            steps.append(FoldStep(cur, [], None, [], {v: v for v in range(cur.n)}))
            return steps
        v, u, u2 = tw
        removed = sorted(cur.subtree(u2, v))
        kept = sorted(cur.subtree(u, v))
        nxt, relabel = cur.remove_vertices(removed)
        steps.append(FoldStep(cur, removed, v, kept, relabel))
        cur = nxt


def rooted_isomorphism(t: Tree, a: int, pa: Optional[int], b: int, pb: Optional[int]) -> Dict[int, int]:
    """A root-preserving isomorphism between the branch rooted at a (parent pa) and the one at b (parent pb)."""
    phi = {a: b}
    ka = sorted([w for w in t.adj[a] if w != pa], key=lambda w: t.rooted_canon(w, a))
    kb = sorted([w for w in t.adj[b] if w != pb], key=lambda w: t.rooted_canon(w, b))
    assert len(ka) == len(kb)
    for wa, wb in zip(ka, kb):
        assert t.rooted_canon(wa, a) == t.rooted_canon(wb, b)
        phi.update(rooted_isomorphism(t, wa, a, wb, b))
    return phi


def unfold_realization(steps: List[FoldStep], M_seed: Matrix) -> Matrix:
    """Carry a matrix on the seed back to the original tree by regular 1-ABDs along the fold steps.

    Every step k (from the last to the first) adds the copy U' recorded in steps[k] to steps[k+1].tree,
    copying M[U] onto U' and splitting the square of the weight of the edge y-u equally between y-u and y-u'."""
    M = M_seed
    for k in range(len(steps) - 2, -1, -1):
        st = steps[k]
        big = st.tree
        inv = {new: old for old, new in st.relabel.items()}
        # matrix on the bigger tree, in the ids of `big`
        diag = {inv[v]: q for v, q in M.diag.items()}
        w2 = {(min(inv[u], inv[v]), max(inv[u], inv[v])): q for (u, v), q in M.w2.items()}
        y = st.at_vertex
        u_root = next(w for w in big.adj[y] if w in set(st.isomorphic_to))
        u2_root = next(w for w in big.adj[y] if w in set(st.removed_branch))
        phi = rooted_isomorphism(big, u_root, y, u2_root, y)
        for a, b in phi.items():
            diag[b] = diag[a]
        for a, b in phi.items():
            for c in big.adj[a]:
                if c in phi and (min(a, c), max(a, c)) in w2 and (min(phi[a], phi[c]), max(phi[a], phi[c])) not in w2:
                    w2[(min(b, phi[c]), max(b, phi[c]))] = w2[(min(a, c), max(a, c))]
        old = w2[(min(y, u_root), max(y, u_root))]
        w2[(min(y, u_root), max(y, u_root))] = old / 2
        w2[(min(y, u2_root), max(y, u2_root))] = old / 2
        M = Matrix(diag, w2)
    return M


def regular_abd(t: Tree, M: Matrix, y: int, u: int, s: int = 1) -> Tuple[Tree, Matrix, List[int], List[Tuple[int, int]]]:
    """Duplicate the branch of t at y rooted at u, s times, and apply the regular s-ABD to M.
    Returns the new tree, the new matrix, the ids of the new vertices and the new edges."""
    U = t.subtree(u, y)
    par = t.parents(u)
    n = t.n
    edges = t.edges()
    diag = dict(M.diag)
    w2 = dict(M.w2)
    new_vertices: List[int] = []
    new_edges: List[Tuple[int, int]] = []
    for _ in range(s):
        phi = {}
        for v in U:
            phi[v] = n
            new_vertices.append(n)
            n += 1
        for v in U:
            diag[phi[v]] = M.diag[v]
            for c in t.adj[v]:
                if c in phi and v < c:
                    edges.append((phi[v], phi[c]))
                    new_edges.append((phi[v], phi[c]))
                    w2[(phi[v], phi[c])] = M.w(v, c)
        edges.append((y, phi[u]))
        new_edges.append((y, phi[u]))
        w2[(min(y, phi[u]), max(y, phi[u]))] = M.w(y, u) / (s + 1)
    w2[(min(y, u), max(y, u))] = M.w(y, u) / (s + 1)
    return Tree.from_edges(n, edges), Matrix(diag, w2), new_vertices, new_edges
