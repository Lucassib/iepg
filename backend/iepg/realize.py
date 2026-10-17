"""The constructions of Chapter 5 of the thesis, exactly as stated there, in exact arithmetic.

  * phi                     Algorithm phi (Section 'Computing almost spectrally arbitrary bricks for S_d')
  * base_sr                 BaseStrongRealization = phi(([l0+l2-l1],1), ([l1],1), l0)
  * strong_realization      Algorithm StrongRealization(k, Lambda): a brick of S_{2k-1} with Z(M) = Lambda
  * lambda_family           the explicit family Lambda^(j)(alpha, beta, delta), equation (Lambda)
  * chain_block             the matrix (eq:chain-block) of Lemma lem:chain-block on P_3
  * arm_conditions          conditions (C1)-(C6) of Lemma lem:six-arms
  * rooted_seed_realization         Algorithm RootedSeedRealization(i, A)
  * tower_chain             Algorithm TowerChain(H, A, s)
  * realize_S_d             Steps 2 of RealizeTree: the brick of S_d from Lambda_1^(k)(alpha, beta, delta)
  * tower_seed_brick        Proposition prop:tower-bricks and the proof of Theorem many_seeds

A matrix on a rooted tree is an `RT`: vertices 0..n-1, root 0, parent pointers, diagonal entries and the
squares of the weights of the edges to the parents (Diagonalize only uses the squares). Every result is
checked by `verify` (rational Diagonalize runs at the prescribed values), which is a proof, not a test:
if the sum of the multiplicities at the candidate values is n, the spectrum is inside the candidates, and
if every subtree passes the same count, the temporary zero set is inside the candidates.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction as F
from functools import lru_cache
from typing import Dict, List, Optional, Sequence, Tuple

from .diag import Matrix, fstr
from .trees import Tree


# ================================================================================================
# Rooted weighted trees
# ================================================================================================

class RT:
    def __init__(self):
        self.parent: List[Optional[int]] = []
        self.children: List[List[int]] = []
        self.diag: List[F] = []
        self.w2: List[Optional[F]] = []

    def add(self, diag, parent: Optional[int] = None, w2=None) -> int:
        i = len(self.diag)
        self.parent.append(parent)
        self.children.append([])
        self.diag.append(F(diag))
        self.w2.append(None if parent is None else F(w2))
        if parent is not None:
            self.children[parent].append(i)
        return i

    @property
    def n(self) -> int:
        return len(self.diag)

    def postorder(self, root: int = 0) -> List[int]:
        out, st = [], [(root, False)]
        while st:
            v, done = st.pop()
            if done:
                out.append(v)
                continue
            st.append((v, True))
            for c in reversed(self.children[v]):
                st.append((c, False))
        return out

    def bfs(self, root: int = 0) -> List[int]:
        order = [root]
        i = 0
        while i < len(order):
            order.extend(self.children[order[i]])
            i += 1
        return order

    def copy_into(self, dst: "RT", parent: Optional[int], w2) -> Dict[int, int]:
        """Copy self into dst (root first, BFS order); returns old id -> new id."""
        m: Dict[int, int] = {}
        for v in self.bfs(0):
            if v == 0:
                m[v] = dst.add(self.diag[v], parent, w2)
            else:
                m[v] = dst.add(self.diag[v], m[self.parent[v]], self.w2[v])
        return m

    def depth(self) -> int:
        dep = {0: 0}
        for v in self.bfs(0):
            for c in self.children[v]:
                dep[c] = dep[v] + 1
        return max(dep.values())

    def tree(self) -> Tree:
        return Tree.from_edges(self.n, [(v, p) for v, p in enumerate(self.parent) if p is not None])

    def matrix(self) -> Matrix:
        return Matrix({v: self.diag[v] for v in range(self.n)},
                      {(min(v, p), max(v, p)): self.w2[v] for v, p in enumerate(self.parent) if p is not None})

    def matrix_json(self) -> dict:
        return self.matrix().to_json()

    def canonical_rooted(self, v: int = 0) -> str:
        return "(" + "".join(sorted(self.canonical_rooted(c) for c in self.children[v])) + ")"


def diag_rt(T: RT, lam: F, root: int = 0) -> Tuple[List[F], List[F]]:
    """Diagonalize(M, -lam) on the rooted tree (lines 1-11 of Chapter 2): temporary and final values."""
    lam = F(lam)
    hat: List[Optional[F]] = [None] * T.n
    fin: List[Optional[F]] = [None] * T.n
    cut = [False] * T.n
    for v in T.postorder(root):
        val = T.diag[v] - lam
        zc = None
        for c in T.children[v]:
            if cut[c]:
                continue
            if fin[c] == 0:
                zc = c
            else:
                val -= T.w2[c] / fin[c]
        if zc is not None:
            fin[zc] = F(2)
            hat[v] = -T.w2[zc] / 2
            fin[v] = hat[v]
            if T.parent[v] is not None:
                cut[v] = True
        else:
            hat[v] = val
            fin[v] = val
    return hat, fin  # type: ignore[return-value]


# ================================================================================================
# Verification (a proof by counting zeros, at rational candidate values)
# ================================================================================================

@dataclass
class Verification:
    ok: bool                         # the counts close: DSpec and Z(M) are inside the candidates
    dspec: List[F]
    mult: Dict[F, int]
    Z: List[F]
    latent: List[F]
    confined: List[F]
    witnesses: Dict[F, List[int]]
    is_brick: bool
    q: int
    reason: str

    def to_json(self) -> dict:
        return dict(ok=self.ok, dspec=[fstr(x) for x in self.dspec], multiplicities={fstr(k): v for k, v in self.mult.items() if v},
                    Z=[fstr(x) for x in self.Z], latent=[fstr(x) for x in self.latent], confined=[fstr(x) for x in self.confined],
                    witnesses={fstr(k): v for k, v in self.witnesses.items()}, is_brick=self.is_brick, q=self.q, reason=self.reason)


def verify(T: RT, candidates: Sequence, d: int, other_roots: Sequence[int] = (), root: int = 0) -> Verification:
    """Exact check at the candidate values.

    For each lambda, one run of Diagonalize(M, -lambda) gives the multiplicity of lambda in M and, for every
    vertex w, its multiplicity in M[T_w]: the final values inside T_w - w are those of the local run on
    M[T_w], and the temporary value of w is the final value of w in that run (Remark rem:local).
    If the multiplicities in M add up to n, DSpec(M) is inside the candidates; if, for every w, the
    multiplicities in M[T_w] add up to |T_w|, then Z(M), the union of the DSpec(M[T_w]), is inside the
    candidates too. Then Z(M) is the set of candidates with a temporary zero."""
    cand = sorted(set(F(x) for x in candidates))
    n = T.n
    order = T.postorder(root)
    size = [0] * n
    for v in order:
        size[v] = 1 + sum(size[c] for c in T.children[v])
    sub_total = [0] * n
    mult: Dict[F, int] = {}
    witnesses: Dict[F, List[int]] = {}
    for lam in cand:
        hat, fin = diag_rt(T, lam, root)
        mult[lam] = sum(1 for x in fin if x == 0)
        witnesses[lam] = [v for v in range(n) if hat[v] == 0]
        Fz = [0] * n
        for v in order:
            Fz[v] = (1 if fin[v] == 0 else 0) + sum(Fz[c] for c in T.children[v])
            sub_total[v] += Fz[v] - (1 if fin[v] == 0 else 0) + (1 if hat[v] == 0 else 0)
    total = sum(mult.values())
    if total != n:
        return Verification(False, [], mult, [], [], [], {}, False, 0,
                            f"the multiplicities at the candidate values add up to {total}, not n = {n}: part of the spectrum is elsewhere")
    bad = [v for v in range(n) if sub_total[v] != size[v]]
    dspec = [x for x in cand if mult[x] > 0]
    if bad:
        return Verification(False, dspec, mult, [], [], [], {}, False, len(dspec),
                            f"the subtree at vertex {bad[0]} has eigenvalues outside the candidate values")
    Z = [x for x in cand if witnesses[x]]
    latent = [x for x in Z if mult[x] == 0]
    others = set(other_roots)
    confined = [x for x in latent if witnesses[x] and all(v in others for v in witnesses[x])]
    q = len(dspec)
    is_brick = q == d + 1 and len(confined) == len(latent)
    if is_brick:
        reason = f"q(M) = {q} = d + 1, and " + ("there is no latent value." if not latent else
                                                  "every latent value has its temporary zeros only at the other main root.")
    elif q != d + 1:
        reason = f"q(M) = {q}, not d + 1 = {d + 1}."
    else:
        x0 = [x for x in latent if x not in confined][0]
        reason = f"the latent value {fstr(x0)} has a temporary zero at vertex {witnesses[x0][0]}, which is not the other main root."
    return Verification(True, dspec, mult, Z, latent, confined, {k: v for k, v in witnesses.items() if v}, is_brick, q, reason)


# ================================================================================================
# phi, the base case and StrongRealization
# ================================================================================================

@dataclass
class PhiInfo:
    lam: F
    dx: F
    dy: F
    w2: F
    left: List[int]      # ids (in the result) of the vertices of the first argument
    right: List[int]     # ids of the vertices of the second argument
    map_left: Dict[int, int] = field(default_factory=dict)    # id in the first argument -> id in the result
    map_right: Dict[int, int] = field(default_factory=dict)   # id in the second argument -> id in the result

    def to_json(self) -> dict:
        return dict(lam=fstr(self.lam), dx=fstr(self.dx), dy=fstr(self.dy), w2=fstr(self.w2), edge=[0, len(self.left)],
                    left=self.left, right=self.right)


def phi(A: Optional[RT], B: Optional[RT], lam) -> Tuple[Optional[RT], Optional[PhiInfo], str]:
    """Algorithm phi: fails if an argument failed or lam >= min(DSpec(A) u DSpec(B)); otherwise joins the roots
    by an edge of weight tau = sqrt(d_x d_y), with d_x, d_y the final values of the roots in Diagonalize(., -lam).
    The root of the result is the root of A (id 0); the vertices of A come first."""
    if A is None or B is None:
        return None, None, "an argument of phi failed"
    lam = F(lam)
    _, fa = diag_rt(A, lam)
    _, fb = diag_rt(B, lam)
    if not all(x > 0 for x in fa) or not all(x > 0 for x in fb):
        return None, None, f"phi: {fstr(lam)} is not below the spectra of both arguments"
    out = RT()
    ma = A.copy_into(out, None, None)
    mb = B.copy_into(out, 0, fa[0] * fb[0])
    info = PhiInfo(lam, fa[0], fb[0], fa[0] * fb[0], list(range(A.n)), list(range(A.n, A.n + B.n)), ma, mb)
    return out, info, ""


def single(x) -> RT:
    t = RT()
    t.add(x)
    return t


def base_sr(L: Sequence) -> Tuple[RT, PhiInfo]:
    l0, l1, l2 = [F(v) for v in L]
    X, info, _ = phi(single(l0 + l2 - l1), single(l1), l0)
    assert X is not None and info is not None  # the base case never fails
    return X, info


def is_sorted_set(L: Sequence[F]) -> bool:
    return all(L[i] < L[i + 1] for i in range(len(L) - 1))


@dataclass
class SRNode:
    k: int
    set: List[F]
    ok: bool = True
    gammaL: Optional[F] = None
    gammaR: Optional[F] = None
    choice: Optional[str] = None          # '+' or '-' (the lateral set used), None for k = 1
    mu: Optional[F] = None
    interior: Optional["SRNode"] = None
    lateral: Optional["SRNode"] = None
    phi: Optional[PhiInfo] = None
    fail: str = ""
    X: Optional[RT] = None

    def to_json(self, with_matrices: bool = True, depth_limit: int = 99) -> dict:
        out = dict(k=self.k, set=[fstr(x) for x in self.set], ok=self.ok,
                   gammaL=fstr(self.gammaL) if self.gammaL is not None else None,
                   gammaR=fstr(self.gammaR) if self.gammaR is not None else None,
                   choice=self.choice, mu=fstr(self.mu) if self.mu is not None else None, fail=self.fail,
                   phi=self.phi.to_json() if self.phi else None, n=self.X.n if self.X else None)
        if with_matrices and self.X is not None:
            from .trees import tree_info
            other = len(self.phi.left) if self.phi else None
            out["tree"] = tree_info(self.X.tree(), roots=[0, other] if other is not None and self.X.n > 1 else None)
            out["matrix"] = self.X.matrix_json()
        if depth_limit > 0:
            out["lateral"] = self.lateral.to_json(with_matrices, depth_limit - 1) if self.lateral else None
            out["interior"] = self.interior.to_json(with_matrices, depth_limit - 1) if self.interior else None
        return out


def strong_realization(k: int, L: Sequence) -> SRNode:
    """Algorithm StrongRealization(k, Lambda), lines 1-25, with the recursion recorded in an SRNode."""
    L = sorted(F(x) for x in L)
    node = SRNode(k=k, set=L)
    if len(L) != 2 * k + 1 or not is_sorted_set(L):
        node.ok, node.fail = False, f"StrongRealization({k}, .) needs {2 * k + 1} distinct values"
        return node
    if k == 1:
        node.X, node.phi = base_sr(L)
        return node
    gL, gR = L[1] - L[0], L[-1] - L[-2]
    node.gammaL, node.gammaR = gL, gR
    if gL == gR:
        node.ok, node.fail = False, "the outer gaps are equal (line 5)"
        return node
    node.interior = strong_realization(k - 1, L[1:-1])
    if not node.interior.ok:
        node.ok, node.fail = False, "the interior set is not admissible"
        return node
    if gR > gL:
        node.choice, node.mu = "+", L[0] + L[-1] - L[1]
        lat = L[2:-1] + [node.mu]
    else:
        node.choice, node.mu = "-", L[0] + L[-1] - L[-2]
        lat = [node.mu] + L[1:-2]
    node.lateral = strong_realization(k - 1, lat)
    if not node.lateral.ok:
        node.ok, node.fail = False, f"the lateral set Lambda_{node.choice} is not admissible"
        return node
    X, info, msg = phi(node.lateral.X, node.interior.X, L[0])     # lateral first, interior second (lines 16, 24)
    if X is None:
        node.ok, node.fail = False, msg
        return node
    node.X, node.phi = X, info
    return node


def admissible(L: Sequence) -> Tuple[bool, dict]:
    """Definition def:admissible, with the recursion tree (no matrices)."""
    L = sorted(F(x) for x in L)
    k = (len(L) - 1) // 2
    if len(L) % 2 == 0 or not is_sorted_set(L):
        return False, dict(set=[fstr(x) for x in L], ok=False, fail="an admissible set has an odd number of distinct values")

    def rec(S: List[F]) -> dict:
        kk = (len(S) - 1) // 2
        nd = dict(set=[fstr(x) for x in S], k=kk, tested=kk >= 2, ok=True, gammaL=None, gammaR=None, choice=None, mu=None,
                  children=[], alternative=None, fail="")
        if kk <= 1:
            return nd
        gL, gR = S[1] - S[0], S[-1] - S[-2]
        nd["gammaL"], nd["gammaR"] = fstr(gL), fstr(gR)
        if gL == gR:
            nd["ok"], nd["fail"] = False, "gamma_L = gamma_R"
            return nd
        inter = rec(S[1:-1])
        if gR > gL:
            mu = S[0] + S[-1] - S[1]
            lat = S[2:-1] + [mu]
            alt = [S[0] + S[-1] - S[-2]] + S[1:-2]
            nd["choice"] = "+"
        else:
            mu = S[0] + S[-1] - S[-2]
            lat = [mu] + S[1:-2]
            alt = S[2:-1] + [S[0] + S[-1] - S[1]]
            nd["choice"] = "-"
        nd["mu"] = fstr(mu)
        lt = rec(lat)
        nd["children"] = [dict(role="interior", node=inter), dict(role="lateral", node=lt)]
        nd["alternative"] = [fstr(x) for x in sorted(alt)]
        nd["ok"] = inter["ok"] and lt["ok"]
        if not nd["ok"]:
            nd["fail"] = "a set below is not admissible"
        return nd

    tree = rec(L)
    return tree["ok"], tree


# ================================================================================================
# The explicit family and S_d (RealizeTree, steps 2)
# ================================================================================================

def default_delta(k: int, alpha, beta) -> List[F]:
    return [(F(beta) - F(alpha)) / (2 ** i) for i in range(k)]


def lambda_family(j: int, alpha, beta, delta: Sequence) -> List[F]:
    """Lambda^(j)(alpha, beta, delta) = {lambda_0 < ... < lambda_{2j+1}}, equation (Lambda)."""
    a, b = F(alpha), F(beta)
    d = [F(x) for x in delta]
    out = []
    for i in range(0, j + 1):
        out.append(a - sum(d[0:j - i], F(0)))
    out.append(b)
    for i in range(j + 2, 2 * j + 1):
        out.append(b + d[0] + 2 * sum(d[1:i - j - 1], F(0)) + d[i - j - 1])
    out.append(b + d[0] + 2 * sum(d[1:j], F(0)))
    return out


def lambda_1(j, alpha, beta, delta, eps=0) -> List[F]:
    L = lambda_family(j, alpha, beta, delta)
    return [L[0] + F(eps)] + L[1:-1]


def lambda_2(j, alpha, beta, delta, eps=0) -> List[F]:
    L = lambda_family(j, alpha, beta, delta)
    return L[1:-1] + [L[-1] + F(eps)]


def delta_ok(delta: Sequence) -> bool:
    d = [F(x) for x in delta]
    return all(x > 0 for x in d) and all(d[i] <= d[i - 1] / 2 for i in range(1, len(d)))


def abd_other_root(X: RT, other: int) -> RT:
    """The regular 1-ABD of X duplicating, at the root 0, the branch rooted at `other` (Definition def:abd):
    the copy carries X[U] and the square of the weight of the edge from the root is split in half."""
    out = RT()
    m: Dict[int, int] = {}
    for v in X.bfs(0):
        if v == 0:
            m[v] = out.add(X.diag[v])
        else:
            w2 = X.w2[v] / 2 if v == other else X.w2[v]
            m[v] = out.add(X.diag[v], m[X.parent[v]], w2)
    # the copy of the branch rooted at `other`
    sub = [v for v in X.bfs(other)]
    mm: Dict[int, int] = {}
    for v in sub:
        if v == other:
            mm[v] = out.add(X.diag[v], m[0], X.w2[v] / 2)
        else:
            mm[v] = out.add(X.diag[v], mm[X.parent[v]], X.w2[v])
    return out


@dataclass
class Brick:
    X: RT
    d: int
    other_roots: List[int]
    candidates: List[F]
    prescribed: List[F]
    method: str
    trace: dict = field(default_factory=dict)
    verification: Optional[Verification] = None

    def check(self) -> "Brick":
        self.verification = verify(self.X, self.candidates, self.d, self.other_roots)
        return self


def realize_S_d(d: int, alpha=0, beta=None) -> Tuple[Optional[Brick], SRNode]:
    """StrongRealization on the explicit admissible set Lambda_1^(k)(alpha, beta, delta), delta_i = (beta-alpha)/2^i,
    k = ceil(d/2) (RealizeTree, lines 2-5); for even d a regular 1-ABD of the branch at r containing the other main root."""
    k = (d + 1) // 2
    if beta is None:
        beta = alpha + 2 ** (k - 1)  # integral spectrum by prop:algorithms(b); RealizeTree(S_9, 0, 16) in the thesis
    delta = default_delta(k, alpha, beta)
    L = lambda_1(k, alpha, beta, delta)
    node = strong_realization(k, L)
    if not node.ok:
        return None, node
    X = node.X
    other = node.phi.left.__len__() if node.phi else 1     # root of the second argument of the last phi
    if d % 2 == 1:
        b = Brick(X, d, [other], L, L, f"StrongRealization({k}, Λ₁^({k})({alpha}, {beta}, δ))")
    else:
        X2 = abd_other_root(X, other)
        b = Brick(X2, d, [], L, L, f"StrongRealization({k}, Λ₁^({k})({alpha}, {beta}, δ)) followed by a regular 1-ABD")
    return b.check(), node


# ================================================================================================
# The chain block, the rooted seeds R_1..R_6 and RootedSeedRealization
# ================================================================================================

def chain_block(L: Sequence) -> Tuple[Optional[RT], str]:
    """Lemma lem:chain-block: requires lambda_0 + lambda_4 = lambda_1 + lambda_3."""
    l = [F(x) for x in L]
    if len(l) != 5 or not is_sorted_set(l):
        return None, "the chain block needs 5 distinct values"
    if l[0] + l[4] != l[1] + l[3]:
        return None, "the chain block needs λ₀ + λ₄ = λ₁ + λ₃"
    t = RT()
    r = t.add(l[2])
    a = t.add(l[1] + l[3] - l[2], r, l[1] * l[3] - l[0] * l[4])
    t.add(l[2], a, (l[2] - l[1]) * (l[3] - l[2]))
    return t, ""


def _adm(L) -> bool:
    return admissible(L)[0]


def arm_conditions(i: int, L: Sequence) -> List[dict]:
    """The conditions (C1)-(C6) of Lemma lem:six-arms that apply to R_i, each with its truth value."""
    l = [F(x) for x in L]
    gL, gR = l[1] - l[0], l[6] - l[5]
    mu_m, mu_p = l[0] + l[6] - l[5], l[0] + l[6] - l[1]
    Lm = [mu_m] + l[1:5]
    Lp = l[2:6] + [mu_p]
    out = []
    if i in (1, 2):
        out.append(dict(name="C1", text="λ₆ = λ₁ + λ₅ − λ₀", ok=l[6] == l[1] + l[5] - l[0]))
    if i in (2, 3, 5):
        out.append(dict(name="C2", text="λ₁ + λ₅ = λ₂ + λ₄", ok=l[1] + l[5] == l[2] + l[4]))
    if i in (3, 4, 5):
        out.append(dict(name="C3", text="γ_L ≠ γ_R", ok=gL != gR))
    if i in (3, 4):
        if gL > gR:
            out.append(dict(name="C4", text="μ₋ + λ₄ = λ₁ + λ₃", ok=mu_m + l[4] == l[1] + l[3]))
        elif gR > gL:
            out.append(dict(name="C4", text="λ₂ + μ₊ = λ₃ + λ₅", ok=l[2] + mu_p == l[3] + l[5]))
        else:
            out.append(dict(name="C4", text="needs γ_L ≠ γ_R", ok=False))
    if i == 5:
        if gL > gR:
            out.append(dict(name="C5", text="Λ₋ is admissible", ok=_adm(Lm)))
        elif gR > gL:
            out.append(dict(name="C5", text="Λ₊ is admissible", ok=_adm(Lp)))
        else:
            out.append(dict(name="C5", text="needs γ_L ≠ γ_R", ok=False))
    if i in (1, 4):
        out.append(dict(name="C6", text="{λ₁,…,λ₅} is admissible", ok=_adm(l[1:6])))
    if i == 6:
        out.append(dict(name="C6", text="Λ is admissible", ok=_adm(l)))
    return out


def rooted_seed_realization(i: int, L: Sequence) -> Tuple[Optional[RT], str]:
    """Algorithm RootedSeedRealization(i, A), lines 1-13."""
    l = [F(x) for x in L]
    if len(l) != 7 or not is_sorted_set(l):
        return None, "RootedSeedRealization needs 7 distinct values"
    conds = arm_conditions(i, l)
    failed = [c for c in conds if not c["ok"]]
    if failed:
        return None, "condition " + ", ".join(f"{c['name']} ({c['text']})" for c in failed) + f" of Lemma lem:six-arms fails for R_{i}"
    if i == 6:
        node = strong_realization(3, l)
        return node.X, node.fail
    A1 = l[1:6]
    if i in (1, 4):
        n1 = strong_realization(2, A1)
        M1, msg = n1.X, n1.fail
    else:
        M1, msg = chain_block(A1)
    if M1 is None:
        return None, msg
    if i in (1, 2):
        M0 = strong_realization(1, l[2:5]).X
    else:
        gL, gR = l[1] - l[0], l[6] - l[5]
        A0 = ([l[0] + l[6] - l[5]] + l[1:5]) if gL > gR else (l[2:6] + [l[0] + l[6] - l[1]])
        if i in (3, 4):
            M0, msg = chain_block(A0)
        else:
            n0 = strong_realization(2, A0)
            M0, msg = n0.X, n0.fail
        if M0 is None:
            return None, msg
    X, _, msg = phi(M0, M1, l[0])
    return X, msg


# Table tab:d7: for i <= j, (Lambda, lambda_7); Lambda' = {lambda_1, ..., lambda_7}, c = lambda_0 - 1.
TABLE_D7: Dict[Tuple[int, int], Tuple[List[int], int]] = {
    (1, 1): ([-4, 0, 2, 5, 9, 12, 16], 18), (1, 2): ([-3, 0, 2, 5, 9, 12, 15], 17), (1, 3): ([-5, 0, 4, 9, 15, 18, 23], 24),
    (1, 4): ([-4, 0, 4, 9, 15, 18, 22], 23), (1, 5): ([-5, 0, 4, 9, 15, 18, 23], 25), (1, 6): ([-4, 0, 4, 9, 15, 18, 22], 24),
    (2, 2): ([-3, 0, 2, 5, 9, 11, 14], 16), (2, 3): ([-3, 0, 2, 5, 9, 11, 14], 20), (2, 4): ([-4, 0, 2, 5, 9, 11, 15], 21),
    (2, 5): ([-4, 0, 3, 7, 12, 15, 19], 21), (2, 6): ([-4, 0, 4, 9, 15, 19, 23], 25), (3, 3): ([-7, 0, 2, 5, 9, 11, 14], 20),
    (3, 4): ([-8, 0, 2, 5, 9, 11, 15], 21), (3, 5): ([-9, 0, 3, 7, 12, 15, 19], 21), (3, 6): ([-10, 0, 4, 9, 15, 19, 23], 25),
    (4, 4): ([-10, 0, 4, 9, 15, 18, 22], 23), (4, 5): ([-11, 0, 4, 9, 15, 18, 23], 25), (4, 6): ([-10, 0, 4, 9, 15, 18, 22], 24),
    (5, 5): ([-2, 0, 3, 7, 12, 15, 19], 21), (5, 6): ([-2, 0, 4, 9, 15, 19, 23], 25), (6, 6): ([-2, 0, 4, 9, 15, 18, 22], 24),
}

BASE_OF_R = {1: "S3", 2: "P3", 3: "P3", 4: "S3", 5: "P3", 6: "S3"}   # the branch of depth 2 of R_i


# ================================================================================================
# Towers
# ================================================================================================

@dataclass
class Level:
    j: int
    A: List[F]
    X: Optional[RT]
    built_from: Optional[Tuple[int, int]] = None     # (j-2, j-1)
    blocks: Optional[Dict[str, List[int]]] = None    # ids of the copies of H_{j-2} and H_{j-1} inside X_j
    phi: Optional[PhiInfo] = None
    label: str = ""

    def to_json(self, with_matrix: bool = True) -> dict:
        out = dict(j=self.j, A=[fstr(x) for x in self.A], n=self.X.n if self.X else None, built_from=self.built_from,
                   blocks=self.blocks, phi=self.phi.to_json() if self.phi else None, label=self.label)
        if with_matrix and self.X is not None:
            out["tree"] = self.X.tree().edges()
            out["matrix"] = self.X.matrix_json()
        return out


def tower_chain(base: Tuple[str, int], A: Sequence, s: Sequence, k: int) -> Tuple[Optional[RT], List[Level], str]:
    """Algorithm TowerChain(H, A, s). base = ('S', h) for the base pair (S_{2h-3}, S_{2h-1}), or ('R', i) for the
    base pair (branch of depth 2 of R_i, R_i), with h = 3. s = (s_{h+1}, ..., s_k)."""
    kind, val = base
    h = val if kind == "S" else 3
    A = sorted(F(x) for x in A)
    if len(A) != 2 * h + 1:
        return None, [], f"the base set needs {2 * h + 1} values"
    s = [F(x) for x in s]
    if len(s) != k - h or any(x <= 0 for x in s):
        return None, [], f"the step sequence needs {k - h} positive entries"
    sets = {h: A, h - 1: A[1:-1]}
    for j in range(h + 1, k + 1):
        prev = sets[j - 1]
        sets[j] = [prev[0] - s[j - h - 1]] + prev + [prev[-1] + s[j - h - 1]]
    levels: Dict[int, Level] = {}
    if kind == "S":
        n0 = strong_realization(h - 1, sets[h - 1])
        n1 = strong_realization(h, sets[h])
        levels[h - 1] = Level(h - 1, sets[h - 1], n0.X, label=f"S_{2 * h - 3}")
        levels[h] = Level(h, sets[h], n1.X, label=f"S_{2 * h - 1}")
        msg = n0.fail or n1.fail
    else:
        i = val
        Xh, msg = rooted_seed_realization(i, sets[h])
        if BASE_OF_R[i] == "P3":
            Xb, msg2 = chain_block(sets[h - 1])
        else:
            nb = strong_realization(2, sets[h - 1])
            Xb, msg2 = nb.X, nb.fail
        levels[h - 1] = Level(h - 1, sets[h - 1], Xb, label="P_3" if BASE_OF_R[i] == "P3" else "S_3")
        levels[h] = Level(h, sets[h], Xh, label=f"R_{i}")
        msg = msg or msg2
    if levels[h - 1].X is None or levels[h].X is None:
        return None, list(levels.values()), msg or "a base realization failed"
    for j in range(h + 1, k + 1):
        X, info, m = phi(levels[j - 2].X, levels[j - 1].X, sets[j][0])
        if X is None:
            levels[j] = Level(j, sets[j], None, (j - 2, j - 1))
            return None, [levels[x] for x in sorted(levels)], m
        levels[j] = Level(j, sets[j], X, (j - 2, j - 1), dict(left=info.left, right=info.right), info, label=f"H_{j}")
    return levels[k].X, [levels[x] for x in sorted(levels)], ""


def tower_sets(tl_h: List[F], e: F, h: int, k: int) -> Tuple[Dict[int, List[F]], Dict[int, List[F]], Dict[int, F]]:
    """The sets of equations (eq:steps), (eq:sigma-def) and (eq:sigma-twin)."""
    tl = {h: sorted(tl_h), h - 1: sorted(tl_h)[1:-1]}
    ell: Dict[int, F] = {h + 1: e - tl[h][-1], h + 2: tl[h - 1][0] - tl[h][0]}
    for j in range(h + 3, k + 3):
        ell[j] = ell[j - 2]
    for j in range(h + 1, k + 1):
        p = tl[j - 1]
        tl[j] = [p[0] - ell[j]] + p + [p[-1] + ell[j]]
    tlp = {}
    for j in range(h, k + 1):
        tlp[j] = tl[j][1:] + [tl[j][-1] + ell[j + 1]]
    return tl, tlp, ell


def tower_seed_brick(kind: str, a: int, b: Optional[int], k: int, even: bool,
                     table_row: Optional[Tuple[List, int]] = None, alpha=0, beta=None) -> Tuple[Optional[Brick], dict]:
    """Bricks of S^{(i,j)}_{2k+1}, S^{(i,j)}_{2k+2} (kind 'R', towers over R_a and R_b) and S^{[b]} (kind 'B', b = a)
    by Proposition prop:tower-bricks and the proof of Theorem many_seeds.

    For kind 'R' and odd diameter the pair is unordered; for even diameter (a, b) is ordered and the tower
    over R_b is the duplicated one. The prescribed sets come from Table tab:d7 (or `table_row`)."""
    info: dict = dict(kind=kind, a=a, b=b, k=k, even=even)
    if kind == "R":
        lo, hi = min(a, b), max(a, b)
        row = table_row or TABLE_D7[(lo, hi)]
        Lam, l7 = [F(x) for x in row[0]], F(row[1])
        h = 3
        tl, tlp, ell = tower_sets(Lam, l7, h, k)
        X, lev, m1 = tower_chain(("R", lo), tl[h], [ell[j] for j in range(h + 1, k + 1)], k)
        Xp, levp, m2 = tower_chain(("R", hi), tlp[h], [ell[j] for j in range(h + 2, k + 2)], k)
        info.update(first=f"R̂_{lo}", second=f"R̂_{hi}", Lambda=[fstr(x) for x in Lam], e=fstr(l7))
        center_first = (a == lo)     # for even diameters the center is the root of the tower over R_a
    else:
        bb = a
        h = bb
        if beta is None:
            beta = 2 ** k
        delta = default_delta(k, alpha, beta)
        L1 = lambda_1(bb, alpha, beta, delta)
        L2 = lambda_2(bb, alpha, beta, delta)
        tl, tlp, ell = tower_sets(L1, L2[-1], h, k)
        X, lev, m1 = tower_chain(("S", bb), tl[h], [ell[j] for j in range(h + 1, k + 1)], k)
        Xp, levp, m2 = tower_chain(("S", bb), tlp[h], [ell[j] for j in range(h + 2, k + 2)], k)
        info.update(first=f"B̂_{bb}", second=f"B̂_{bb}", Lambda=[fstr(x) for x in L1], e=fstr(L2[-1]))
        center_first = True
    info["levels"] = [lv.to_json(with_matrix=False) for lv in lev]
    info["levels_twin"] = [lv.to_json(with_matrix=False) for lv in levp]
    if X is None or Xp is None:
        info["fail"] = m1 or m2
        return None, info
    c = tl[k][0] - 1
    first, second = (X, Xp) if center_first or not even else (Xp, X)
    M, pinfo, m3 = phi(first, second, c)
    if M is None:
        info["fail"] = m3
        return None, info
    # Lemma lem:join: Z = {c} u A_1 u {a + b - c}; both orientations are covered by the candidates below
    Z = sorted(set([c] + tl[k] + tlp[k] + [tl[k][0] + tlp[k][-1] - c]))
    other = first.n
    info.update(c=fstr(c), Z=[fstr(x) for x in Z], phi=pinfo.to_json() if pinfo else None)
    if not even:
        br = Brick(M, 2 * k + 1, [other], Z, Z, "Proposition prop:tower-bricks: φ(TowerChain(H, …), TowerChain(H′, …), c)")
    else:
        M2 = abd_other_root(M, other)
        br = Brick(M2, 2 * k + 2, [], Z, Z, "Proposition prop:tower-bricks and a regular 1-ABD of the tower at the other main root")
    return br.check(), info


# ================================================================================================
# Seeds of diameter 6 (derived from the arm realizations)
# ================================================================================================

def seed6_brick(i: int, row: Optional[Tuple[List, int]] = None) -> Tuple[Optional[Brick], dict]:
    """A brick of S_6^(i), i <= 6: RootedSeedRealization(i, Λ) on R_i with Λ from the row (i, i) of Table tab:d7,
    followed by a regular 1-ABD of the unique deepest branch of R_i. Derived from Chapter 5, verified here."""
    Lam = [F(x) for x in (row or TABLE_D7[(i, i)])[0]]
    X, msg = rooted_seed_realization(i, Lam)
    if X is None:
        return None, dict(fail=msg)
    depths = {}
    for c in X.children[0]:
        sub = RT()
        # depth of the branch rooted at c
        dep = 0
        frontier = [c]
        while frontier:
            nxt = [g for v in frontier for g in X.children[v]]
            if nxt:
                dep += 1
            frontier = nxt
        depths[c] = dep
    dmax = max(depths.values())
    deep = [c for c, dd in depths.items() if dd == dmax]
    if len(deep) != 1:
        return None, dict(fail="R_i has two deepest branches")
    M = abd_other_root(X, deep[0])
    br = Brick(M, 6, [], Lam, Lam, f"RootedSeedRealization({i}, Λ) and a regular 1-ABD of the deepest branch (derived, verified)")
    return br.check(), dict(Lambda=[fstr(x) for x in Lam])


# ================================================================================================
# Views for the laboratory: the levels of a tower, with the copies of the base levels (blocks)
# ================================================================================================

def tower_view(base: Tuple[str, int], A: Sequence, s: Sequence, k: int, max_draw: int = 150) -> dict:
    """TowerChain with, for every level, the tree, the matrix (when small), and the decomposition of the level
    into copies of the two base levels: the compact view of the thesis figure."""
    X, levels, msg = tower_chain(base, A, s, k)
    out_levels = []
    origin: Dict[int, List[Tuple[int, int]]] = {}      # level j -> per vertex (base level, copy index)
    copies: Dict[int, List[dict]] = {}                  # level j -> list of copies {base, vertices, root}
    seams: Dict[int, List[Tuple[int, int, int]]] = {}   # level j -> (copy a, copy b, level where the seam was created)
    for lv in levels:
        j = lv.j
        if lv.X is None:
            out_levels.append(dict(lv.to_json(with_matrix=False), ok=False))
            continue
        if lv.built_from is None:
            origin[j] = [(j, 0)] * lv.X.n
            copies[j] = [dict(base=j, label=lv.label, set=[fstr(x) for x in lv.A], vertices=list(range(lv.X.n)), root=0)]
            seams[j] = []
        else:
            a, b = lv.built_from
            ma, mb = lv.phi.map_left, lv.phi.map_right
            na = len(copies[a])
            orig = [None] * lv.X.n
            for old, new in ma.items():
                orig[new] = origin[a][old]
            for old, new in mb.items():
                base_j, c = origin[b][old]
                orig[new] = (base_j, c + na)
            origin[j] = orig
            cps = []
            for c in copies[a]:
                cps.append(dict(c, vertices=[ma[v] for v in c["vertices"]], root=ma[c["root"]]))
            for c in copies[b]:
                cps.append(dict(c, vertices=[mb[v] for v in c["vertices"]], root=mb[c["root"]]))
            copies[j] = cps
            # the copy that contains the root of the second argument is joined to the copy containing the root 0
            root_copy_b = next(i for i, c in enumerate(copies[b]) if 0 in c["vertices"]) + na
            root_copy_a = next(i for i, c in enumerate(copies[a]) if 0 in c["vertices"])
            seams[j] = list(seams[a]) + [(x + na, y + na, lvl) for x, y, lvl in seams[b]] + [(root_copy_a, root_copy_b, j)]
        ent = lv.to_json(with_matrix=lv.X.n <= 64)
        ent.update(ok=True, copies=[dict(base=c["base"], label=c["label"], set=c["set"], vertices=c["vertices"], root=c["root"]) for c in copies[j]],
                   seams=[dict(a=x, b=y, level=l) for x, y, l in seams[j]],
                   draw=lv.X.n <= max_draw, origin=[f"{bj}:{c}" for bj, c in origin[j]])
        from .trees import Layout, Tree as _Tree, tree_info
        if lv.X.n <= max_draw:
            ent["tree"] = tree_info(lv.X.tree(), roots=[0])
        else:
            ent.pop("tree", None)
        # compact view: the tree of copies, drawn with the same convention, rooted at the copy of the root
        nb = len(copies[j])
        if nb == 1:
            ent["block_layout"] = {"0": [0.0, 0.0]}
        else:
            bt = _Tree.from_edges(nb, [(x, y) for x, y, _ in seams[j]])
            rc = next(i for i, c in enumerate(copies[j]) if 0 in c["vertices"])
            L = Layout(bt)
            L.rooted(rc)
            ent["block_layout"] = {str(v): [round(x, 4), round(y, 4)] for v, (x, y) in L.pos.items()}
        out_levels.append(ent)
    return dict(ok=X is not None, fail=msg, levels=out_levels)
