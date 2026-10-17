"""Statements, definitions and macros read from the LaTeX source of the thesis (the chapters included in main.tex),
so that the tooltips of the application quote the thesis word for word and follow its current numbering.

  * statements(): label -> {kind, number, ref, title, text}; text is prose with inline $...$ math, with
    references replaced by their numbers and citations by short labels.
  * glossary(): the terms defined in the thesis, from the definition environments and from the sentences of the
    background chapters where a term is introduced in \\emph{...}.
  * macros(): the thesis macros in KaTeX form (\\DSpec, \\Spec, \\tL, \\lmin{j}, ...).
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from . import bib, labels

THESIS = labels.THESIS

ENVS = {"theorem": "Theorem", "teore": "Theorem", "lemat": "Lemma", "lemma": "Lemma", "prop": "Proposition",
        "coro": "Corollary", "corollary": "Corollary", "conj": "Conjecture", "defn": "Definition", "example": "Example",
        "remark": "Remark", "question": "Question", "algor": "Algorithm"}


# ------------------------------------------------------------------------------------------------
# Sources
# ------------------------------------------------------------------------------------------------

def _strip_comments(text: str) -> str:
    out = []
    for line in text.splitlines():
        m = re.search(r"(?<!\\)%", line)
        out.append(line[: m.start()] if m else line)
    return "\n".join(out)


def _read(rel: str, depth: int = 0) -> str:
    p = THESIS / (rel if rel.endswith(".tex") else rel + ".tex")
    if not p.exists() or depth > 4:
        return ""
    text = _strip_comments(p.read_text(errors="ignore"))

    def sub(m):
        name = m.group(1)
        if name.startswith("tikzfigures") or name.startswith("usr/") or "declaracao" in name:
            return ""
        return _read(name, depth + 1)

    return re.sub(r"\\input\{([^}]+)\}", sub, text)


@lru_cache(maxsize=1)
def sources() -> Dict[str, str]:
    return {c: _read(c) for c in labels.included_chapters()}


def _match_brace(s: str, i: int) -> int:
    """s[i] == '{'; returns the index of the matching '}'."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{" and (j == 0 or s[j - 1] != "\\"):
            depth += 1
        elif s[j] == "}" and (j == 0 or s[j - 1] != "\\"):
            depth -= 1
            if depth == 0:
                return j
    return len(s) - 1


# ------------------------------------------------------------------------------------------------
# LaTeX -> prose with inline math
# ------------------------------------------------------------------------------------------------

def _cite(m: re.Match) -> str:
    opt, keys = m.group(1), m.group(2)
    parts = [bib.short_cite(k.strip()) for k in keys.split(",") if k.strip()]
    s = "; ".join(parts)
    if opt:
        s += ", " + clean(opt)
    return f"[{s}]"


def _ref(m: re.Match) -> str:
    cmd, lab = m.group(1), m.group(2)
    num = labels.numbers().get(lab)
    if not num:
        return "?"
    return f"({num})" if cmd == "eqref" else num


def _unwrap(cmds: List[str], s: str) -> str:
    """\\cmd{content} -> content, with nested braces."""
    for cmd in cmds:
        pat = "\\" + cmd + "{"
        while True:
            i = s.find(pat)
            if i < 0:
                break
            j = _match_brace(s, i + len(pat) - 1)
            s = s[:i] + s[i + len(pat): j] + s[j + 1:]
    return s


MATRIX_ENVS = r"(pmatrix|bmatrix|vmatrix|Bmatrix|Vmatrix|matrix|smallmatrix|cases|array|aligned|gathered|split)"


def _flatten_display(content: str) -> str:
    """Alignment marks and line breaks of equation/align environments become commas, but the ones inside
    matrices, cases and arrays are kept, since KaTeX renders those environments inline."""
    kept: List[str] = []

    def mask(m: re.Match) -> str:
        kept.append(m.group(0))
        return f"\x00{len(kept) - 1}\x00"

    masked = re.sub(r"\\begin\{" + MATRIX_ENVS + r"\}.*?\\end\{\1\}", mask, content, flags=re.S)
    masked = masked.replace("&", "").replace("\\\\", ", ")
    return re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], masked)


