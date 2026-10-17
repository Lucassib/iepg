"""Graphs beyond trees: unicyclic graphs, threshold graphs and cographs.

Only what is proved in the literature is shown:
  * q(G) >= d(G) + 1, d(G) the largest distance between two vertices joined by a unique shortest path
    (Ahmadi, Alinaghipour, Cavers, Fallat, Meagher and Nasserasr 2013, Theorem 3.2);
  * q(G) <= n - floor(k/2) if G contains a cycle of length k (Barrett, Fallat, Hall, Hogben, Lin and Shader
    2017, Corollary 4.12);
  * q(C_n) = ceil(n/2) (Ahmadi et al. 2013);
  * tadpoles: Braga, Allem, Capaverde, Moraes, Sibemberg and Scaratti (CNMAC 2024, published 2025),
    Theorems 3.2 and 3.3;
  * sunlets: Allem, Braga, Scaratti and Sibemberg (LAGOS 2025), Theorems 1.2 and 3.1;
  * threshold graphs: the matrix of Algorithm 1 of Allem, Hoppen, Lazzarin, Sibemberg and Tura (LAA 2025),
    DSpec(M) in {-l, 0, l, 2l}; and Theorem 6.5 of Fallat and Mojallal (2022);
  * cographs: the construction in the proof of Theorem 4 of Allem, Fürer, Hoppen, Sibemberg and Trevisan
    (arXiv:2602.07282, submitted), DSpec(M) in {-l, 0, l, 2l} with diagonal in {0, l}.

Matrices are computed exactly in Q(sqrt 2, sqrt 3, ...) and verified: the product (M + l)M(M - l)(M - 2l)
is computed and must be the zero matrix, which proves DSpec(M) is inside {-l, 0, l, 2l} (M is symmetric),
and the multiplicities are then the unique solution of the Vandermonde system given by tr(M^t), t = 0..3.
"""
from __future__ import annotations

import math
from collections import deque
from fractions import Fraction as F
from typing import Dict, List, Optional, Sequence, Set, Tuple

from .trees import Layout, Tree, TreeError


# ================================================================================================
# Exact sums of square roots
# ================================================================================================

