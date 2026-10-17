"""Adherence tests: each one reproduces a number or an example of the thesis (webapp_spec/10_checklist_aderencia.md)."""
from fractions import Fraction as F

import pytest
from fastapi.testclient import TestClient

from iepg.catalog import catalog, rooted_seeds_of_depth
from iepg.diag import Matrix, diagonalize, latent_report, spectrum_with_multiplicities
from iepg.fold import fold_to_seed, regular_abd, unfold_realization
from iepg.main import app
from iepg.trees import S_d_tree, Tree, barioli_fallat, parse_edges, parse_prufer, whirl

client = TestClient(app)


def test_counts_of_rooted_seeds():
    # E_0, ..., E_3 = 1, 1, 2, 12 (equation 1.4 of the thesis)
    assert [len(rooted_seeds_of_depth(k)) for k in range(4)] == [1, 1, 2, 12]


def test_seed_counts_small_diameters():
    cat = catalog()
    by_d = {}
    for e in cat.seeds.values():
        by_d[e["diameter"]] = by_d.get(e["diameter"], 0) + 1
    assert by_d[2] == 1 and by_d[3] == 1 and by_d[4] == 2 and by_d[5] == 3 and by_d[6] == 12 and by_d[7] == 78


def test_diameter_6_classification():
    cat = catalog()
    for i in range(1, 13):
        e = cat.seeds[f"S6_{i}"]
        assert e["status"] == ("diminimal" if i <= 6 else "defective")
        assert e["tree"]["diameter"] == 6
    assert sum(1 for r in cat.rooted.values() if r["good"]) == 6


def test_diameter_7_classification_and_bricks():
    cat = catalog()
    n_dim = 0
    for i in range(1, 13):
        for j in range(i, 13):
            e = cat.seeds[f"R{i}xR{j}"]
            assert e["tree"]["diameter"] == 7
            if i <= 6 and j <= 6:
                assert e["status"] == "diminimal" and e["certificate"]["kind"] == "brick"
                t = Tree.from_edges(e["tree"]["n"], [tuple(x) for x in e["tree"]["edges"]])
                M = Matrix.parse(t, e["certificate"]["brick"]["matrix"])
                rep = latent_report(t, e["certificate"]["brick"]["root"], M)
                assert rep.is_brick and rep.q_M == 8
                n_dim += 1
            else:
                assert e["status"] == "defective" and e["certificate"]["kind"] == "propagation"
    assert n_dim == 21
    assert not any("WARNING" in line for line in cat.log), cat.log


def test_S_d_sizes_and_linearity():
    for d in range(1, 12):
        t, r, dashed = S_d_tree(d)
        expected = 2 ** ((d + 1) // 2) if d % 2 else 3 * 2 ** (d // 2 - 1)
        assert t.n == expected and t.diameter() == d and t.is_seed()
        assert t.is_linear() == (d <= 7)


def test_barioli_fallat_and_whirls():
    bf = barioli_fallat()
    assert bf.n == 16 and bf.diameter() == 6 and not bf.is_seed()
    assert fold_to_seed(bf)[-1].tree.canonical() == catalog().seeds["S6_11"]["canonical"]
    w = whirl(3)
    assert w.n == 6 * 3 + 4 and w.diameter() == 2 * 3 + 2


def test_diagonalize_counts_multiplicities():
    t = parse_edges("0-1,0-2,0-3,1-4,1-5")
    M = Matrix({v: F(0) for v in range(t.n)}, {e: F(1) for e in t.edges()})
    for lam in (F(0), F(1), F(-1), F(2), F(1, 2)):
        run = diagonalize(t, 0, M, lam)
        mult = dict(spectrum_with_multiplicities(t, 0, M))
        exact = [m for r, m in mult.items() if r == lam]
        assert run.zeros == (exact[0] if exact else 0)
        assert run.zeros + run.positives + run.negatives == t.n


def test_regular_abd_preserves_dspec_of_a_brick():
    cat = catalog()
    e = cat.seeds["R2xR5"]
    t = Tree.from_edges(e["tree"]["n"], [tuple(x) for x in e["tree"]["edges"]])
    M = Matrix.parse(t, e["certificate"]["brick"]["matrix"])
    r, u = e["certificate"]["brick"]["root"], e["certificate"]["brick"]["other_main_root"]
    leaf = next(w for w in t.adj[r] if w != u and t.rooted_depth(w, r) == 0)
    t2, M2, _, _ = regular_abd(t, M, r, leaf, 2)
    rep, rep2 = latent_report(t, r, M), latent_report(t2, r, M2)
    assert [str(x) for x in rep2.dspec] == [str(x) for x in rep.dspec] and rep2.is_brick


def test_analyze_unfolding_of_a_diminimal_seed_gets_a_realization():
    r = client.post("/api/v1/trees/analyze", json={"tree": {"format": "catalog", "data": "S6_2"}}).json()
    assert r["seed_status"] == "diminimal" and r["q_exact"]["value"] == 7
    # duplicate a branch of the seed: the realization is transported by a regular 1-ABD
    t = Tree.from_edges(r["tree"]["n"], [tuple(x) for x in r["tree"]["edges"]])
    c = t.main_roots()[0]
    leafish = min(t.adj[c], key=lambda w: t.rooted_depth(w, c))
    M0 = Matrix({v: F(0) for v in range(t.n)}, {e: F(1) for e in t.edges()})
    t2, _, _, _ = regular_abd(t, M0, c, leafish, 1)
    edges = ", ".join(f"{a}-{b}" for a, b in t2.edges())
    r2 = client.post("/api/v1/trees/analyze", json={"tree": {"format": "edges", "data": edges}}).json()
    assert r2["seed_name"] == "S6_2" and r2["q_exact"]["value"] == 7
    if r2["realization"]:
        assert len(r2["realization"]["dspec"]) == 7


def test_analyze_barioli_fallat():
    r = client.post("/api/v1/trees/analyze", json={"tree": {"format": "gallery", "data": "barioli_fallat"}}).json()
    assert r["seed_name"] == "S6_11" and r["seed_status"] == "defective"
    assert r["q_lower"]["value"] == 8 and r["q_upper"]["value"] == 8


def test_prufer_and_linear_note():
    r = client.post("/api/v1/trees/analyze", json={"tree": {"format": "prufer", "data": "[3,3,3,4,4,4]"}}).json()
    assert r["tree"]["n"] == 8


def test_no_floats_in_certificates():
    e = client.get("/api/v1/catalog/seeds/R1xR1").json()
    m = e["certificate"]["brick"]["matrix"]
    for v in list(m["diag"].values()) + list(m["w2"].values()):
        assert isinstance(v, str)
