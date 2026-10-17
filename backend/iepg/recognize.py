"""Seeds of the thesis beyond the catalog: S_d (Definition def:Sd), the seeds S^(i,j)_d and S^[b]_d of
Theorem many_seeds (Definition def:tower) and the five families of Definition def_seeds. A seed is recognized
by rebuilding the seeds of its diameter and comparing canonical forms."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from . import labels
from .catalog import transport, tree_iso
from .diag import Matrix
from .realize import Brick, realize_S_d, tower_seed_brick
from .trees import S_seed, Tree, def_seeds_families as _families

# beyond this diameter none of these seeds has at most MAX_N vertices, and building them is exponential in d
MAX_D = 16


@dataclass
class Recognized:
    family: str              # 'S_d', 'tower' or 'def_seeds'
    name: str                # plain text, e.g. S^(3,5)_9
    label: str               # TeX
    brick: Optional[Matrix]  # on the vertices of the seed that was recognized, or None
    thesis: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    summary: str = ""


def _on_seed(b: Optional[Brick], seed: Tree) -> Optional[Matrix]:
    if b is None or b.verification is None or not b.verification.is_brick:
        return None
    phi = tree_iso(b.X.tree(), seed)
    return transport(b.X.matrix(), phi) if phi is not None else None


def _S_d(seed: Tree, d: int) -> Optional[Recognized]:
    if S_seed(d).to_tree()[0].canonical() != seed.canonical():
        return None
    b, _ = realize_S_d(d)
    R = labels.ref
    return Recognized("S_d", f"S_{d}", f"S_{{{d}}}", _on_seed(b, seed), thesis=[R("def:Sd"), R("cor:odd-diminimal"), R("prop:algorithms")],
                      references=["allem2023diminimal"],
                      summary=(f"This seed is S_{d} ({R('def:Sd')}). It is diminimal by {R('cor:odd-diminimal')}, first proved by Allem, Braga, Hoppen, "
                               f"Oliveira, Sibemberg and Trevisan (2023), and RealizeTree ({R('prop:algorithms')}) computes its brick."))


def _towers(seed: Tree, d: int) -> Optional[Recognized]:
    even = d % 2 == 0
    k = (d - 2) // 2 if even else (d - 1) // 2
    if k < 3:
        return None
    target = seed.canonical()
    R = labels.ref
    cands = [("R", i, j) for i in range(1, 7) for j in range(1 if even else i, 7)] + [("B", b, None) for b in range(4, k + 1)]
    for kind, a, b in cands:
        brick, _ = tower_seed_brick(kind, a, b, k, even)
        if brick is None or brick.X.tree().canonical() != target:
            continue
        if kind == "R":
            name, label, base = f"S^({a},{b})_{d}", f"S^{{({a},{b})}}_{{{d}}}", f"the towers of depth {k} over R_{a} and R_{b}"
        else:
            name, label, base = f"S^[{a}]_{d}", f"S^{{[{a}]}}_{{{d}}}", f"towers of depth {k} over the base pair (S_{2 * a - 3}, S_{2 * a - 1})"
        return Recognized("tower", name, label, _on_seed(brick, seed), thesis=[R("many_seeds"), R("def:tower"), R("prop:tower-bricks"), R("thm:brick-diminimal")],
                          summary=(f"This seed is {name} of {R('def:tower')}, built from {base}. It is one of the seeds of {R('many_seeds')}: "
                                   + (f"the proof of {R('many_seeds')} gives it a brick, from a brick of {R('prop:tower-bricks')} by a regular 1-ABD"
                                      if even else f"{R('prop:tower-bricks')} gives it a brick")
                                   + f", so it is diminimal by {R('thm:brick-diminimal')}."))
    return None


def _def_seeds(seed: Tree, d: int) -> Optional[Recognized]:
    target = seed.canonical()
    R = labels.ref
    for name, tex, rooted in _families(d):
        if rooted.to_tree()[0].canonical() != target:
            continue
        first = name in ("S'", "S''")
        return Recognized("def_seeds", f"{name}_{d}", f"{tex}_{{{d}}}", None, thesis=[R("def_seeds"), R("thm:brick-diminimal")],
                          references=["allem2023diminimal"] if first else [],
                          summary=(f"This seed is {name}_{d} of {R('def_seeds')}. "
                                   + ("It was first proved diminimal by Allem, Braga, Hoppen, Oliveira, Sibemberg and Trevisan (2023). " if first else "")
                                   + f"The thesis shows, after {R('def_seeds')}, that every seed of that definition admits a brick, so it is diminimal "
                                     f"by {R('thm:brick-diminimal')}. This version of the site does not compute that brick."))
    return None


def recognize(seed: Tree) -> Optional[Recognized]:
    d = seed.diameter()
    if d < 4 or d > MAX_D:
        return None
    return _S_d(seed, d) or _towers(seed, d) or _def_seeds(seed, d)
