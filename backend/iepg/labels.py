"""Numbers of the theorems, definitions and figures of the thesis, read from the LaTeX .aux files, so that
the application cites 'Theorem 4.6' with the number of the current compilation."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict

from .config import THESIS


PREFIX = {
    "thm": "Theorem", "theorem": "Theorem", "cor": "Corollary", "prop": "Proposition", "lem": "Lemma", "lemma": "Lemma",
    "def": "Definition", "defn": "Definition", "rem": "Remark", "fig": "Figure", "sec": "Section", "chap": "Chapter",
    "q": "Question", "eq": "equation", "tab": "Table", "ex": "Example", "alg": "Algorithm", "conj": "Conjecture", "intro": "Theorem",
}

_CACHE: Dict[str, str] | None = None


def included_chapters() -> list:
    """The chapter files included (not commented out) in main.tex, in order."""
    main = THESIS / "main.tex"
    out = []
    if main.exists():
        for line in main.read_text(errors="ignore").splitlines():
            code = line.split("%", 1)[0]
            m = re.search(r"\\include\{([^}]+)\}", code)
            if m:
                out.append(m.group(1))
    return out


def _load() -> Dict[str, str]:
    out: Dict[str, str] = {}
    inc = included_chapters()
    files = [THESIS / (c + ".aux") for c in inc] if inc else list(THESIS.glob("chap/*.aux"))
    files.append(THESIS / "main.aux")
    for f in files:
        if not f.exists():
            continue
        for line in f.read_text(errors="ignore").splitlines():
            m = re.match(r"\\newlabel\{([^}]+)\}\{\{([^}]*)\}\{([^}]*)\}", line)
            if m:
                out.setdefault(m.group(1), m.group(2))
    return out


def numbers() -> Dict[str, str]:
    global _CACHE
    if _CACHE is None:
        _CACHE = _load()
    return _CACHE


KNOWN_KIND = {
    "badseedS67": "Theorem", "badseedS68": "Theorem", "badseedS69": "Theorem", "many_seeds": "Theorem",
    "thm_JS": "Theorem", "thm_localizacao": "Theorem", "multiplicidades": "Lemma", "lemma5": "Lemma", "lemma6": "Lemma",
    "introt1": "Theorem", "introt2": "Theorem", "counter-example": "Figure", "counter_example": "Figure",
    "treealgo": "Figure", "def_seeds": "Definition", "q8thm": "Theorem",
}


_KINDS: Dict[str, str] | None = None


def env_kinds() -> Dict[str, str]:
    """The kind of each statement, from the environment that holds its label in the thesis sources: lemma6 is a
    Corollary and prop:latent-bound a Theorem, whatever their prefixes say."""
    global _KINDS
    if _KINDS is None:
        from . import thesis_text  # thesis_text imports this module

        out: Dict[str, str] = {}
        envs = "|".join(thesis_text.ENVS)
        for text in thesis_text.sources().values():
            for m in re.finditer(r"\\begin\{(" + envs + r")\}(?:\[[^\]]*\])?(.*?)\\end\{\1\}", text, re.S):
                lab = re.search(r"\\label\{([^}]+)\}", m.group(2))
                if lab:
                    out.setdefault(lab.group(1), thesis_text.ENVS[m.group(1)])
        _KINDS = out
    return _KINDS


def chapter(label: str) -> str:
    num = numbers().get(label)
    return f"Chapter {num}" if num else "the thesis"


def ref(label: str, kind: str | None = None) -> str:
    """'Theorem 4.6' for the label 'thm:brick-diminimal'; falls back to the label itself."""
    num = numbers().get(label)
    head = label.split(":")[0].lower()
    # the environment of the statement first; figures, sections, tables and equations by their prefix
    if kind is None and head not in ("fig", "sec", "chap", "tab", "eq"):
        kind = env_kinds().get(label)
    if kind is None:
        kind = KNOWN_KIND.get(label)
    if kind is None:
        kind = PREFIX.get(head, "Result")
    if num:
        return f"{kind} {num}"
    return f"{kind} ({label})"
