"""The tooltips quote the thesis: statements, glossary and macros are read from the LaTeX source."""
from iepg import labels, thesis_text


def test_statements_of_the_results_the_app_cites():
    st = thesis_text.statements()
    for lab in ("thm:brick-diminimal", "def:brick", "def:admissible", "prop:generic", "thm:C", "many_seeds",
                "prop:tower-bricks", "lem:six-arms", "def:tower", "thm:odd-prop", "def:abd", "prop:latent-bound", "thm:LB"):
        assert lab in st and st[lab]["number"] == labels.numbers()[lab], lab
        assert "\\label" not in st[lab]["text"] and "\\ref" not in st[lab]["text"] and "\\cite" not in st[lab]["text"]
    assert st["thm:C"]["text"].startswith("For every $d\\geq 1$, almost every set of $d+1$ distinct real numbers")


def test_glossary_has_the_key_terms_with_defining_sentences():
    g = {e["key"].lower(): e for e in thesis_text.glossary()}
    for k in ("seed", "unfolding", "diminimal", "diminimal seed", "defective seed", "brick", "latent values", "confined",
              "main root", "rooted seed", "cbd", "abd", "tower", "admissible", "set of temporary zeros", "good", "defective",
              "linear", "lateral", "disparity"):
        assert k in g, k
    assert "if $q(T)=d(T)+1$" in g["diminimal"]["text"]
    # the terms of the List of terms of the thesis come with its wording and its reference
    assert g["seed"]["text"].startswith("Seed: a tree that is not an unfolding") and g["seed"]["ref"].startswith("Section 1.1")
    assert g["disparity"]["ref"] == "Section 1.1.3" and g["linear tree"]["ref"] == "Section 1.1.3"


def test_notation_is_the_list_of_notation_of_the_thesis():
    from iepg.catalog import _notation
    rows = {r["symbol"]: r for r in _notation()}
    assert rows["d(T)"]["where"] == "Section 1.1.3" and rows["\\rho_k"]["where"].startswith("Section 2")
    assert rows["\\Delta_c(M)"]["where"].startswith("Definition 4.") and "E_k" not in rows


def test_macros_for_katex():
    m = thesis_text.macros()
    assert m["\\DSpec"] == "\\operatorname{DSpec}" and "#1" in m["\\lmin"]
