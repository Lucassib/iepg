"""Adherence tests for the constructions of the bricks chapter, the playground and the other graph classes."""
from fractions import Fraction as F

from fastapi.testclient import TestClient

from iepg.catalog import catalog
from iepg.graphs import Graph, analyze_cograph, analyze_threshold, analyze_unicyclic, couple
from iepg.main import app
from iepg.realize import TABLE_D7, admissible, rooted_seed_realization, lambda_1, realize_S_d, seed6_brick, tower_seed_brick
from iepg.trees import path

client = TestClient(app)


def test_S9_example_of_the_thesis():
    # RealizeTree(S_9, 0, 16): spectrum with multiplicities, latent value -30 at the other main root, sqrt(91) on the main edge
    b, node = realize_S_d(9, 0, 16)
    v = b.verification
    assert [str(x) for x in lambda_1(5, 0, 16, [16, 8, 4, 2, 1])] == ["-31", "-30", "-28", "-24", "-16", "0", "16", "40", "52", "58", "61"]
    assert {str(k): m for k, m in v.mult.items() if m} == {"-31": 1, "-28": 1, "-24": 2, "-16": 4, "0": 8, "16": 8, "40": 4, "52": 2, "58": 1, "61": 1}
    assert [str(x) for x in v.latent] == ["-30"] and v.witnesses[F(-30)] == b.other_roots
    assert b.X.w2[b.other_roots[0]] == 91 and v.is_brick


def test_S_d_bricks_up_to_13():
    for d in range(1, 14):
        b, _ = realize_S_d(d)
        assert b.verification.is_brick and b.verification.q == d + 1
        assert b.X.n == (2 ** ((d + 1) // 2) if d % 2 else 3 * 2 ** (d // 2 - 1))


def test_rooted_seed_realizations_are_the_rooted_seeds():
    cat = catalog()
    for i in range(1, 7):
        X, msg = rooted_seed_realization(i, TABLE_D7[(i, i)][0])
        assert X is not None, msg
        assert X.canonical_rooted() == cat.rooted[f"R{i}"]["canonical"]


def test_many_seeds_counts_and_bricks():
    # Theorem many_seeds: at least 21 + (k - 3) odd and 36 + (k - 3) even diminimal seeds, all with bricks
    for k in (3, 4, 5):
        odd, even = set(), set()
        for i in range(1, 7):
            for j in range(1, 7):
                if i <= j:
                    b, _ = tower_seed_brick("R", i, j, k, False)
                    assert b.verification.is_brick
                    odd.add(b.X.tree().canonical())
                b, _ = tower_seed_brick("R", i, j, k, True)
                assert b.verification.is_brick
                even.add(b.X.tree().canonical())
        for bb in range(4, k + 1):
            for ev, bag in ((False, odd), (True, even)):
                b, _ = tower_seed_brick("B", bb, None, k, ev)
                assert b.verification.is_brick
                bag.add(b.X.tree().canonical())
        assert len(odd) == 21 + (k - 3) and len(even) == 36 + (k - 3)


def test_diameter_7_pairs_match_the_catalog():
    cat = catalog()
    for i in range(1, 7):
        for j in range(i, 7):
            b, _ = tower_seed_brick("R", i, j, 3, False)
            assert b.X.tree().canonical() == cat.seeds[f"R{i}xR{j}"]["canonical"]


def test_derived_bricks_of_diameter_6():
    cat = catalog()
    for i in range(1, 7):
        b, _ = seed6_brick(i)
        assert b.verification.is_brick and b.X.tree().canonical() == cat.seeds[f"S6_{i}"]["canonical"]


def test_admissibility_examples_of_the_figure():
    assert admissible([0, 1, 3, 4, 7, 8, 11, 15, 19])[0] is True
    assert admissible([0, 1, 3, 4, 7, 8, 11, 12, 16])[0] is False


def test_playground_generate_after_duplications():
    st = client.post("/api/v1/playground/state", json={"seed": "T_1_4", "d": 7, "ops": []}).json()
    u, y = next(iter(st["duplicable"].items()))
    ops = [[y, int(u)], [y, int(u)]]
    g = client.post("/api/v1/playground/generate", json={"seed": "T_1_4", "d": 7, "ops": ops}).json()
    assert g["ok"] and g["tree"]["q"] == 8 and g["tree"]["n"] > st["n"]


def test_playground_rejects_diameter_changes():
    st = client.post("/api/v1/playground/state", json={"seed": "S_7", "d": 7, "ops": []}).json()
    other = [r for r in st["main_roots"] if r != 0][0]
    r = client.post("/api/v1/playground/state", json={"seed": "S_7", "d": 7, "ops": [[0, other]]})
    assert r.status_code == 422


def test_unicyclic_published_values():
    # tadpoles (Braga et al. 2025) and sunlets (Allem et al. 2025) agree with the general bounds
    assert analyze_unicyclic(couple(path(3), 0, 5, "one"))["exact"]["value"] == 2 + 3
    assert analyze_unicyclic(couple(path(4), 0, 6, "one"))["exact"]["value"] == 6
    assert analyze_unicyclic(couple(path(3), 0, 6, "all"))["exact"]["value"] == 3 + 4 + 1
    assert analyze_unicyclic(couple(path(2), 0, 8, "all"))["exact"]["value"] == 4 + 2
    assert analyze_unicyclic(Graph(7, [(i, (i + 1) % 7) for i in range(7)]))["exact"]["value"] == 4


def test_threshold_and_cograph_matrices_are_verified():
    for seq in ("01", "0101", "001110011", "0001001", "0100101", "01010101", "0011011010"):
        r = analyze_threshold(seq, 1)
        assert r["verification"]["product_is_zero"] and r["verification"]["q"] <= 4
    assert analyze_threshold("0001001", 1)["exact"]["value"] == 4
    V = {"op": "v"}
    e = {"op": "join", "children": [{"op": "union", "children": [V, {"op": "join", "children": [V, V]}]}, {"op": "union", "children": [V, V, V]}, V]}
    r = analyze_cograph(e, 2)
    assert r["verification"]["product_is_zero"] and r["verification"]["q"] <= 4
    spec = {x["value"]: x["multiplicity"] for x in r["verification"]["spectrum"]}
    assert spec == {k: v for k, v in r["spectrum_by_construction"].items()}