def clean(s: str) -> str:
    s = re.sub(r"\\label\{[^}]*\}", "", s)
    s = re.sub(r"\\(?:index|footnote)\{[^}]*\}", "", s)
    s = re.sub(r"\\cite(?:\[([^\]]*)\])?\{([^}]*)\}", _cite, s)
    s = re.sub(r"\\(ref|eqref)\{([^}]*)\}", _ref, s)
    s = re.sub(r"\{\\color\{[^}]*\}", "{", s)
    s = re.sub(r"\\color\{[^}]*\}", "", s)
    s = _unwrap(["emph", "textit", "textbf", "texttt"], s)
    # displayed math and equation environments become inline math
    s = re.sub(r"\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}(.*?)\\end\{\1\}", lambda m: "$" + _flatten_display(m.group(2)) + "$", s, flags=re.S)
    s = re.sub(r"\$\$(.*?)\$\$", lambda m: "$" + m.group(1) + "$", s, flags=re.S)
    s = re.sub(r"\\\[(.*?)\\\]", lambda m: "$" + m.group(1) + "$", s, flags=re.S)
    s = re.sub(r"\\begin\{(itemize|enumerate)\}(\[[^\]]*\])?", "", s)
    s = re.sub(r"\\end\{(itemize|enumerate)\}", "", s)
    s = re.sub(r"\\item\s*\[([^\]]*)\]", r" \1 ", s)
    s = re.sub(r"\\item\b", " • ", s)
    s = re.sub(r"\\(noindent|medskip|smallskip|bigskip|par|newline|centering)\b", " ", s)
    s = s.replace("~", " ").replace("---", "—").replace("--", "–").replace("``", "“").replace("''", "”")
    s = re.sub(r"\s+", " ", s).strip()
    # drop a pair of braces that only grouped the whole text
    while s.startswith("{") and _match_brace(s, 0) == len(s) - 1:
        s = s[1:-1].strip()
    return s


# ------------------------------------------------------------------------------------------------
# Statements
# ------------------------------------------------------------------------------------------------

@lru_cache(maxsize=1)
def statements() -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    envs = "|".join(ENVS)
    for chap, text in sources().items():
        for m in re.finditer(r"\\begin\{(" + envs + r")\}(\[[^\]]*\])?(.*?)\\end\{\1\}", text, re.S):
            env, title, body = m.group(1), m.group(2), m.group(3)
            lab = re.search(r"\\label\{([^}]+)\}", body)
            if not lab:
                continue
            key = lab.group(1)
            if key in out:
                continue
            num = labels.numbers().get(key)
            kind = ENVS[env]
            body = re.sub(r"\\begin\{figure\*?\}.*?\\end\{figure\*?\}", " ", body, flags=re.S)
            out[key] = dict(label=key, kind=kind, number=num, ref=f"{kind} {num}" if num else kind,
                            title=clean(title[1:-1]) if title else None, text=clean(body), chapter=num.split(".")[0] if num else None)
    return out


# ------------------------------------------------------------------------------------------------
# Glossary
# ------------------------------------------------------------------------------------------------

SKIP = {"et al.", "not", "no", "every", "all", "some", "exactly", "and", "or", "at least", "at most", "any", "one"}
GLOSSARY_CHAPTERS = ("chap:prelim", "chap:aux", "chap:diminimal", "chap:almost", "chap:d6")
# read last, only for terms that no other chapter defines (linear trees, disparity)
GLOSSARY_FALLBACK = ("chap:intro",)

ALIASES = {
    "CBD": "s-combinatorial branch duplication", "CBDs": "s-combinatorial branch duplication",
    "ABD": "regular s-algebraic branch duplication", "ABDs": "regular s-algebraic branch duplication",
    "regular ABD": "regular s-algebraic branch duplication", "latent value": "latent values",
    "confined latent value": "confined", "diminimal tree": "diminimal", "main roots": "main root",
    "rooted seeds": "rooted seed", "seeds": "seed", "unfoldings": "unfolding", "bricks": "brick",
    "towers": "tower", "levels": "levels", "admissible set": "admissible", "good rooted seed": "good",
    "defective rooted seed": "defective", "standard branch": "standard branches",
    "linear trees": "linear", "temporary zero set": "set of temporary zeros",
}


