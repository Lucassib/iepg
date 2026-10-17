"""Algorithm RealizeTree(T, alpha, beta) of Section sec:alg (Proposition prop:algorithms), line by line:
for a tree T in the family of S_d, a matrix M in S(T) with q(M) = d + 1 = q(T)."""
from __future__ import annotations

from .catalog import transport, tree_iso
from .diag import Matrix
from .fold import fold_to_seed, unfold_realization
from .realize import realize_S_d
from .trees import Tree, TreeError


def realize_tree(t: Tree, alpha=0, beta=None) -> Matrix:
    d = t.diameter()
    # line 1: FoldToSeed(T), the seed T_0 and the branches U'_1, ..., U'_N
    steps = fold_to_seed(t)
    seed = steps[-1].tree
    # lines 2-5: k = ceil(d/2), X = StrongRealization(k, Lambda_1^(k)(alpha, beta)), and for even d
    # the regular 1-ABD of X duplicating the branch at v that contains the other main root
    brick, _ = realize_S_d(d, alpha, beta)
    if brick is None:
        raise TreeError("StrongRealization failed on the explicit admissible set")
    phi = tree_iso(brick.X.tree(), seed)
    if phi is None:
        raise TreeError(f"the seed of T is not S_{d}")
    M0 = transport(brick.X.matrix(), phi)
    # lines 6-8: for i = 1, ..., N, the regular 1-ABD of M_{i-1} with U'_i as the new copy
    return unfold_realization(steps, M0)
