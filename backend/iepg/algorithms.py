"""The page Algorithms: the pseudocode of each algorithm of the thesis, read from its tabbing block in the thesis
sources, next to the Python functions that implement it, read from the running code with inspect. Neither side is
copied by hand, so the page follows the thesis and the code."""
from __future__ import annotations

import inspect
import os
import re
import textwrap
from functools import lru_cache
from pathlib import Path
from typing import Callable, Dict, List, Optional

from . import diag, fold, labels, realize, realize_tree, recognize, thesis_text
from .catalog import Catalog

REPO = "https://github.com/Lucassib/iepg"

# The algorithms with a name in the thesis, in the order of the thesis, and the functions that run them.
THESIS_ALGORITHMS = [
    dict(id="diagonalize", name="Diagonalize", functions=[diag.diagonalize], lab=("/lab/diagonalize", "Run it in the laboratory"),
         about="Counts the eigenvalues of $M$ greater than, less than and equal to $\\lambda$, by a congruence computed from the leaves to the root."),
    dict(id="phi", name="φ", functions=[realize.phi], lab=("/lab/build-sd", "See it in Build S_d"),
         about="Joins two rooted matrices by an edge whose weight makes $\\lambda$ the smallest eigenvalue of the result."),
    dict(id="strong-realization", name="StrongRealization", functions=[realize.strong_realization, realize.base_sr], lab=("/lab/build-sd", "Run it in Build S_d"),
         about="A brick of $S_{2k-1}$ whose set of temporary zeros is a prescribed admissible set $\\Lambda$ of $2k+1$ numbers, by recursion on $k$; its distinct eigenvalues are $\\Lambda$ without $\\lambda_1$ or without $\\lambda_{2k-1}$."),
    dict(id="rooted-seed-realization", name="RootedSeedRealization", functions=[realize.rooted_seed_realization], lab=("/trees/d7", "See its bricks in diameter 7"),
         about="A matrix on the rooted seed $R_i$ with a prescribed set of seven numbers, the building block of the bricks of diameter $7$."),
    dict(id="tower-chain", name="TowerChain", functions=[realize.tower_chain], lab=("/lab/towers", "Run it in Towers"),
         about="A matrix on each level of a tower, each level composed of the two before it by φ."),
    dict(id="fold-to-seed", name="FoldToSeed", functions=[fold.fold_to_seed], lab=("/analyze", "Run it in Analyze a tree"),
         about="Removes duplicated branches that keep the diameter until the seed of the tree is left, recording each removal."),
    dict(id="realize-tree", name="RealizeTree", functions=[realize_tree.realize_tree, fold.unfold_realization], lab=("/analyze", "Run it in Analyze a tree"),
         about="For a tree $T$ in the family of $S_d$, a matrix with $d+1$ distinct eigenvalues: the brick of $S_d$ carried to $T$ along the steps of FoldToSeed."),
]

# Computations of the site that are proofs or theorems of the thesis rather than named algorithms.
SITE_COMPUTATIONS = [
    dict(id="latent", name="Temporary zeros and latent values", functions=[diag.latent_report], thesis=["prop:latent-bound", "def:brick"],
         lab=("/lab/latent", "Run it in the laboratory"),
         about="The set $\\mathcal Z(M)$ of temporary zeros, the latent and the confined values, the bound $|\\mathcal Z(M)|-|\\Delta_c(M)|$ on every unfolding, and whether $M$ is a brick."),
    dict(id="verify", name="Exact verification of a brick", functions=[realize.verify], thesis=["thm_localizacao", "thm:brick-diminimal"], lab=None,
         about="Every matrix built by the site is checked by Diagonalize in exact arithmetic at each candidate eigenvalue, which is a proof and not a test."),
    dict(id="propagation", name="Propagation of defectivity", functions=[Catalog.seed_defective_by_propagation], thesis=["cor:even-seed", "cor:odd-seed", "lem:heredity"],
         lab=("/trees/d7", "See it in diameter 7"),
         about="A seed built on a defective rooted seed of depth $3$ is defective."),
    dict(id="recognize", name="Recognizing the seeds of the thesis", functions=[recognize.recognize], thesis=["def:Sd", "def_seeds", "many_seeds"], lab=None,
         about="Decides whether a seed is $S_d$, a seed of ⟨def_seeds⟩ or a tower seed of ⟨many_seeds⟩, by rebuilding the seeds of its diameter."),
]


def commit() -> str:
    """The commit the links point to: set when the image is built, else the branch."""
    return os.environ.get("IEPG_COMMIT") or "main"


def _python(fn: Callable) -> dict:
    lines, start = inspect.getsourcelines(fn)
    path = Path(inspect.getsourcefile(fn) or "")
    rel = "/".join(path.parts[-3:])  # backend/iepg/<module>.py, the same in the repository and in the image
    end = start + len(lines) - 1
    return dict(name=fn.__qualname__, path=rel, start=start, end=end, code=textwrap.dedent("".join(lines)).rstrip() + "\n",
                url=f"{REPO}/blob/{commit()}/{rel}#L{start}-L{end}")


# ------------------------------------------------------------------------------------------------
# the tabbing blocks of the thesis
# ------------------------------------------------------------------------------------------------

