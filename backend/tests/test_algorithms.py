"""The page Algorithms and the analysis of the seeds of the thesis beyond the catalog: towers, S_d by RealizeTree,
the families of Definition def_seeds, and the matrices M_S of the bound C(6) = 8."""
import json

from fastapi.testclient import TestClient

from iepg import realize as rz
from iepg.catalog import catalog
from iepg.main import app, tree_info
from iepg.recognize import _families
from iepg.trees import S_d_tree, Tree

client = TestClient(app)


def _analyze(t: Tree) -> dict:
    r = client.post("/api/v1/trees/analyze", json={"tree": {"canonical": tree_info(t)["canonical"]}})
    assert r.status_code == 200, r.text
    return r.json()


def _unfold(t: Tree, extra: int) -> Tree:
    """t with `extra` of its leaves duplicated, which keeps the seed."""
    edges, n = list(t.edges()), t.n
    for leaf in [v for v in range(t.n) if len(t.adj[v]) == 1][:extra]:
        edges.append((next(iter(t.adj[leaf])), n))
        n += 1
    return Tree.from_edges(n, edges)


def test_the_seven_algorithms_of_the_thesis_are_read_with_their_lines():
    js = client.get("/api/v1/algorithms").json()
    steps = {a["name"]: max(int(l["n"]) for l in a["lines"] if l["n"]) for a in js["thesis"]}
    assert steps == {"Diagonalize": 11, "φ": 12, "StrongRealization": 25, "RootedSeedRealization": 13, "TowerChain": 18, "FoldToSeed": 3, "RealizeTree": 8}
    for a in js["thesis"] + js["site"]:
        assert a["python"] and all(p["code"].startswith("def ") and p["start"] <= p["end"] for p in a["python"])
        assert all(p["url"].startswith("https://github.com/Lucassib/iepg/blob/") for p in a["python"])
    assert "\\mbox" not in json.dumps(js)


def test_tower_seeds_are_diminimal_with_a_realization():
    for kind, a, b, k, even in [("R", 1, 2, 5, False), ("R", 3, 5, 4, False), ("R", 2, 4, 4, True), ("B", 4, None, 5, False)]:
        brick, _ = rz.tower_seed_brick(kind, a, b, k, even)
        for t in (brick.X.tree(), _unfold(brick.X.tree(), 3)):
            js = _analyze(t)
            d = t.diameter()
            assert js["seed_status"] == "diminimal" and js["seed_certificate"]["kind"] == "brick"
            assert len(js["realization"]["dspec"]) == d + 1 and js["realization"]["kind"] == "exact"


def test_S_d_is_realized_by_RealizeTree():
    for d in (8, 9, 10):
        js = _analyze(_unfold(S_d_tree(d)[0], 4))
        assert js["seed_status"] == "diminimal" and len(js["realization"]["dspec"]) == d + 1
        assert js["realization"]["source"].startswith("RealizeTree")


def test_the_families_of_def_seeds_are_diminimal():
    for d in (8, 10, 12):
        for name, _tex, rooted in _families(d):
            js = _analyze(rooted.to_tree()[0])
            assert js["seed_status"] == "diminimal", (d, name)


def test_C6_matrices_give_q_8_on_the_non_diminimal_unfoldings():
    cat = catalog()
    for can, bad in cat.certified_bad.items():
        if bad["seed"] not in ("S6_7", "S6_8", "S6_9"):
            continue
        js = client.post("/api/v1/trees/analyze", json={"tree": {"canonical": can}}).json()
        assert js["q_exact"]["value"] == 8 and len(js["realization"]["dspec"]) == 8


def test_texts_follow_the_final_thesis():
    for path in ("/api/v1/questions", "/api/v1/catalog/counts", "/api/v1/catalog/seeds?d=6"):
        assert "phase 2" not in json.dumps(client.get(path).json())
    # the questions are shown as the thesis states them
    assert all(q["evidence"] == "" and q["references"] == [] for q in client.get("/api/v1/questions").json())
    bounds = client.get("/api/v1/catalog/counts").json()["bounds"]
    assert all("Theorem 1." not in b["source"] and ":" not in b["source"] for b in bounds)


def test_references_take_the_kind_of_their_environment():
    from iepg import labels, thesis_text
    assert labels.ref("prop:latent-bound").startswith("Theorem") and labels.ref("lemma6").startswith("Corollary")
    assert labels.ref("unique_path").startswith("Lemma") and labels.ref("mainrooteven").startswith("Definition")
    assert labels.ref("fig:C6-weights").startswith("Figure") and labels.ref("sec:d7class").startswith("Section")
    st = thesis_text.statements()
    assert all(v["ref"] == labels.ref(k) for k, v in st.items() if v["number"])


def test_no_defective_reminder_on_a_certified_tree():
    cat = catalog()
    for can, bad in cat.certified_bad.items():
        js = client.post("/api/v1/trees/analyze", json={"tree": {"canonical": can}}).json()
        assert not any("not necessarily this one" in n for n in js["notes"]), bad["seed"]


def test_the_spa_routes_of_the_backend_are_those_of_the_frontend():
    import re
    from pathlib import Path
    from iepg.main import SPA_ROUTES
    app_tsx = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "App.tsx").read_text()
    paths = {p.strip("/") for p in re.findall(r'<Route path="([^"*]+)"', app_tsx) if ":" not in p}
    assert paths == SPA_ROUTES, paths ^ SPA_ROUTES


def test_inputs_that_used_to_fail_get_a_clear_answer():
    assert client.post("/api/v1/trees/analyze", json={"tree": {"format": "parentheses", "data": "()"}}).status_code == 422
    assert client.post("/api/v1/lab/family", json={"k": 2, "alpha": "q"}).status_code == 422
    assert client.post("/api/v1/lab/tower", json={"pair": [1], "k": 4}).status_code == 422
    r = client.post("/api/v1/latent", json={"tree": {"format": "edges", "data": "0-1, 0-2, 2-3"}, "root": 3,
                                             "matrix": {"diag": {"0": "2", "1": "0", "2": "1", "3": "1"}, "w2": {"0-1": "2", "0-2": "3", "2-3": "1"}}})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "BAD_ROOT"
    js = client.post("/api/v1/trees/analyze", json={"tree": {"format": "edges", "data": "0-1 1-2 2-3"}}).json()
    assert js["tree"]["n"] == 4
    assert client.get("/api/v1/bibliography?keys=cot2020").status_code == 200


def test_texts_of_the_first_review():
    js = client.get("/api/v1/algorithms").json()
    assert all(any(l["kind"] == "head" and "".join(p["v"] for p in l["parts"]).startswith("Input") for l in a["lines"]) for a in js["thesis"])
    chain = client.get("/api/v1/catalog/seeds/R7xR8").json()["certificate"]["chain"]["steps"]
    assert "Theorem 5.4" in chain[0]
    assert "allem2026minimum" not in client.get("/api/v1/catalog/seeds/R2xR5").json()["certificate"]["references"]
