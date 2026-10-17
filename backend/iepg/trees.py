"""Trees: parsing, canonical forms, diameter, centers, kinds, seeds and the drawing convention of the thesis.

Conventions (thesis): the diameter is counted in edges, the depth of a vertex is its distance to the root,
a branch of T at v is a connected component of T - v rooted at its vertex adjacent to v, a seed is a tree that
is not an unfolding of a tree with fewer vertices, and a rooted seed (Johnson, Lettie, Mack-Crane and
Szabelska-Beresewicz, 2020) is a rooted tree in which no vertex has two isomorphic branches.
"""
from __future__ import annotations

import math
import re
from collections import deque
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

Edge = Tuple[int, int]


class TreeError(ValueError):
    pass


@dataclass
class Tree:
    n: int
    adj: List[Set[int]]

    # ----- construction -------------------------------------------------------------------------
    @staticmethod
    def from_edges(n: int, edges: Iterable[Edge]) -> "Tree":
        adj: List[Set[int]] = [set() for _ in range(n)]
        m = 0
        for u, v in edges:
            if not (0 <= u < n and 0 <= v < n):
                raise TreeError(f"edge {u}-{v} uses a vertex outside 0..{n-1}")
            if u == v:
                raise TreeError(f"loop at vertex {u}")
            if v in adj[u]:
                raise TreeError(f"edge {u}-{v} appears twice")
            adj[u].add(v)
            adj[v].add(u)
            m += 1
        t = Tree(n, adj)
        if n == 0:
            raise TreeError("empty tree")
        if m != n - 1:
            raise TreeError(f"a tree with {n} vertices has {n - 1} edge{'' if n == 2 else 's'}, got {m}")
        if not t.connected():
            raise TreeError("the graph is not connected")
        return t

    def connected(self) -> bool:
        seen = {0}
        q = deque([0])
        while q:
            v = q.popleft()
            for w in self.adj[v]:
                if w not in seen:
                    seen.add(w)
                    q.append(w)
        return len(seen) == self.n

    def edges(self) -> List[Edge]:
        return [(u, v) for u in range(self.n) for v in self.adj[u] if u < v]

    def degree(self, v: int) -> int:
        return len(self.adj[v])

    # ----- distances -----------------------------------------------------------------------------
    def bfs(self, s: int) -> List[int]:
        dist = [-1] * self.n
        dist[s] = 0
        q = deque([s])
        while q:
            v = q.popleft()
            for w in self.adj[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    q.append(w)
        return dist

    def parents(self, root: int) -> List[Optional[int]]:
        par: List[Optional[int]] = [None] * self.n
        seen = [False] * self.n
        seen[root] = True
        q = deque([root])
        while q:
            v = q.popleft()
            for w in self.adj[v]:
                if not seen[w]:
                    seen[w] = True
                    par[w] = v
                    q.append(w)
        return par

    def children(self, root: int) -> List[List[int]]:
        par = self.parents(root)
        ch: List[List[int]] = [[] for _ in range(self.n)]
        for v, p in enumerate(par):
            if p is not None:
                ch[p].append(v)
        return ch

    def longest_path(self) -> List[int]:
        d0 = self.bfs(0)
        a = max(range(self.n), key=lambda v: d0[v])
        da = self.bfs(a)
        b = max(range(self.n), key=lambda v: da[v])
        # reconstruct path a -> b
        par = self.parents(a)
        path = [b]
        while path[-1] != a:
            path.append(par[path[-1]])  # type: ignore[arg-type]
        return path[::-1]

    def diameter(self) -> int:
        return len(self.longest_path()) - 1

    def center(self) -> Tuple[str, List[int]]:
        """('vertex', [c]) for even diameter, ('edge', [u, v]) for odd diameter (the main roots)."""
        p = self.longest_path()
        d = len(p) - 1
        if d % 2 == 0:
            return "vertex", [p[d // 2]]
        return "edge", [p[d // 2], p[d // 2 + 1]]

    def main_roots(self) -> List[int]:
        return self.center()[1]

    # ----- subtrees and branches ------------------------------------------------------------------
    def subtree(self, w: int, p: Optional[int]) -> List[int]:
        """Vertices of the branch rooted at w when the edge to p is cut (all of T if p is None)."""
        out = [w]
        st = [(w, p)]
        while st:
            v, q = st.pop()
            for u in self.adj[v]:
                if u != q:
                    out.append(u)
                    st.append((u, v))
        return out

    def rooted_canon(self, v: int, p: Optional[int] = None) -> str:
        """Canonical string of the subtree rooted at v (parent p excluded), nested parentheses."""
        return "(" + "".join(sorted(self.rooted_canon(w, v) for w in self.adj[v] if w != p)) + ")"

    def rooted_depth(self, v: int, p: Optional[int] = None) -> int:
        return max((1 + self.rooted_depth(w, v) for w in self.adj[v] if w != p), default=0)

    def canonical(self) -> str:
        """Canonical string of the unrooted tree: rooted at the center vertex, or the smaller of the two
        rooted strings at the ends of the central edge, prefixed by the kind of center."""
        kind, c = self.center()
        if kind == "vertex":
            return "v" + self.rooted_canon(c[0])
        a, b = c
        sa, sb = self.rooted_canon(a, b), self.rooted_canon(b, a)
        return "e" + "".join(sorted([sa, sb]))

    # ----- kinds ---------------------------------------------------------------------------------
    def is_path(self) -> bool:
        return all(self.degree(v) <= 2 for v in range(self.n))

    def high_degree_vertices(self) -> List[int]:
        return [v for v in range(self.n) if self.degree(v) >= 3]

    def is_linear(self) -> bool:
        """All vertices of degree at least three lie on a common path (Johnson and Wakhare)."""
        H = self.high_degree_vertices()
        if len(H) <= 1:
            return True
        # farthest pair inside H
        dist_from = {h: self.bfs(h) for h in H}
        a, b = max(((x, y) for x in H for y in H), key=lambda xy: dist_from[xy[0]][xy[1]])
        da, db = dist_from[a], dist_from[b]
        dab = da[b]
        return all(da[h] + db[h] == dab for h in H)

    def kind(self) -> str:
        if self.is_path():
            return "path"
        H = self.high_degree_vertices()
        if len(H) == 1 and all(self.degree(v) == 1 for v in range(self.n) if v != H[0]):
            return "star"
        if len(H) == 1:
            return "generalized_star"
        if len(H) == 2 and H[1] in self.adj[H[0]]:
            return "double_generalized_star"
        # caterpillar: removing the leaves leaves a path
        inner = [v for v in range(self.n) if self.degree(v) >= 2]
        if all(sum(1 for w in self.adj[v] if self.degree(w) >= 2) <= 2 for v in inner):
            return "caterpillar"
        return "other"

    # ----- seeds ---------------------------------------------------------------------------------
    def branches_at(self, v: int) -> Dict[str, List[int]]:
        """Roots of the branches at v grouped by rooted isomorphism type."""
        groups: Dict[str, List[int]] = {}
        for w in self.adj[v]:
            groups.setdefault(self.rooted_canon(w, v), []).append(w)
        return groups

    def remove_vertices(self, drop: Iterable[int]) -> Tuple["Tree", Dict[int, int]]:
        """Tree without the given vertices, relabelled 0..m-1, and the map old id -> new id."""
        drop = set(drop)
        keep = [v for v in range(self.n) if v not in drop]
        new = {v: i for i, v in enumerate(keep)}
        edges = [(new[u], new[v]) for u, v in self.edges() if u in new and v in new]
        return Tree.from_edges(len(keep), edges), new

    def removable_twin(self) -> Optional[Tuple[int, int, int]]:
        """(v, u, u') with u, u' isomorphic branches at v such that T - branch(u') keeps the diameter."""
        d = self.diameter()
        for v in range(self.n):
            for _, roots in self.branches_at(v).items():
                if len(roots) >= 2:
                    u, u2 = roots[0], roots[1]
                    t2, _ = self.remove_vertices(self.subtree(u2, v))
                    if t2.diameter() == d:
                        return v, u, u2
        return None

    def is_seed(self) -> bool:
        return self.removable_twin() is None

    def is_rooted_seed(self, root: int) -> bool:
        par = self.parents(root)
        for v in range(self.n):
            kids = [w for w in self.adj[v] if w != par[v]]
            canons = [self.rooted_canon(w, v) for w in kids]
            if len(canons) != len(set(canons)):
                return False
        return True


# ================================================================================================
# Parsing
# ================================================================================================

def _relabel(labels: List[str]) -> Dict[str, int]:
    """Map labels to 0..n-1: numerically if all are integers, otherwise by first appearance."""
    uniq = list(dict.fromkeys(labels))
    if all(re.fullmatch(r"-?\d+", s) for s in uniq):
        uniq = sorted(uniq, key=int)
    return {s: i for i, s in enumerate(uniq)}


def parse_edges(text: str) -> Tree:
    pairs: List[Tuple[str, str]] = []
    chunks = re.split(r"[,\n;]+", text.strip())
    # "0-1 1-2 2-3": edges separated by spaces only, each written with a dash or a colon
    if len(chunks) == 1 and re.fullmatch(r"\s*\w+\s*(?:-+|—|–|:)\s*\w+(?:\s+\w+\s*(?:-+|—|–|:)\s*\w+)+\s*", chunks[0]):
        chunks = re.findall(r"\w+\s*(?:-+|—|–|:)\s*\w+", chunks[0])
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.fullmatch(r"\s*([A-Za-z0-9_]+)\s*(?:-+|—|–|\s+|:)\s*([A-Za-z0-9_]+)\s*", chunk)
        if not m:
            raise TreeError(f"cannot read the edge '{chunk}'. Write edges as 0-1 or 0 1, separated by commas, spaces or line breaks")
        pairs.append((m.group(1), m.group(2)))
    if not pairs:
        raise TreeError("no edges given")
    lab = _relabel([x for p in pairs for x in p])
    return Tree.from_edges(len(lab), [(lab[a], lab[b]) for a, b in pairs])


def parse_adjacency(text: str) -> Tree:
    edges: List[Tuple[str, str]] = []
    labels: List[str] = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            raise TreeError(f"line '{line}' must look like 'v: a b c'")
        v, rest = line.split(":", 1)
        v = v.strip()
        labels.append(v)
        for w in rest.replace(",", " ").split():
            labels.append(w)
            edges.append((v, w))
    lab = _relabel(labels)
    seen = set()
    uniq = []
    for a, b in edges:
        key = frozenset((lab[a], lab[b]))
        if key not in seen:
            seen.add(key)
            uniq.append((lab[a], lab[b]))
    return Tree.from_edges(len(lab), uniq)


def _int_list(text: str) -> List[int]:
    toks = re.findall(r"-?\d+", text)
    if not toks:
        raise TreeError("no integers found")
    return [int(t) for t in toks]


def parse_parents(text: str) -> Tree:
    par = _int_list(text)
    n = len(par)
    roots = [i for i, p in enumerate(par) if p < 0]
    if len(roots) != 1:
        raise TreeError("exactly one entry must be -1 (the root)")
    return Tree.from_edges(n, [(i, p) for i, p in enumerate(par) if p >= 0])


def parse_prufer(text: str) -> Tree:
    seq = _int_list(text)
    n = len(seq) + 2
    if any(not 0 <= x < n for x in seq):
        raise TreeError(f"a Prüfer sequence of length {len(seq)} uses labels 0..{n-1}")
    degree = [1] * n
    for x in seq:
        degree[x] += 1
    edges = []
    for x in seq:
        for leaf in range(n):
            if degree[leaf] == 1:
                edges.append((leaf, x))
                degree[leaf] -= 1
                degree[x] -= 1
                break
    u, v = [i for i in range(n) if degree[i] == 1]
    edges.append((u, v))
    return Tree.from_edges(n, edges)


def parse_parentheses(text: str) -> Tree:
    s = re.sub(r"\s+", "", text)
    if not s or set(s) - set("()"):
        raise TreeError("use only parentheses, e.g. ((()())())")
    edges: List[Edge] = []
    stack: List[int] = []
    n = 0
    for ch in s:
        if ch == "(":
            v = n
            n += 1
            if stack:
                edges.append((stack[-1], v))
            stack.append(v)
        else:
            if not stack:
                raise TreeError("unbalanced parentheses")
            stack.pop()
    if stack:
        raise TreeError("unbalanced parentheses")
    return Tree.from_edges(n, edges)


def parse_graph6(text: str) -> Tree:
    s = text.strip()
    if s.startswith(">>graph6<<"):
        s = s[10:]
    data = [ord(c) - 63 for c in s]
    if not data:
        raise TreeError("the graph6 string is empty")
    if any(not 0 <= x < 64 for x in data):
        raise TreeError("not a graph6 string")
    if data[0] == 63:
        raise TreeError("graph6 strings with more than 62 vertices are not supported here")
    n = data[0]
    bits = []
    for x in data[1:]:
        bits.extend((x >> k) & 1 for k in range(5, -1, -1))
    edges = []
    k = 0
    for j in range(1, n):
        for i in range(j):
            if k < len(bits) and bits[k]:
                edges.append((i, j))
            k += 1
    return Tree.from_edges(n, edges)


PARSERS = {
    "edges": parse_edges,
    "adjacency": parse_adjacency,
    "parents": parse_parents,
    "prufer": parse_prufer,
    "parentheses": parse_parentheses,
    "graph6": parse_graph6,
}


def to_graph6(t: Tree) -> str:
    n = t.n
    bits = []
    for j in range(1, n):
        for i in range(j):
            bits.append(1 if j in t.adj[i] else 0)
    while len(bits) % 6:
        bits.append(0)
    out = [chr(n + 63)]
    for k in range(0, len(bits), 6):
        val = 0
        for b in bits[k:k + 6]:
            val = val * 2 + b
        out.append(chr(val + 63))
    return "".join(out)


def to_parentheses(t: Tree, root: int) -> str:
    return t.rooted_canon(root)


# ================================================================================================
# Gallery of famous trees
# ================================================================================================

def path(n: int) -> Tree:
    return Tree.from_edges(n, [(i, i + 1) for i in range(n - 1)])


def star(n: int) -> Tree:
    return Tree.from_edges(n, [(0, i) for i in range(1, n)])


def generalized_star(arms: int, length: int) -> Tree:
    edges = []
    n = 1
    for _ in range(arms):
        prev = 0
        for _ in range(length):
            edges.append((prev, n))
            prev = n
            n += 1
    return Tree.from_edges(n, edges)


def double_generalized_star(arms: int, length: int) -> Tree:
    a = generalized_star(arms, length)
    n = a.n
    edges = a.edges() + [(u + n, v + n) for u, v in a.edges()] + [(0, n)]
    return Tree.from_edges(2 * n, edges)


def caterpillar(spine: int, legs: int) -> Tree:
    edges = [(i, i + 1) for i in range(spine - 1)]
    n = spine
    for i in range(spine):
        for _ in range(legs):
            edges.append((i, n))
            n += 1
    return Tree.from_edges(n, edges)


def spider(legs: int, length: int) -> Tree:
    return generalized_star(legs, length)


def whirl(ell: int) -> Tree:
    """The (3, ell)-whirl: a center, three neighbours, each carrying two pendent paths of length ell.
    It has 6*ell + 4 vertices and diameter 2*ell + 2; the (3, 2)-whirl is the tree of Barioli and Fallat."""
    edges = []
    n = 1
    for _ in range(3):
        a = n
        n += 1
        edges.append((0, a))
        for _ in range(2):
            prev = a
            for _ in range(ell):
                edges.append((prev, n))
                prev = n
                n += 1
    return Tree.from_edges(n, edges)


def barioli_fallat() -> Tree:
    return whirl(2)


class Rooted:
    """A rooted tree given by nested tuples of children, used to build S_d by composition."""

    def __init__(self, children: Sequence["Rooted"] = ()):
        self.children = list(children)

    def size(self) -> int:
        return 1 + sum(c.size() for c in self.children)

    def to_tree(self) -> Tuple[Tree, int, List[Edge]]:
        """The tree, its root id and the edges added by the LAST composition (dashed in the figures):
        the edges from the root to its last `last_added` children."""
        edges: List[Edge] = []
        counter = [0]
        root_children: List[int] = []

        def build(node: "Rooted", is_root: bool) -> int:
            v = counter[0]
            counter[0] += 1
            for c in node.children:
                w = build(c, False)
                edges.append((v, w))
                if is_root:
                    root_children.append(w)
            return v

        r = build(self, True)
        k = getattr(self, "last_added", 0)
        dashed = [(r, w) for w in root_children[len(root_children) - k:]] if k else []
        return Tree.from_edges(counter[0], edges), r, dashed


def compose(R: Rooted, R2: Rooted) -> Rooted:
    """R ⊙ R': join the roots by an edge, the root of the result is the root of R."""
    out = Rooted(list(R.children) + [Rooted(R2.children)])
    out.last_added = 1  # type: ignore[attr-defined]
    return out


def compose2(R: Rooted, R2: Rooted) -> Rooted:
    """R ⊙ (R', R'): attach two copies of R' to the root of R."""
    out = Rooted(list(R.children) + [Rooted(R2.children), Rooted(R2.children)])
    out.last_added = 2  # type: ignore[attr-defined]
    return out


@lru_cache(maxsize=None)
def S_seed(d: int) -> Rooted:
    """The seed S_d of Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan: S_{-1} = S_0 = K_1,
    S_{2k-1} = S_{2k-3} ⊙ S_{2k-3}, S_{2k} = S_{2k-3} ⊙ (S_{2k-3}, S_{2k-3})."""
    if d <= 0:
        return Rooted()
    if d % 2 == 1:
        b = S_seed(d - 2)
        return compose(b, b)
    b = S_seed(d - 3)
    return compose2(b, b)


def def_seeds_families(d: int) -> List[Tuple[str, str, "Rooted"]]:
    """The seeds of Definition def_seeds of diameter d, as (name, TeX label, rooted tree)."""
    S = S_seed
    out = []
    if d % 2 == 0 and d >= 4:
        k = (d - 2) // 2
        out.append(("S'", "S'", compose2(S(2 * k - 3), S(2 * k - 1))))
        k2 = (d - 4) // 2
        if k2 >= 2:  # items (iii)-(v) start at d = 8; for d = 6 they give S_6^(4), S_6^(5) and S_6^(2)
            y = compose(S(2 * k2 - 3), S(2 * k2 - 1))
            out.append(("S^(3)", "S^{(3)}", compose2(y, compose(S(2 * k2 - 1), S(2 * k2 - 1)))))
            out.append(("S^(4)", "S^{(4)}", compose2(S(2 * k2 + 1), y)))
            out.append(("S^(5)", "S^{(5)}", compose2(S(2 * k2 - 1), y)))
    if d % 2 == 1 and d >= 5:
        k = (d - 3) // 2
        y = compose(S(2 * k - 3), S(2 * k - 1))
        out.append(("S'", "S'", compose(y, y)))
        out.append(("S''", "S''", compose(y, compose(S(2 * k - 1), S(2 * k - 1)))))
    return out


def S_d_tree(d: int) -> Tuple[Tree, int, List[Edge]]:
    return S_seed(d).to_tree()


GALLERY = [
    dict(id="path", name="Path P_n", description="The path with n vertices. q(P_n) = n: all eigenvalues of a Jacobi matrix are simple.",
         params=[dict(name="n", min=2, max=40, default=7)], references=["leal2002minimum"],
         build=lambda p: (path(int(p["n"])), [])),
    dict(id="star", name="Star", description="One vertex adjacent to all the others. A generalized star with arms of length one.",
         params=[dict(name="n", min=3, max=40, default=6)], references=["johnson2003inverse"],
         build=lambda p: (star(int(p["n"])), [])),
    dict(id="generalized_star", name="Generalized star", description="At most one vertex of degree greater than two: k arms of length l. Diminimal (Johnson, Leal-Duarte and Saiago, 2003).",
         params=[dict(name="k", min=3, max=8, default=3), dict(name="l", min=1, max=6, default=3)], references=["johnson2003inverse"],
         build=lambda p: (generalized_star(int(p["k"]), int(p["l"])), [])),
    dict(id="double_generalized_star", name="Double generalized star", description="Two generalized stars whose centers are joined by an edge. Diminimal (Johnson, Leal-Duarte and Saiago, 2003).",
         params=[dict(name="k", min=2, max=6, default=3), dict(name="l", min=1, max=5, default=2)], references=["johnson2003inverse"],
         build=lambda p: (double_generalized_star(int(p["k"]), int(p["l"])), [])),
    dict(id="caterpillar", name="Caterpillar", description="A path (the spine) with pendent vertices at each spine vertex. Linear, hence diminimal (Johnson and Wakhare, 2022).",
         params=[dict(name="spine", min=2, max=12, default=5), dict(name="legs", min=1, max=4, default=2)], references=["johnson2022inverse"],
         build=lambda p: (caterpillar(int(p["spine"]), int(p["legs"])), [])),
    dict(id="barioli_fallat", name="Tree of Barioli and Fallat", description="Sixteen vertices, diameter 6, q(T) = 8 = d(T) + 2: the first counterexample to the conjecture of Leal-Duarte and Johnson.",
         params=[], references=["barioli2004two"],
         build=lambda p: (barioli_fallat(), [])),
    dict(id="whirl", name="Whirl (3, l)", description="A center, three neighbours, each with two pendent paths of length l (6l + 4 vertices, diameter 2l + 2). Kim and Shader: q - d is unbounded on whirls; the (3,2)-whirl is the tree of Barioli and Fallat.",
         params=[dict(name="l", min=1, max=8, default=3)], references=["kim2009smith", "hogben2022inverse"],
         build=lambda p: (whirl(int(p["l"])), [])),
    dict(id="S_d", name="Seed S_d", description="The seed S_d of Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan, defined by S_{2k-1} = S_{2k-3} ⊙ S_{2k-3} and S_{2k} = S_{2k-3} ⊙ (S_{2k-3}, S_{2k-3}). Dashed edges: the last composition.",
         params=[dict(name="d", min=1, max=13, default=7)], references=["allem2023diminimal"],
         build=lambda p: S_d_tree(int(p["d"]))[0:1] + (S_d_tree(int(p["d"]))[2],)),
]


def gallery_build(gid: str, params: Dict[str, float]) -> Tuple[Tree, List[Edge]]:
    for g in GALLERY:
        if g["id"] == gid:
            p = {q["name"]: q["default"] for q in g["params"]}
            p.update({k: v for k, v in (params or {}).items() if k in p})
            for q in g["params"]:
                v = p[q["name"]]
                if not isinstance(v, (int, float)) or float(v) != int(v):
                    raise TreeError(f"parameter {q['name']} must be an integer")
                if not q["min"] <= v <= q["max"]:
                    raise TreeError(f"parameter {q['name']} must be between {q['min']} and {q['max']}")
            return g["build"](p)
    raise TreeError(f"unknown gallery id '{gid}'")


# ================================================================================================
# Drawing convention
# ================================================================================================

def _unit(deg: float) -> Tuple[float, float]:
    return math.cos(math.radians(deg)), math.sin(math.radians(deg))


FAN = {1: [0], 2: [0, -40], 3: [40, 0, -40], 4: [45, 15, -15, -45], 5: [50, 25, 0, -25, -50], 6: [55, 33, 11, -11, -33, -55]}
FANUP = {1: [0], 2: [25, -25], 3: [30, 0, -30], 4: [36, 12, -12, -36], 5: [40, 20, 0, -20, -40], 6: [45, 27, 9, -9, -27, -45]}


def _fan(k: int, table: Dict[int, List[float]], spread: float = 40.0) -> List[float]:
    if k in table:
        return table[k]
    if k == 0:
        return []
    return [spread * (k - 1) / 2 - spread * i for i in range(k)]


class Layout:
    """Coordinates in the drawing convention of the thesis: unit edge length, y grows downward.

    Even diameter: the main root in the middle, the branches of maximum depth leave it diagonally
    downward (one to each side) and continue vertically, their remaining vertices drawn outward, the
    shallower branches are drawn above the root (single vertices to the left, longer ones to the right).
    Odd diameter: the main edge is horizontal and each main root draws its branches to its own side.
    """

    def __init__(self, t: Tree):
        self.t = t
        self.pos: Dict[int, Tuple[float, float]] = {}

    def _place_fan(self, v: int, p: Optional[int], theta: float, table: Dict[int, List[float]], exclude: Iterable[int] = ()):
        t = self.t
        ex = set(exclude)
        ch = sorted([u for u in t.adj[v] if u != p and u not in ex], key=lambda u: (-t.rooted_depth(u, v), t.rooted_canon(u, v)))
        if not ch:
            return
        for u, off in zip(ch, _fan(len(ch), table)):
            a = theta + off
            dx, dy = _unit(a)
            self.pos[u] = (self.pos[v][0] + dx, self.pos[v][1] - dy)  # y downward
            self._place_fan(u, v, a, table)

    def _deep_branch(self, w: int, root: int, sgn: int):
        """Branch rooted at w (already placed): spine vertically down, other vertices fanned outward."""
        t = self.t
        out = 0 if sgn > 0 else 180
        cur, prev = w, root
        while True:
            kids = [u for u in t.adj[cur] if u != prev]
            if not kids:
                break
            c = max(kids, key=lambda u: (t.rooted_depth(u, cur), t.rooted_canon(u, cur)))
            self.pos[c] = (self.pos[cur][0], self.pos[cur][1] + 1.0)
            self._place_fan(cur, prev, out, FAN, exclude=(c,))
            prev, cur = cur, c

    def _shallow(self, root: int, kids: List[int], left: List[float], right: List[float]):
        t = self.t
        leaves = sorted([w for w in kids if t.rooted_depth(w, root) == 0])
        others = sorted([w for w in kids if t.rooted_depth(w, root) > 0], key=lambda w: (t.rooted_depth(w, root), t.rooted_canon(w, root)))
        angles = _fan(len(leaves), {1: [left[0]], 2: [left[0] + 15, left[0] - 15], 3: [left[0] + 25, left[0], left[0] - 25]}, 20)
        angles = [a if len(leaves) in (1, 2, 3) else left[0] + a for a in angles]
        angles2 = _fan(len(others), {1: [right[0]], 2: [right[0] + 15, right[0] - 15], 3: [right[0] + 25, right[0], right[0] - 25]}, 20)
        angles2 = [a if len(others) in (1, 2, 3) else right[0] + a for a in angles2]
        for w, a in zip(leaves + others, angles + angles2):
            dx, dy = _unit(a)
            self.pos[w] = (self.pos[root][0] + dx, self.pos[root][1] - dy)
            self._place_fan(w, root, a, FANUP)

    def even(self, root: int):
        t = self.t
        kids = list(t.adj[root])
        dmax = max(t.rooted_depth(w, root) for w in kids)
        deep = sorted([w for w in kids if t.rooted_depth(w, root) == dmax], key=lambda w: t.rooted_canon(w, root))
        self.pos[root] = (0.0, 0.0)
        k = len(deep)
        if k <= 2:
            angles = [225.0, 315.0][:k] if k == 2 else [270.0]
        else:
            angles = [200.0 + 140.0 * i / (k - 1) for i in range(k)]
        for w, a in zip(deep, angles):
            dx, dy = _unit(a)
            self.pos[w] = (dx, -dy)
            sgn = 1 if dx >= 0 else -1
            if k <= 2:
                self._deep_branch(w, root, sgn)
            else:
                self._place_fan(w, root, a, FAN)
        self._shallow(root, [w for w in kids if w not in deep], left=[135.0], right=[45.0])

    def odd(self, u: int, u2: int):
        t = self.t
        self.pos[u] = (-0.5, 0.0)
        self.pos[u2] = (0.5, 0.0)
        for root, other, sgn in ((u, u2, -1), (u2, u, 1)):
            kids = [w for w in t.adj[root] if w != other]
            if not kids:
                continue
            dmax = max(t.rooted_depth(w, root) for w in kids)
            deep = sorted([w for w in kids if t.rooted_depth(w, root) == dmax and dmax >= 2], key=lambda w: t.rooted_canon(w, root))
            k = len(deep)
            base = 225.0 if sgn < 0 else 315.0
            angles = [base] if k == 1 else [base + (20.0 if sgn < 0 else -20.0) * (i - (k - 1) / 2) * 2 for i in range(k)]
            for w, a in zip(deep, angles):
                dx, dy = _unit(a)
                self.pos[w] = (self.pos[root][0] + dx, self.pos[root][1] - dy)
                self._deep_branch(w, root, sgn)
            if sgn < 0:
                self._shallow(root, [w for w in kids if w not in deep], left=[150.0], right=[105.0])
            else:
                self._shallow(root, [w for w in kids if w not in deep], left=[30.0], right=[75.0])

    def rooted(self, root: int):
        """A rooted tree drawn from its root: deepest branches downward, the rest upward."""
        self.even(root)

    @staticmethod
    def of(t: Tree, roots: Optional[List[int]] = None) -> Dict[int, Tuple[float, float]]:
        L = Layout(t)
        if roots is None:
            roots = t.main_roots()
        if len(roots) == 1:
            L.even(roots[0])
        else:
            L.odd(roots[0], roots[1])
        missing = [v for v in range(t.n) if v not in L.pos]
        if missing:  # should not happen, but never leave a vertex without coordinates
            for v in missing:
                L.pos[v] = (0.0, 0.0)
        return {v: (round(x, 4), round(y, 4)) for v, (x, y) in L.pos.items()}


# ================================================================================================
# Info record
# ================================================================================================

def tree_info(t: Tree, dashed: Optional[List[Edge]] = None, roots: Optional[List[int]] = None) -> dict:
    kind, c = t.center()
    return dict(
        canonical=t.canonical(),
        n=t.n,
        diameter=t.diameter(),
        edges=t.edges(),
        center=dict(type=kind, vertices=c),
        main_roots=c,
        linear=t.is_linear(),
        kind=t.kind(),
        is_seed=t.is_seed(),
        layout={str(v): [x, y] for v, (x, y) in Layout.of(t, roots).items()},
        dashed_edges=[list(e) for e in (dashed or [])],
    )


def from_canonical(s: str) -> Tree:
    """Inverse of Tree.canonical()."""
    if not s or s[0] not in "ve":
        raise TreeError("not a canonical string")
    if s[0] == "v":
        return parse_parentheses(s[1:])
    # 'e' + two rooted strings: split at the matching parenthesis
    body = s[1:]
    depth = 0
    for i, ch in enumerate(body):
        depth += 1 if ch == "(" else -1
        if depth == 0:
            a, b = body[: i + 1], body[i + 1:]
            break
    else:
        raise TreeError("not a canonical string")
    ta = parse_parentheses(a)
    tb = parse_parentheses(b)
    edges = ta.edges() + [(u + ta.n, v + ta.n) for u, v in tb.edges()] + [(0, ta.n)]
    return Tree.from_edges(ta.n + tb.n, edges)