_TOKEN = re.compile(r"\{\\bf\s*([^}]*)\}|\\texttt\{([^}]*)\}|\\mbox\{([^}]*)\}|\\phantom\{([^}]*)\}|\\eqref\{([^}]*)\}|\\ref\{([^}]*)\}")


def _text_parts(s: str) -> List[dict]:
    out: List[dict] = []
    pos = 0
    nums = labels.numbers()
    for m in _TOKEN.finditer(s):
        if m.start() > pos:
            out.append(dict(t="text", v=s[pos:m.start()]))
        bf, tt, mbox, phantom, eqref, ref = m.groups()
        if bf is not None:
            out.append(dict(t="kw", v=bf))
        elif tt is not None:
            out.append(dict(t="code", v=tt))
        elif mbox is not None:
            out.append(dict(t="text", v=mbox))
        elif phantom is not None:
            out.append(dict(t="pad", v=phantom))
        elif eqref is not None:
            out.append(dict(t="text", v=f"({nums.get(eqref, '?')})"))
        else:
            out.append(dict(t="text", v=nums.get(ref, "?")))
        pos = m.end()
    if pos < len(s):
        out.append(dict(t="text", v=s[pos:]))
    for p in out:
        if p["t"] == "text":
            p["v"] = p["v"].replace("~", " ")
    return [p for p in out if p["v"] != ""]


def _parts(s: str) -> List[dict]:
    out: List[dict] = []
    for i, piece in enumerate(re.split(r"\$(.*?)\$", s, flags=re.S)):
        if i % 2:
            # KaTeX has no \mbox; the blocks are set in typewriter type, as in the thesis
            out.append(dict(t="math", v=" ".join(piece.split()).replace("\\mbox{", "\\texttt{")))
        elif piece:
            out.extend(_text_parts(piece))
    return out


def _lines(body: str) -> List[dict]:
    out = []
    for raw in re.split(r"\\\\", body):
        r = " ".join(raw.split())
        if "\\kill" in r:  # the row of tab stops also holds the first line of the block
            r = r.split("\\kill", 1)[1].strip()
        if not r:
            continue
        m = re.match(r"(\d+)\s*\\>", r)
        tabs = len(re.findall(r"\\>", r))
        content = re.sub(r"^(\d+)?\s*(\\>\s*)*", "", r).strip()
        if m:
            kind, indent = "step", tabs - 2
        elif tabs <= 1:
            kind, indent = ("title" if content.startswith("Algorithm") else "head" if content else "blank"), 0
        else:
            kind, indent = "cont", tabs - 2
        out.append(dict(n=m.group(1) if m else None, kind=kind, indent=max(indent, 0), parts=_parts(content)))
    return out


def _name(signature: str) -> Optional[str]:
    m = re.search(r"\\(?:texttt|mbox)\{(\w+)\}", signature)
    if m:
        return m.group(1)
    return "φ" if "varphi" in signature else None


def _where(text: str, start: int, end: int) -> Optional[str]:
    """The figure that holds the block, else the last section or subsection before it."""
    before = text[:start]
    if before.rfind("\\begin{figure}") > before.rfind("\\end{figure}"):
        tail = text[end:text.find("\\end{figure}", end)]
        m = re.search(r"\\label\{([^}]+)\}", tail)
        if m:
            return m.group(1)
    best = None
    for m in re.finditer(r"\\(?:sub)*section\*?\{", before):
        lab = re.match(r"[^\n]*?\\label\{([^}]+)\}", before[m.end():m.end() + 400])
        if lab:
            best = lab.group(1)
    return best


@lru_cache(maxsize=1)
def thesis_blocks() -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    for _chap, text in thesis_text.sources().items():
        for m in re.finditer(r"\\begin\{tabbing\}(.*?)\\end\{tabbing\}", text, re.S):
            head = re.search(r"Algorithm\s*\$(.*?)\$", m.group(1), re.S)
            name = _name(head.group(1)) if head else None
            if name and name not in out:
                lab = _where(text, m.start(), m.end())
                out[name] = dict(lines=_lines(m.group(1)), where=labels.ref(lab) if lab else None, where_label=lab)
    return out


def _numbered(text: str) -> str:
    """⟨label⟩ becomes the reference with the numbering of the thesis that is read."""
    return re.sub(r"⟨([^⟩]+)⟩", lambda m: labels.ref(m.group(1)), text)


@lru_cache(maxsize=1)
def algorithms() -> dict:
    blocks = thesis_blocks()
    thesis = []
    for a in THESIS_ALGORITHMS:
        b = blocks.get(a["name"])
        thesis.append(dict(id=a["id"], name=a["name"], about=a["about"], where=b["where"] if b else None,
                           lines=b["lines"] if b else [], python=[_python(f) for f in a["functions"]],
                           lab=dict(to=a["lab"][0], label=a["lab"][1]) if a["lab"] else None))
    site = [dict(id=a["id"], name=a["name"], about=_numbered(a["about"]), thesis=[labels.ref(x) for x in a["thesis"]],
                 python=[_python(f) for f in a["functions"]], lab=dict(to=a["lab"][0], label=a["lab"][1]) if a["lab"] else None)
            for a in SITE_COMPUTATIONS]
    return dict(thesis=thesis, site=site, repository=REPO, commit=commit())