def _key(term_tex: str) -> str:
    t = re.sub(r"\$([^$]*)\$", lambda m: m.group(1).replace("\\", ""), term_tex)
    t = re.sub(r"[{}]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def _sentences(text: str) -> List[str]:
    """Split prose into sentences: at a blank line, or at a period followed by whitespace and an uppercase letter
    or a command, never inside $...$."""
    out, cur, in_math = [], [], False
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch == "$" and (i == 0 or text[i - 1] != "\\"):
            in_math = not in_math
        if ch == "\\" and i + 1 < n and text[i + 1] in "[]":
            in_math = text[i + 1] == "["
        if not in_math and ch == "\n" and i + 1 < n and text[i + 1] == "\n":
            if cur:
                out.append("".join(cur))
            cur = []
            i += 1
            continue
        cur.append(ch)
        if ch == "." and not in_math:
            j = i + 1
            while j < n and text[j] in " \n\t":
                j += 1
            if j > i + 1 and j < n and (text[j].isupper() or text[j] == "\\"):
                out.append("".join(cur))
                cur = []
        i += 1
    if cur:
        out.append("".join(cur))
    return [x.strip() for x in out if x.strip()]


BAD_TEXT_TERMS = {"as a rooted tree", "even", "extended", "ambient"}


def _score(sentence: str) -> int:
    low = sentence.lower()
    sc = 0
    if any(w in low for w in (" if ", "is said to be", "we say", "is called", " called ", "we call", " is a ", "is the ", "denote")):
        sc += 2
    if low.startswith(("in particular, we discuss", "in this chapter", "in this section")):
        sc -= 3
    return sc


@lru_cache(maxsize=1)
def _description_items(body: str) -> List[tuple]:
    """The items \\item[label] text of a description environment; a label may hold brackets inside braces, {$M[U]$}."""
    out = []
    i = body.find("\\item[")
    while i >= 0:
        k, depth = i + 6, 0
        while k < len(body) and not (body[k] == "]" and depth == 0):
            depth += {"{": 1, "}": -1}.get(body[k], 0)
            k += 1
        label = body[i + 6:k].strip()
        if label.startswith("{") and label.endswith("}"):
            label = label[1:-1]
        nxt = body.find("\\item[", k)
        out.append((label, " ".join(body[k + 1:nxt if nxt >= 0 else len(body)].split())))
        i = nxt
    return out


@lru_cache(maxsize=1)
def thesis_lists() -> Dict[str, List[dict]]:
    """The List of notation and the List of terms of the thesis, each entry with the place where the thesis defines it."""
    text = _read("chap/glossario_fable")
    out: Dict[str, List[dict]] = {"notation": [], "terms": []}
    for title, key in (("List of notation", "notation"), ("List of terms", "terms")):
        i = text.find("\\chapter*{" + title + "}")
        a = text.find("\\begin{description}", i) if i >= 0 else -1
        if a < 0:
            continue
        for label, desc in _description_items(text[a:text.find("\\end{description}", a)]):
            m = re.search(r"(Section|Subsection|Definition|Figure|Chapter|Theorem|Proposition)~\\ref\{([^}]+)\}\.?\s*$", desc)
            where = f"{m.group(1)} {labels.numbers().get(m.group(2), '?')}" if m else None
            meaning = clean(desc[:m.start()] if m else desc).strip().rstrip(".") + "."
            out[key].append(dict(label=label, text=meaning, where=where, where_label=m.group(2) if m else None))
    return out


def glossary() -> List[dict]:
    entries: Dict[str, dict] = {}
    # 0. the List of terms of the thesis, which the other sources do not override
    for t in thesis_lists()["terms"]:
        k = clean(t["label"]).strip()
        # the thesis prints "branch of a tree T at a vertex w, a component ..." and "brick a matrix ...": the tooltip names the term
        name = k[0].upper() + k[1:]
        text = f"{name} {t['text']}" if t["text"].startswith("of ") else f"{name}: {t['text']}"
        entries[k.lower()] = dict(key=k, term=k, text=text, ref=t["where"] or "", label=t["where_label"] or "", source="list")
    # 1. definition environments
    for lab, st in statements().items():
        if st["kind"] != "Definition":
            continue
        raw = _raw_statement(lab)
        for m in re.finditer(r"\\emph\{", raw or ""):
            j = _match_brace(raw, m.end() - 1)
            term_tex = raw[m.end(): j]
            k = _key(term_tex)
            if not k or k.lower() in SKIP or len(k) > 60:
                continue
            if entries.get(k.lower(), {}).get("source") == "list":
                continue
            entries.setdefault(k.lower(), dict(key=k, term=clean(term_tex), text=st["text"], ref=st["ref"], label=lab, source="definition"))
    # 2. sentences of the background chapters that introduce a term in \emph{...}
    chap_files = _chapter_files()
    for chap_label in GLOSSARY_CHAPTERS + GLOSSARY_FALLBACK:
        fallback = chap_label in GLOSSARY_FALLBACK
        f = chap_files.get(chap_label)
        if not f:
            continue
        text = sources()[f]
        text = re.sub(r"\\begin\{(" + "|".join(ENVS) + r"|proof|figure|table|tabbing)\}.*?\\end\{\1\}", " ", text, flags=re.S)
        # \\subsection[short title]{title}\\label{...}: the short title is optional
        sec_positions = [(m.start(), m.group(1)) for m in re.finditer(r"\\(?:sub)*section\*?(?:\[[^\]]*\])?\{[^}]*\}\s*\\label\{([^}]+)\}", text)]
        sents = _sentences(text)
        for si, sent0 in enumerate(sents):
            if "\\emph{" not in sent0:
                continue
            sent = sent0
            if si > 0 and sent0.startswith(("Otherwise", "In this case", "Such ", "It ", "This ", "These ", "Each ", "Its ")):
                sent = sents[si - 1] + " " + sent0
            pos = text.find(sent0)
            sec = None
            for p, lab in sec_positions:
                if p <= pos:
                    sec = lab
            for m in re.finditer(r"\\emph\{", sent):
                j = _match_brace(sent, m.end() - 1)
                term_tex = sent[m.end(): j]
                k = _key(term_tex)
                low = k.lower()
                if not k or low in SKIP or len(k) > 60 or low in BAD_TEXT_TERMS or k.endswith(".") or k[0].isupper():
                    continue
                if low in entries and (entries[low]["source"] in ("definition", "list") or fallback):
                    continue
                ref = labels.ref(sec, "Section") if sec else labels.chapter(chap_label)
                cand = dict(key=k, term=clean(term_tex), text=clean(sent), ref=ref, label=sec or chap_label, source="text", _score=_score(sent))
                if low not in entries or cand["_score"] > entries[low].get("_score", -9):
                    entries[low] = cand
    for e in entries.values():
        e.pop("_score", None)
    out = sorted(entries.values(), key=lambda e: e["key"].lower())
    for alias, target in ALIASES.items():
        if target.lower() in entries and alias.lower() not in entries:
            e = dict(entries[target.lower()])
            e["alias_of"] = e["key"]
            e["key"] = alias
            out.append(e)
    return out


def _chapter_files() -> Dict[str, str]:
    out = {}
    for f, text in sources().items():
        # \chapter[short title]{title}\label{...}: the short title is optional
        m = re.search(r"\\chapter\*?(?:\[[^\]]*\])?\{[^}]*\}\s*\\label\{([^}]+)\}", text)
        if m:
            out[m.group(1)] = f
    return out


@lru_cache(maxsize=None)
def _raw_statement(label: str) -> Optional[str]:
    envs = "|".join(ENVS)
    for text in sources().values():
        for m in re.finditer(r"\\begin\{(" + envs + r")\}(\[[^\]]*\])?(.*?)\\end\{\1\}", text, re.S):
            if re.search(r"\\label\{" + re.escape(label) + r"\}", m.group(3)):
                return m.group(3)
    return None


# ------------------------------------------------------------------------------------------------
# Macros for KaTeX
# ------------------------------------------------------------------------------------------------

@lru_cache(maxsize=1)
def macros() -> Dict[str, str]:
    files = [THESIS / "main.tex"] + list((THESIS / "usr").glob("*.tex"))
    out: Dict[str, str] = {}
    for f in files:
        if not f.exists():
            continue
        s = _strip_comments(f.read_text(errors="ignore"))
        for m in re.finditer(r"\\DeclareMathOperator\*?\{\\(\w+)\}\{([^}]*)\}", s):
            out["\\" + m.group(1)] = "\\operatorname{" + m.group(2) + "}"
        for m in re.finditer(r"\\(?:re)?newcommand\{?\\(\w+)\}?(\[\d\])?\{", s):
            j = _match_brace(s, m.end() - 1)
            body = s[m.end(): j]
            if "\\" + m.group(1) in out:
                continue
            if any(bad in body for bad in ("\\begin", "\\color", "\\textcolor", "\\ifmmode", "\\def", "\\par")):
                continue
            out["\\" + m.group(1)] = body
    return out
