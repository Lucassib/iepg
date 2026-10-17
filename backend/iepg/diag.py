"""The eigenvalue location algorithm Diagonalize (Jacobs and Trevisan), temporary values, the temporary zero
set Z(M), latent and confined latent values, and bricks, exactly as in the thesis.

Algorithm Diagonalize(M, x) (Chapter 2), vertices in a bottom-up order v_1, ..., v_n:
  1  initialize d_i := m_ii + x for all i
  2  for k = 1 to n
  3    if v_k has no children then continue
  4    else if d_c != 0 for all children c of v_k then
  5      d_k := d_k - sum (m_ck)^2 / d_c over the children
  6    else
  7      select a child v_j of v_k with d_j = 0
  8      d_k := -(m_jk)^2 / 2
  9      d_j := 2
 10      if v_k has a parent v_l then remove the edge {v_k, v_l}
 11  end loop
The output is congruent to M + xI. The temporary value of v is the value it holds at the moment it is
processed, the final value is the value at the end; they differ only for the child selected at line 7.
We run Diagonalize(M, -lambda), so that zeros count the multiplicity of lambda.

All arithmetic is exact: rationals as Fraction, algebraic eigenvalues through sympy (CRootOf) with zero
tests done by polynomial divisibility.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from typing import Dict, List, Optional, Sequence, Tuple

import sympy as sp

from .trees import Tree, TreeError

x = sp.symbols("x")


MAX_RATIONAL_CHARS = 80  # an input number: p/q with numerator and denominator of up to about 40 digits


def frac(s) -> Fraction:
    if isinstance(s, Fraction):
        return s
    if isinstance(s, int):
        return Fraction(s)
    if s is None or isinstance(s, (bool, list, dict)):
        raise TreeError(f"'{s}' is not a rational number (write p/q)")
    s = str(s).strip()
    if len(s) > MAX_RATIONAL_CHARS:
        raise TreeError(f"a rational number is limited to {MAX_RATIONAL_CHARS} characters")
    try:
        return Fraction(s)
    except Exception as e:  # noqa: BLE001
        raise TreeError(f"'{s}' is not a rational number (write p/q)") from e


def fstr(q: Fraction) -> str:
    return str(q.numerator) if q.denominator == 1 else f"{q.numerator}/{q.denominator}"


@dataclass
class Matrix:
    """A matrix in S(T): diagonal entries and the squares of the off-diagonal entries (all rational)."""
    diag: Dict[int, Fraction]
    w2: Dict[Tuple[int, int], Fraction]   # key (min, max)

    @staticmethod
    def parse(t: Tree, data: dict) -> "Matrix":
        if not isinstance(data, dict) or not isinstance(data.get("diag", {}), dict) or not isinstance(data.get("w2", {}), dict):
            raise TreeError("give the matrix as {'diag': {vertex: value}, 'w2': {'u-v': square of the weight}}")
        diag = {}
        for v in range(t.n):
            key = str(v)
            if key not in data.get("diag", {}):
                raise TreeError(f"missing diagonal entry for vertex {v}")
            diag[v] = frac(data["diag"][key])
        w2 = {}
        for u, v in t.edges():
            key = f"{u}-{v}"
            if key not in data.get("w2", {}):
                raise TreeError(f"missing weight for edge {key}")
            val = frac(data["w2"][key])
            if val <= 0:
                raise TreeError(f"the square of the weight of edge {key} must be positive")
            w2[(u, v)] = val
        return Matrix(diag, w2)

    def w(self, u: int, v: int) -> Fraction:
        return self.w2[(u, v) if u < v else (v, u)]

    def to_json(self) -> dict:
        return dict(diag={str(v): fstr(q) for v, q in self.diag.items()},
                    w2={f"{u}-{v}": fstr(q) for (u, v), q in self.w2.items()})

    def sympy_matrix(self, t: Tree) -> sp.Matrix:
        M = sp.zeros(t.n, t.n)
        for v, q in self.diag.items():
            M[v, v] = sp.Rational(q.numerator, q.denominator)
        for (u, v), q in self.w2.items():
            w = sp.sqrt(sp.Rational(q.numerator, q.denominator))
            M[u, v] = w
            M[v, u] = w
        return M


# ------------------------------------------------------------------------------------------------
# Diagonalize with rational lambda, with the full trace
# ------------------------------------------------------------------------------------------------

def bottom_up_order(t: Tree, root: int) -> Tuple[List[int], List[Optional[int]], List[List[int]]]:
    par = t.parents(root)
    ch = t.children(root)
    order: List[int] = []
    st = [(root, False)]
    while st:
        v, done = st.pop()
        if done:
            order.append(v)
            continue
        st.append((v, True))
        for c in sorted(ch[v], reverse=True):
            st.append((c, False))
    return order, par, ch


@dataclass
class Step:
    k: int
    vertex: int
    line: int                      # 3, 5 or 8 (the line that determines the value of v_k)
    hat_d: Fraction
    final_d: Fraction = Fraction(0)
    consumed_child: Optional[int] = None
    cut_edge: Optional[Tuple[int, int]] = None
    d_after: Dict[int, Fraction] = field(default_factory=dict)


@dataclass
class Run:
    order: List[int]
    steps: List[Step]
    final: Dict[int, Fraction]
    hat: Dict[int, Fraction]
    zeros: int
    positives: int
    negatives: int

    @property
    def temporary_zeros(self) -> List[int]:
        return sorted(v for v, q in self.hat.items() if q == 0)

    def to_json(self) -> dict:
        return dict(
            order=self.order,
            steps=[dict(k=s.k, vertex=s.vertex, line=s.line, hat_d=fstr(s.hat_d), final_d=fstr(s.final_d),
                        consumed_child=s.consumed_child, cut_edge=list(s.cut_edge) if s.cut_edge else None,
                        d_after={str(v): fstr(q) for v, q in s.d_after.items()}) for s in self.steps],
            final={str(v): fstr(q) for v, q in self.final.items()},
            temporary_zeros=self.temporary_zeros,
            zeros=self.zeros, positives=self.positives, negatives=self.negatives,
            in_Z=any(q == 0 for q in self.hat.values()),
        )


def diagonalize(t: Tree, root: int, M: Matrix, lam: Fraction) -> Run:
    """Diagonalize(M, -lam) with the trace of every step."""
    order, par, ch = bottom_up_order(t, root)
    d: Dict[int, Fraction] = {v: M.diag[v] - lam for v in range(t.n)}     # line 1 with x = -lam
    cut = set()                                                             # edges removed at line 10
    hat: Dict[int, Fraction] = {}
    steps: List[Step] = []
    for k, v in enumerate(order, start=1):
        kids = [c for c in ch[v] if (c, v) not in cut]
        if not ch[v]:
            line = 3
        elif all(d[c] != 0 for c in kids):
            line = 5
            d[v] = d[v] - sum(M.w(c, v) / d[c] for c in kids)
        else:
            line = 8
        consumed = None
        cut_edge = None
        if line == 8:
            consumed = min(c for c in kids if d[c] == 0)   # line 7: deterministic choice, the result does not depend on it
            d[v] = -M.w(consumed, v) / 2                    # line 8
            d[consumed] = Fraction(2)                       # line 9
            if par[v] is not None:                          # line 10
                cut.add((v, par[v]))
                cut_edge = (v, par[v])
        hat[v] = d[v]
        steps.append(Step(k=k, vertex=v, line=line, hat_d=d[v], consumed_child=consumed, cut_edge=cut_edge, d_after=dict(d)))
    for s in steps:
        s.final_d = d[s.vertex]
    zeros = sum(1 for q in d.values() if q == 0)
    pos = sum(1 for q in d.values() if q > 0)
    neg = sum(1 for q in d.values() if q < 0)
    return Run(order=order, steps=steps, final=dict(d), hat=hat, zeros=zeros, positives=pos, negatives=neg)


def multiplicity(t: Tree, root: int, M: Matrix, lam: Fraction) -> int:
    return diagonalize(t, root, M, lam).zeros


# ------------------------------------------------------------------------------------------------
# Characteristic polynomials of rooted subtrees (Schur recursion, exact)
# ------------------------------------------------------------------------------------------------

def _poly(coeffs: Sequence[Fraction]) -> sp.Poly:
    return sp.Poly([sp.Rational(c.numerator, c.denominator) for c in reversed(list(coeffs))], x, domain="QQ")


def subtree_charpolys(t: Tree, root: int, M: Matrix) -> Dict[int, sp.Poly]:
    """p_w(x) = det(xI - M[T_w]) for every vertex w, T_w the subtree rooted at w (root = whole tree)."""
    order, par, ch = bottom_up_order(t, root)
    P: Dict[int, sp.Poly] = {}
    for v in order:
        prod = sp.Poly(1, x, domain="QQ")
        for c in ch[v]:
            prod = prod * P[c]
        res = sp.Poly(x - sp.Rational(M.diag[v].numerator, M.diag[v].denominator), x, domain="QQ") * prod
        for c in ch[v]:
            other = sp.Poly(1, x, domain="QQ")
            for c2 in ch[v]:
                if c2 != c:
                    other = other * P[c2]
            for g in ch[c]:
                other = other * P[g]
            w2 = M.w(c, v)
            res = res - sp.Poly(sp.Rational(w2.numerator, w2.denominator), x, domain="QQ") * other
        P[v] = res
    return P


def real_roots(p: sp.Poly) -> List[sp.Expr]:
    """Distinct real roots of a rational polynomial, exact (rationals or CRootOf)."""
    out = []
    for r in sp.Poly(p, x).real_roots():
        if r not in out:
            out.append(r)
    return out


def num_json(r: sp.Expr) -> dict:
    return dict(exact=sp.srepr(r) if not r.is_Rational else str(r), approx=float(sp.N(r, 15)), display=str(r) if r.is_Rational else str(sp.N(r, 8)))


def _minpoly(r: sp.Expr) -> sp.Poly:
    if r.is_Rational:
        return sp.Poly(x - r, x, domain="QQ")
    return sp.Poly(sp.minimal_polynomial(r, x), x, domain="QQ")


# ------------------------------------------------------------------------------------------------
# Temporary zeros at an algebraic lambda (polynomial version of Diagonalize)
# ------------------------------------------------------------------------------------------------

def temporary_zeros_at(t: Tree, root: int, M: Matrix, lam: sp.Expr) -> List[int]:
    """Vertices with temporary value zero in Diagonalize(M, -lam), for a rational or algebraic lam.

    The temporary value of v is a rational function N_v(lam)/D_v(lam) built by the same recursion as the
    algorithm; a test 'value = 0' is 'minpoly(lam) divides N_v'. The result does not depend on the choice
    at line 7 (Chapter 3)."""
    if lam.is_Rational:
        run = diagonalize(t, root, M, Fraction(int(lam.p), int(lam.q)))
        return run.temporary_zeros
    mp = _minpoly(lam)
    order, par, ch = bottom_up_order(t, root)
    N: Dict[int, sp.Poly] = {}
    D: Dict[int, sp.Poly] = {}
    zero: Dict[int, bool] = {}
    cut = set()
    one = sp.Poly(1, x, domain="QQ")
    for v in order:
        kids = [c for c in ch[v] if (c, v) not in cut]
        if any(zero[c] for c in kids):          # line 8: value -w^2/2, never zero
            N[v] = sp.Poly(-1, x, domain="QQ")
            D[v] = one
            zero[v] = False
            if par[v] is not None:
                cut.add((v, par[v]))
            continue
        # line 5 (or 3): value = m_vv - lam - sum w2_c * D_c / N_c
        num = sp.Poly(sp.Rational(M.diag[v].numerator, M.diag[v].denominator) - x, x, domain="QQ")
        den = one
        for c in kids:
            num = num * N[c]
            den = den * N[c]
        for c in kids:
            w2 = M.w(c, v)
            term = sp.Poly(sp.Rational(w2.numerator, w2.denominator), x, domain="QQ") * D[c]
            for c2 in kids:
                if c2 != c:
                    term = term * N[c2]
            num = num - term
        N[v], D[v] = num, den
        zero[v] = (num.rem(mp)).is_zero
    return sorted(v for v in order if zero[v])


# ------------------------------------------------------------------------------------------------
# Z(M), latent values, confined latent values, bricks (Chapters 3 and 5)
# ------------------------------------------------------------------------------------------------

@dataclass
class LatentReport:
    dspec: List[sp.Expr]
    Z: List[sp.Expr]
    latent: List[sp.Expr]
    confined: List[sp.Expr]
    witnesses: Dict[str, List[int]]
    is_brick: bool
    bound: int
    q_M: int
    reason: str

    def to_json(self) -> dict:
        return dict(dspec=[num_json(r) for r in self.dspec], Z=[num_json(r) for r in self.Z],
                    latent=[num_json(r) for r in self.latent], confined=[num_json(r) for r in self.confined],
                    witnesses=self.witnesses, is_brick=self.is_brick, bound=self.bound, q_M=self.q_M, reason=self.reason)


def _sorted_reals(vals) -> List[sp.Expr]:
    return sorted(vals, key=lambda r: float(sp.N(r, 20)))


def latent_report(t: Tree, root: int, M: Matrix) -> LatentReport:
    """Z(M) is the set of lambda with a temporary zero somewhere (Definition of the set of temporary zeros);
    lambda is in Z(M) iff lambda is an eigenvalue of M[T_w] for some subtree T_w (the two facts in the
    proof of the brick equivalence theorem). Latent values: Z(M) minus DSpec(M). A latent value is
    confined if all its temporary zeros sit at a main root other than the chosen root. A brick has
    q(M) = d + 1 and all latent values confined."""
    P = subtree_charpolys(t, root, M)
    dspec = real_roots(P[root])
    Z: List[sp.Expr] = list(dspec)
    for w, p in P.items():
        if w == root:
            continue
        for r in real_roots(p):
            if r not in Z:
                Z.append(r)
    Z = _sorted_reals(Z)
    latent = [r for r in Z if r not in dspec]
    main_roots = set(t.main_roots())
    other_roots = main_roots - {root}
    witnesses: Dict[str, List[int]] = {}
    confined = []
    for r in latent:
        tz = temporary_zeros_at(t, root, M, r)
        witnesses[num_json(r)["display"]] = tz
        if tz and all(v in other_roots for v in tz):
            confined.append(r)
    d = t.diameter()
    q_M = len(dspec)
    is_brick = (q_M == d + 1) and len(confined) == len(latent)
    if is_brick:
        reason = f"q(M) = {q_M} = d + 1 and every latent value is confined."
    elif q_M != d + 1:
        reason = f"q(M) = {q_M} is not d + 1 = {d + 1}."
    else:
        bad = [r for r in latent if r not in confined]
        r0 = bad[0]
        reason = f"the latent value {num_json(r0)['display']} has a temporary zero at vertex {witnesses[num_json(r0)['display']][0]}, which is not a main root other than the root."
    return LatentReport(dspec=dspec, Z=Z, latent=latent, confined=confined, witnesses=witnesses,
                        is_brick=is_brick, bound=len(Z) - len(confined), q_M=q_M, reason=reason)


def dspec_of(t: Tree, root: int, M: Matrix) -> List[sp.Expr]:
    return real_roots(subtree_charpolys(t, root, M)[root])


def spectrum_with_multiplicities(t: Tree, root: int, M: Matrix) -> List[Tuple[sp.Expr, int]]:
    p = subtree_charpolys(t, root, M)[root]
    out = []
    for r in real_roots(p):
        m = 0
        q = p
        while True:
            quo, rem = q.div(_minpoly(r))
            if not rem.is_zero:
                break
            q = quo
            m += 1
        out.append((r, m))
    return out