def _squarefree(m: int) -> Tuple[int, int]:
    """m = a^2 * s with s squarefree; returns (a, s)."""
    if m == 0:
        return 0, 1
    a, s = 1, 1
    e = 0
    while m % 2 == 0:
        m //= 2
        e += 1
    a *= 2 ** (e // 2)
    if e % 2:
        s *= 2
    p = 3
    while p * p <= m:
        e = 0
        while m % p == 0:
            m //= p
            e += 1
        if e:
            a *= p ** (e // 2)
            if e % 2:
                s *= p
        p += 2
    if m > 1:
        s *= m
    return a, s


class QR:
    """An exact element sum_s c_s sqrt(s), s squarefree positive integers, c_s rational."""
    __slots__ = ("t",)

    def __init__(self, t: Optional[Dict[int, F]] = None):
        self.t = {k: F(v) for k, v in (t or {}).items() if v != 0}

    @staticmethod
    def rat(q) -> "QR":
        return QR({1: F(q)})

    @staticmethod
    def sqrt(q) -> "QR":
        q = F(q)
        if q < 0:
            raise ValueError("square root of a negative number")
        a, s = _squarefree(q.numerator * q.denominator)
        return QR({s: F(a, q.denominator)})

    def __add__(self, o: "QR") -> "QR":
        t = dict(self.t)
        for k, v in o.t.items():
            t[k] = t.get(k, F(0)) + v
        return QR(t)

    def __sub__(self, o: "QR") -> "QR":
        return self + (-o)

    def __neg__(self) -> "QR":
        return QR({k: -v for k, v in self.t.items()})

    def __mul__(self, o) -> "QR":
        if not isinstance(o, QR):
            return QR({k: v * F(o) for k, v in self.t.items()})
        t: Dict[int, F] = {}
        for s, c in self.t.items():
            for u, d in o.t.items():
                g = math.gcd(s, u)
                key = (s // g) * (u // g)
                t[key] = t.get(key, F(0)) + c * d * g
        return QR(t)

    __rmul__ = __mul__

    def div_rat(self, q) -> "QR":
        return QR({k: v / F(q) for k, v in self.t.items()})

    def is_zero(self) -> bool:
        return not self.t

    def is_rational(self) -> bool:
        return all(k == 1 for k in self.t)

    def rational(self) -> F:
        assert self.is_rational()
        return self.t.get(1, F(0))

    def approx(self) -> float:
        return float(sum(float(c) * math.sqrt(s) for s, c in self.t.items()))

    def __str__(self) -> str:
        if not self.t:
            return "0"
        parts = []
        for s in sorted(self.t):
            c = self.t[s]
            cs = str(c.numerator) if c.denominator == 1 else f"{c.numerator}/{c.denominator}"
            if s == 1:
                parts.append(cs)
            elif c == 1:
                parts.append(f"√{s}")
            elif c == -1:
                parts.append(f"-√{s}")
            else:
                parts.append(f"{cs}√{s}")
        return " + ".join(parts).replace("+ -", "- ")


def mat_mul(A: List[List[QR]], B: List[List[QR]]) -> List[List[QR]]:
    n = len(A)
    out = [[QR() for _ in range(n)] for _ in range(n)]
    nzB = [[(k, B[k][j]) for k in range(n) if not B[k][j].is_zero()] for j in range(n)]
    for i in range(n):
        Ai = A[i]
        for j in range(n):
            acc = QR()
            for k, b in nzB[j]:
                a = Ai[k]
                if not a.is_zero():
                    acc = acc + a * b
            out[i][j] = acc
    return out


def shift(A: List[List[QR]], s: F) -> List[List[QR]]:
    n = len(A)
    return [[A[i][j] - (QR.rat(s) if i == j else QR()) for j in range(n)] for i in range(n)]


def verify_four(M: List[List[QR]], lam: F) -> dict:
    """Proof that DSpec(M) is inside {-l, 0, l, 2l}: the product of the four shifts is the zero matrix;
    multiplicities from tr(M^t), t = 0..3 (a Vandermonde system with four distinct nodes)."""
    n = len(M)
    vals = [-lam, F(0), lam, 2 * lam]
    P = shift(M, vals[0])
    for v in vals[1:]:
        P = mat_mul(P, shift(M, v))
    zero = all(P[i][j].is_zero() for i in range(n) for j in range(n))
    M2 = mat_mul(M, M)
    tr = [QR.rat(n), sum((M[i][i] for i in range(n)), QR()), sum((M2[i][i] for i in range(n)), QR())]
    M3tr = QR()
    for i in range(n):
        for k in range(n):
            if not M2[i][k].is_zero() and not M[k][i].is_zero():
                M3tr = M3tr + M2[i][k] * M[k][i]
    tr.append(M3tr)
    mult = None
    if zero and all(x.is_rational() for x in tr):
        b = [x.rational() for x in tr]
        # solve sum_s m_s v_s^t = b_t for t = 0..3 by Gaussian elimination
        A = [[v ** t for v in vals] + [b[t]] for t in range(4)]
        for c in range(4):
            piv = next(r for r in range(c, 4) if A[r][c] != 0)
            A[c], A[piv] = A[piv], A[c]
            for r in range(4):
                if r != c and A[r][c] != 0:
                    f = A[r][c] / A[c][c]
                    A[r] = [A[r][x] - f * A[c][x] for x in range(5)]
        mult = [A[i][4] / A[i][i] for i in range(4)]
        if any(m < 0 or m.denominator != 1 for m in mult):
            mult = None
    spec = None
    if mult is not None:
        spec = [dict(value=_fs(v), multiplicity=int(m)) for v, m in zip(vals, mult) if m > 0]
    return dict(product_is_zero=zero, spectrum=spec, q=(len(spec) if spec else None))


def _fs(q: F) -> str:
    return str(q.numerator) if q.denominator == 1 else f"{q.numerator}/{q.denominator}"


# ================================================================================================
# Graphs
# ================================================================================================

class Graph:
    def __init__(self, n: int, edges: Sequence[Tuple[int, int]]):
        self.n = n
        self.adj: List[Set[int]] = [set() for _ in range(n)]
        for u, v in edges:
            if u == v:
                raise TreeError(f"loop at {u}")
            if not (0 <= u < n and 0 <= v < n):
                raise TreeError(f"edge {u}-{v} outside 0..{n - 1}")
            if v in self.adj[u]:
                raise TreeError(f"edge {u}-{v} twice")
            self.adj[u].add(v)
            self.adj[v].add(u)

    def edges(self) -> List[Tuple[int, int]]:
        return [(u, v) for u in range(self.n) for v in self.adj[u] if u < v]

    def m(self) -> int:
        return sum(len(a) for a in self.adj) // 2

    def components(self) -> List[List[int]]:
        seen = [False] * self.n
        out = []
        for s in range(self.n):
            if seen[s]:
                continue
            comp = [s]
            seen[s] = True
            q = deque([s])
            while q:
                v = q.popleft()
                for w in self.adj[v]:
                    if not seen[w]:
                        seen[w] = True
                        comp.append(w)
                        q.append(w)
            out.append(comp)
        return out

    def connected(self) -> bool:
        return self.n > 0 and len(self.components()) == 1

    def unique_path_distance(self) -> Tuple[int, Optional[Tuple[int, int]]]:
        """d(G): the largest dist(u, v) over pairs joined by a unique shortest path, and one such pair."""
        best, pair = 0, None
        for s in range(self.n):
            dist = [-1] * self.n
            cnt = [0] * self.n
            dist[s], cnt[s] = 0, 1
            q = deque([s])
            while q:
                v = q.popleft()
                for w in self.adj[v]:
                    if dist[w] < 0:
                        dist[w] = dist[v] + 1
                        cnt[w] = cnt[v]
                        q.append(w)
                    elif dist[w] == dist[v] + 1:
                        cnt[w] = min(2, cnt[w] + cnt[v])
            for v in range(self.n):
                if v != s and dist[v] > best and cnt[v] == 1:
                    best, pair = dist[v], (s, v)
        return best, pair


def _circle(n: int, r: float = 2.0) -> Dict[str, List[float]]:
    if n == 1:
        return {"0": [0.0, 0.0]}
    return {str(i): [round(r * math.cos(2 * math.pi * i / n - math.pi / 2), 4), round(r * math.sin(2 * math.pi * i / n - math.pi / 2), 4)]
            for i in range(n)}


def graph_json(G: Graph, layout: Optional[Dict[str, List[float]]] = None) -> dict:
    return dict(n=G.n, edges=[list(e) for e in G.edges()], layout=layout or _circle(G.n))


def lower_bounds(G: Graph) -> List[dict]:
    out = []
    d, pair = G.unique_path_distance()
    out.append(dict(value=d + 1, text=f"q(G) ≥ d + 1 = {d + 1}, where d = {d} is the largest distance between two vertices joined by a unique shortest path"
                    + (f" (for instance {pair[0]} and {pair[1]})" if pair else "") + ".",
                    references=["ahmadi2013"], source="Ahmadi et al. 2013, Theorem 3.2"))
    if G.m() > 0:
        out.append(dict(value=2, text="q(G) ≥ 2, since G has an edge and a matrix with one eigenvalue is a multiple of the identity.",
                        references=[], source="elementary"))
    else:
        out.append(dict(value=1, text="G has no edges, so the zero matrix gives q(G) = 1.", references=[], source="elementary"))
    return out


def known_exact(G: Graph) -> Optional[dict]:
    """Values of q(G) computed by Ahmadi et al. 2013 for complete and complete bipartite graphs."""
    n, m = G.n, G.m()
    if m == 0:
        return dict(value=1, text="G has no edges, so q(G) = 1.", references=[], source="elementary")
    if n >= 2 and m == n * (n - 1) // 2:
        return dict(value=2, text=f"G is the complete graph K_{n}, and q(K_n) = 2.", references=["ahmadi2013"], source="Ahmadi et al. 2013")
    if G.connected():
        # complete bipartite: 2-colourable and every pair of opposite colours adjacent
        col = {0: 0}
        q = deque([0])
        ok = True
        while q and ok:
            v = q.popleft()
            for w in G.adj[v]:
                if w not in col:
                    col[w] = 1 - col[v]
                    q.append(w)
                elif col[w] == col[v]:
                    ok = False
                    break
        if ok:
            A = [v for v in range(n) if col[v] == 0]
            B = [v for v in range(n) if col[v] == 1]
            if m == len(A) * len(B):
                a, b = sorted((len(A), len(B)))
                val = 2 if a == b else 3
                return dict(value=val, text=f"G is the complete bipartite graph K_{{{a},{b}}}, and q(K_{{m,n}}) = {'2 when m = n' if a == b else '3 when m ≠ n'}.",
                            references=["ahmadi2013"], source="Ahmadi et al. 2013")
    return None


# ================================================================================================
# Unicyclic graphs
# ================================================================================================

def unicyclic_structure(G: Graph) -> dict:
    """The cycle (the 2-core) and the pendant tree hanging from each cycle vertex."""
    deg = [len(a) for a in G.adj]
    alive = [True] * G.n
    q = deque([v for v in range(G.n) if deg[v] == 1])
    while q:
        v = q.popleft()
        if not alive[v]:
            continue
        alive[v] = False
        for w in G.adj[v]:
            if alive[w]:
                deg[w] -= 1
                if deg[w] == 1:
                    q.append(w)
    cyc = [v for v in range(G.n) if alive[v]]
    cset = set(cyc)
    order = [cyc[0]]
    prev = None
    while True:
        cur = order[-1]
        nxt = [w for w in G.adj[cur] if w in cset and w != prev]
        nxt = sorted(nxt)
        w = nxt[0]
        if w == order[0]:
            break
        prev = cur
        order.append(w)
    cycset = set(order)
    pendant = {}
    for c in order:
        comp = [c]
        seen = {c}
        st = [c]
        while st:
            v = st.pop()
            for w in G.adj[v]:
                if w not in seen and w not in cycset:
                    seen.add(w)
                    comp.append(w)
                    st.append(w)
        pendant[c] = comp
    return dict(cycle=order, pendant=pendant)


def _is_pendant_path_from_end(G: Graph, c: int, comp: List[int]) -> Optional[int]:
    """If the pendant tree at the cycle vertex c is a path with c at one end, its number of vertices other than c."""
    if len(comp) == 1:
        return 0
    inside = set(comp)
    degs = {v: sum(1 for w in G.adj[v] if w in inside) for v in comp}
    if degs[c] != 1 or any(x > 2 for x in degs.values()):
        return None
    return len(comp) - 1


def _layered(G: Graph, root: int, inside: Set[int]) -> Dict[int, Tuple[float, float]]:
    """Root at (0, 0), children below it (y = depth), leaves spread with unit spacing."""
    children: Dict[int, List[int]] = {root: []}
    order = [root]
    seen = {root}
    for v in order:
        for w in sorted(G.adj[v]):
            if w in inside and w not in seen:
                seen.add(w)
                children[v].append(w)
                children[w] = []
                order.append(w)
    x_of: Dict[int, float] = {}
    nxt = [0.0]

    def place(v: int, dep: int):
        if not children[v]:
            x_of[v] = nxt[0]
            nxt[0] += 1.0
        else:
            for c in children[v]:
                place(c, dep + 1)
            x_of[v] = sum(x_of[c] for c in children[v]) / len(children[v])

    place(root, 0)
    depth = {root: 0}
    for v in order:
        for c in children[v]:
            depth[c] = depth[v] + 1
    x0 = x_of[root]
    return {v: (x_of[v] - x0, float(depth[v])) for v in order}


def unicyclic_layout(G: Graph, struct: dict) -> Dict[str, List[float]]:
    cyc = struct["cycle"]
    k = len(cyc)
    R = max(1.2, k / (2 * math.pi) * 1.4)
    pos: Dict[int, Tuple[float, float]] = {}
    for i, c in enumerate(cyc):
        a = 2 * math.pi * i / k - math.pi / 2
        pos[c] = (R * math.cos(a), R * math.sin(a))
    for i, c in enumerate(cyc):
        comp = struct["pendant"][c]
        if len(comp) == 1:
            continue
        loc = _layered(G, c, set(comp))
        a = 2 * math.pi * i / k - math.pi / 2
        ang = a - math.pi / 2          # rotate 'downward' (0, 1) to the outward direction (cos a, sin a)
        ca, sa = math.cos(ang), math.sin(ang)
        for v, (x, y) in loc.items():
            if v == c:
                continue
            pos[v] = (pos[c][0] + (x * ca - y * sa) * 0.9, pos[c][1] + (x * sa + y * ca) * 0.9)
    return {str(v): [round(p[0], 4), round(p[1], 4)] for v, p in pos.items()}


def analyze_unicyclic(G: Graph) -> dict:
    if not G.connected():
        raise TreeError("the graph is not connected")
    if G.m() != G.n:
        raise TreeError(f"a unicyclic graph with {G.n} vertices has {G.n} edges, this one has {G.m()} edge{'' if G.m() == 1 else 's'}")
    st = unicyclic_structure(G)
    cyc = st["cycle"]
    k = len(cyc)
    n = G.n
    results = []
    lows = lower_bounds(G)
    lower = max(x["value"] for x in lows)
    upper = dict(value=n - k // 2, text=f"q(G) ≤ n − ⌊k/2⌋ = {n} − {k // 2} = {n - k // 2}, since G contains a cycle of length k = {k}.",
                 references=["barrett2017generalizations"], source="Barrett et al. 2017, Corollary 4.12")
    exact = None
    kind = "unicyclic"
    params: dict = {}
    paths = {c: _is_pendant_path_from_end(G, c, st["pendant"][c]) for c in cyc}
    nontrivial = [c for c in cyc if len(st["pendant"][c]) > 1]
    if known_exact(G) and n != k:
        exact = known_exact(G)
    if n == k:
        kind, params = "cycle", dict(n=n)
        exact = dict(value=(n + 1) // 2, text=f"q(C_{n}) = ⌈{n}/2⌉ = {(n + 1) // 2}.", references=["ahmadi2013"], source="Ahmadi et al. 2013")
    elif len(nontrivial) == 1 and paths[nontrivial[0]] is not None:
        m_ = paths[nontrivial[0]]
        kind, params = "tadpole", dict(k=k, n=m_)
        if 3 <= k < 2 * m_:
            exact = dict(value=m_ + (k + 1) // 2, text=f"G is the ({k}, {m_})-tadpole and 3 ≤ k < 2n, so q(G) = n + ⌈k/2⌉ = {m_ + (k + 1) // 2}.",
                         references=["braga2025short"], source="Braga et al. 2025, Theorem 3.2")
        elif k == 2 * m_:
            exact = dict(value=2 * m_, text=f"G is the ({k}, {m_})-tadpole with k = 2n, so q(G) = 2n = {2 * m_}.",
                         references=["braga2025short"], source="Braga et al. 2025, Theorem 3.3")
    elif all(paths[c] is not None and paths[c] == paths[cyc[0]] and paths[c] > 0 for c in cyc):
        ell = paths[cyc[0]]
        kind, params = "sunlet", dict(n=k, l=ell)
        if k >= 4 and k % 4 == 0:
            exact = dict(value=k // 2 + 2 * ell, text=f"G is the sunlet S_{k}^{ell} with n ≡ 0 (mod 4), so q(G) = n/2 + 2ℓ = {k // 2 + 2 * ell}.",
                         references=["allem2025sunlet"], source="Allem et al. 2025, Theorem 1.2")
        elif k >= 4 and k % 4 == 2:
            exact = dict(value=k // 2 + 2 * ell + 1, text=f"G is the sunlet S_{k}^{ell} with n ≡ 2 (mod 4), so q(G) = n/2 + 2ℓ + 1 = {k // 2 + 2 * ell + 1}.",
                         references=["allem2025sunlet"], source="Allem et al. 2025, Theorem 1.2")
        elif k >= 6:
            lows.append(dict(value=(k - 1) // 2 + 2 * ell + 2, text=f"G is the sunlet S_{k}^{ell} with n ≥ 6 and n ≢ 0 (mod 4), so q(G) > ⌊(n−1)/2⌋ + 2ℓ + 1, that is, q(G) ≥ {(k - 1) // 2 + 2 * ell + 2}.",
                             references=["allem2025sunlet"], source="Allem et al. 2025, Theorem 3.1"))
            lower = max(lower, (k - 1) // 2 + 2 * ell + 2)
    if exact is None and lower == upper["value"]:
        exact = dict(value=lower, text=f"the lower bound d + 1 and the upper bound n − ⌊k/2⌋ coincide, so q(G) = {lower}.",
                     references=["ahmadi2013", "barrett2017generalizations"], source="Ahmadi et al. 2013 and Barrett et al. 2017")
    if exact:
        # consistency with the general bounds (a failure here would mean a transcription error)
        assert lower <= exact["value"] <= upper["value"], (lower, exact, upper)
    refs = sorted(set(sum([x["references"] for x in lows + [upper] + ([exact] if exact else [])], [])))
    return dict(graph=graph_json(G, unicyclic_layout(G, st)), kind=kind, params=params, cycle=cyc, girth=k,
                pendant={str(c): v for c, v in st["pendant"].items()}, lower=lows, lower_value=lower, upper=upper,
                exact=exact, references=refs)


def couple(t: Tree, attach: int, k: int, mode: str) -> Graph:
    """C_k with the tree coalesced at one cycle vertex (mode 'one') or at every cycle vertex (mode 'all'):
    the vertex `attach` of the tree is identified with the cycle vertex."""
    if k < 3:
        raise TreeError("the cycle needs at least 3 vertices")
    if not 0 <= attach < t.n:
        raise TreeError("the attaching vertex is not in the tree")
    edges = [(i, (i + 1) % k) for i in range(k)]
    n = k
    copies = range(k) if mode == "all" else [0]
    for c in copies:
        ids = {attach: c}
        for v in range(t.n):
            if v != attach:
                ids[v] = n
                n += 1
        edges += [(ids[u], ids[v]) for u, v in t.edges()]
    return Graph(n, edges)


# ================================================================================================
# Threshold graphs (Algorithm 1 of Allem, Hoppen, Lazzarin, Sibemberg and Tura)
# ================================================================================================

def threshold_graph(seq: str) -> Tuple[Graph, List[int]]:
    b = [c for c in seq if c in "01"]
    if not b:
        raise TreeError("give a binary sequence, e.g. 0010111")
    b[0] = "0"   # the first vertex is isolated by convention
    edges = [(j, i) for i in range(len(b)) if b[i] == "1" for j in range(i)]
    blocks = []
    for c in b:
        if blocks and blocks[-1][0] == c:
            blocks[-1][1] += 1
        else:
            blocks.append([c, 1])
    return Graph(len(b), edges), [a for _, a in blocks]


def threshold_matrix(seq: str, lam) -> Tuple[List[List[QR]], dict]:
    G, a = threshold_graph(seq)
    lam = F(lam)
    if lam == 0:
        raise TreeError("λ must be nonzero")
    r = len(a)
    bag = []
    for i, ai in enumerate(a, start=1):
        bag += [i] * ai
    p, e = {}, {}
    for i in range(1, r + 1):
        ai = F(a[i - 1])
        if i % 4 == 1:
            p[i], e[i] = F(0), F(0)
        elif i % 4 == 2:
            p[i], e[i] = lam * (ai - 1) / ai, -lam / ai
        elif i % 4 == 3:
            p[i], e[i] = lam, F(0)
        else:
            p[i], e[i] = lam / ai, lam / ai
    e1: Dict[Tuple[int, int], QR] = {}
    for i in range(2, r):
        for j in range(i + 1, r + 1):
            if j % 2 == 0:
                s = QR.sqrt(F(1, 2 ** (j - i))) * lam
                e1[(i, j)] = s if j % 4 == 2 else -s
    if r >= 2:
        e1[(1, 2)] = QR.rat(lam)
    for j in range(4, r + 1, 2):
        e1[(1, j)] = e1[(2, j)]
    n = G.n
    M = [[QR() for _ in range(n)] for _ in range(n)]
    for u in range(n):
        M[u][u] = QR.rat(p[bag[u]])
    for u in range(n):
        for v in range(u + 1, n):
            bu, bv = bag[u], bag[v]
            if bu == bv:
                if bu % 2 == 0:
                    M[u][v] = M[v][u] = QR.rat(e[bu])
            else:
                i, j = min(bu, bv), max(bu, bv)
                if j % 2 == 0:
                    w = e1[(i, j)] * QR.sqrt(F(1, a[i - 1] * a[j - 1]))
                    M[u][v] = M[v][u] = w
    # the pattern must be the graph
    for u in range(n):
        for v in range(u + 1, n):
            assert (not M[u][v].is_zero()) == (v in G.adj[u]), "the matrix does not have the pattern of G"
    return M, dict(graph=G, blocks=a, bag=bag)


def fallat_mojallal_65(seq: str) -> Optional[dict]:
    """Theorem 6.5 of Fallat and Mojallal: G = 0^{k1} 1 0^{k2} 1 of order n >= 5, k1 >= 1, k2 >= 0:
    q(G) = 3 if k1 in {1, 2} or k2 in {0, 1}, and 4 otherwise."""
    s = "".join(c for c in seq if c in "01")
    if not s:
        return None
    s = "0" + s[1:]
    import re
    m = re.fullmatch(r"(0+)1(0*)1", s)
    if not m or len(s) < 5:
        return None
    k1, k2 = len(m.group(1)), len(m.group(2))
    val = 3 if (k1 in (1, 2) or k2 in (0, 1)) else 4
    return dict(value=val, text=f"G = 0^{k1} 1 0^{k2} 1 of order {len(s)} ≥ 5, so q(G) = {val}.",
                references=["fallat2022minimum"], source="Fallat and Mojallal 2022, Theorem 6.5")


def analyze_threshold(seq: str, lam=1) -> dict:
    M, meta = threshold_matrix(seq, lam)
    G = meta["graph"]
    ver = verify_four(M, F(lam))
    lows = lower_bounds(G)
    lower = max(x["value"] for x in lows)
    upper = dict(value=4, text="Every threshold graph has a matrix with DSpec(M) ⊆ {−λ, 0, λ, 2λ}, so q(G) ≤ 4.",
                 references=["allem2025threshold"], source="Allem et al. 2025, Theorem 1.1")
    if ver["q"] is not None and ver["q"] < upper["value"]:
        upper = dict(value=ver["q"], text=f"the matrix below, produced by Algorithm 1 of Allem et al. 2025 and verified exactly, has {ver['q']} distinct eigenvalues.",
                     references=["allem2025threshold"], source="Algorithm 1, verified")
    exact = known_exact(G) or fallat_mojallal_65(seq)
    if exact is None and lower == upper["value"]:
        exact = dict(value=lower, text=f"the lower bound and the verified matrix give q(G) = {lower}.", references=["ahmadi2013", "allem2025threshold"], source="bounds")
    bits = "".join(c for c in seq if c in "01")
    return dict(graph=graph_json(G), sequence=("0" + bits[1:]) if bits else bits, blocks=meta["blocks"],
                matrix=[[str(x) for x in row] for row in M], matrix_approx=[[round(x.approx(), 6) for x in row] for row in M],
                lam=_fs(F(lam)), verification=ver, lower=lows, lower_value=lower, upper=upper, exact=exact,
                references=sorted(set(["allem2025threshold"] + sum([x["references"] for x in lows], []) + (exact["references"] if exact else []))))


# ================================================================================================
# Cographs (Theorem 4 of Allem, Fürer, Hoppen, Sibemberg and Trevisan, submitted)
# ================================================================================================

MAX_COGRAPH = 60


def _check_cograph_size(expr) -> None:
    """Counts the leaves and the depth without recursion, before any edge is built."""
    stack, leaves, nodes = [(expr, 0)], 0, 0
    while stack:
        e, depth = stack.pop()
        nodes += 1
        if not isinstance(e, dict) or depth > 2 * MAX_COGRAPH or nodes > 4 * MAX_COGRAPH:
            raise TreeError(f"a cograph expression is limited to {MAX_COGRAPH} vertices")
        if e.get("op") == "v":
            leaves += 1
            if leaves > MAX_COGRAPH:
                raise TreeError(f"at most {MAX_COGRAPH} vertices in this version")
        else:
            ch = e.get("children") or []
            if not isinstance(ch, list):
                raise TreeError("the children of an operation form a list")
            stack.extend((c, depth + 1) for c in ch)


def cograph_from_expr(expr: dict) -> Tuple[Graph, dict]:
    """expr: {"op": "v"} | {"op": "union"|"join", "children": [...]}. Returns the graph and a cotree
    with vertex ids at the leaves."""
    edges: List[Tuple[int, int]] = []
    counter = [0]
    _check_cograph_size(expr)

    def build(e) -> Tuple[List[int], dict]:
        op = e.get("op")
        if op == "v":
            v = counter[0]
            counter[0] += 1
            return [v], dict(op="v", vertex=v)
        if op not in ("union", "join"):
            raise TreeError(f"unknown cograph operation {op}")
        ch = e.get("children") or []
        if len(ch) < 2:
            raise TreeError(f"{op} needs at least two operands")
        parts = [build(c) for c in ch]
        if op == "join":
            for x in range(len(parts)):
                for y in range(x + 1, len(parts)):
                    for u in parts[x][0]:
                        for w in parts[y][0]:
                            edges.append((u, w))
        return [v for p in parts for v in p[0]], dict(op=op, children=[p[1] for p in parts])

    verts, cot = build(expr)
    if counter[0] > 60:
        raise TreeError("at most 60 vertices in this version")
    return Graph(counter[0], edges), cot


def twin_sequence(G: Graph) -> Optional[List[Tuple[int, int, str]]]:
    """Removes twins one at a time (Theorem 3 of the cograph paper). Returns the removals (v', v, kind) in
    order, or None if at some point no two vertices are twins (then G is not a cograph)."""
    alive = set(range(G.n))
    adj = {v: set(G.adj[v]) for v in range(G.n)}
    out = []
    while len(alive) > 1:
        found = None
        vs = sorted(alive)
        for x in range(len(vs)):
            for y in range(x + 1, len(vs)):
                u, w = vs[x], vs[y]
                if adj[u] - {w} == adj[w] - {u}:
                    found = (w, u, "true" if w in adj[u] else "false")
                    break
            if found:
                break
        if not found:
            return None
        vp, v, kind = found
        out.append(found)
        alive.discard(vp)
        for z in adj[vp]:
            adj[z].discard(vp)
        del adj[vp]
    return out


def cograph_matrix(G: Graph, lam) -> Tuple[List[List[QR]], dict]:
    lam = F(lam)
    if lam == 0:
        raise TreeError("λ must be nonzero")
    seq = twin_sequence(G)
    if seq is None:
        raise TreeError("this graph is not a cograph (it has an induced P4)")
    n = G.n
    removed = {vp for vp, _, _ in seq}
    start = [v for v in range(n) if v not in removed][0] if n else None
    M = [[QR() for _ in range(n)] for _ in range(n)]
    present = {start}
    spec = {"0": 1}
    steps = []
    new_value = {("false", 0): F(0), ("false", 1): lam, ("true", 0): 2 * lam, ("true", 1): -lam}
    case_no = {("false", 0): 1, ("false", 1): 2, ("true", 0): 3, ("true", 1): 4}
    inv_sqrt2 = QR.sqrt(F(1, 2))
    for vp, v, kind in reversed(seq):
        mvv = M[v][v]
        key = (kind, 0 if mvv.is_zero() else 1)
        for u in present:
            if u != v and not M[u][v].is_zero():
                w = M[u][v] * inv_sqrt2
                M[u][v] = M[v][u] = w
                M[u][vp] = M[vp][u] = w
        if key == ("false", 0):
            M[v][v] = M[vp][vp] = QR()
            M[v][vp] = M[vp][v] = QR()
        elif key == ("false", 1):
            M[v][v] = M[vp][vp] = QR.rat(lam)
            M[v][vp] = M[vp][v] = QR()
        elif key == ("true", 0):
            M[v][v] = M[vp][vp] = QR.rat(lam)
            M[v][vp] = M[vp][v] = QR.rat(-lam)
        else:
            M[v][v] = M[vp][vp] = QR()
            M[v][vp] = M[vp][v] = QR.rat(lam)
        present.add(vp)
        nv = _fs(new_value[key])
        spec[nv] = spec.get(nv, 0) + 1
        steps.append(dict(added=vp, twin_of=v, kind=kind, case=case_no[key], new_eigenvalue=nv))
    for u in range(n):
        for w in range(u + 1, n):
            assert (not M[u][w].is_zero()) == (w in G.adj[u]), "the matrix does not have the pattern of G"
    return M, dict(steps=steps, spectrum_by_construction=spec)


def analyze_cograph(expr: dict, lam=1) -> dict:
    G, cot = cograph_from_expr(expr)
    M, meta = cograph_matrix(G, lam)
    ver = verify_four(M, F(lam))
    lows = lower_bounds(G)
    lower = max(x["value"] for x in lows)
    upper = dict(value=4, text="Every cograph has a matrix with DSpec(M) ⊆ {−λ, 0, λ, 2λ} and diagonal in {0, λ}, so q(G) ≤ 4.",
                 references=["allem2026cographs"], source="Allem, Fürer, Hoppen, Sibemberg and Trevisan, Theorems 2 and 4 (submitted)")
    if ver["q"] is not None and ver["q"] < 4:
        upper = dict(value=ver["q"], text=f"the matrix below, built by the construction in the proof of Theorem 4 and verified exactly, has {ver['q']} distinct eigenvalues.",
                     references=["allem2026cographs"], source="construction of Theorem 4, verified")
    exact = known_exact(G)
    if exact is None and lower == upper["value"]:
        exact = dict(value=lower, text=f"the lower bound and the verified matrix give q(G) = {lower}.", references=["ahmadi2013", "allem2026cographs"], source="bounds")
    return dict(graph=graph_json(G), cotree=cot, twin_steps=meta["steps"], spectrum_by_construction=meta["spectrum_by_construction"],
                matrix=[[str(x) for x in row] for row in M], matrix_approx=[[round(x.approx(), 6) for x in row] for row in M],
                lam=_fs(F(lam)), verification=ver, lower=lows, lower_value=lower, upper=upper, exact=exact,
                references=sorted(set(["allem2026cographs"] + sum([x["references"] for x in lows], []) + (exact["references"] if exact else []))))
