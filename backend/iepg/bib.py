"""Bibliography: a small BibTeX reader for bib/thesis.bib and a formatter in the style of the thesis (acm)."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List

from .config import THESIS

BIB = THESIS / "bib" / "thesis.bib"

_LATEX = [
    (r"\\'\{?e\}?", "é"), (r"\\'\{?a\}?", "á"), (r"\\'\{?o\}?", "ó"), (r"\\'\{?i\}?", "í"), (r"\\'\{?u\}?", "ú"),
    (r"\\`\{?a\}?", "à"), (r'\\"\{?u\}?', "ü"), (r'\\"\{?o\}?', "ö"), (r'\\"\{?a\}?', "ä"), (r"\\~\{?a\}?", "ã"), (r"\\~\{?o\}?", "õ"),
    (r"\\c\{c\}", "ç"), (r"\\v\{S\}", "Š"), (r"\\v\{s\}", "š"), (r"\\k\{e\}", "ę"), (r"\\l\b", "ł"), (r"\\&", "&"), (r"\$\\&\$", "&"),
    (r"\\-", ""), (r"\\'\{\\i\}", "í"), (r"\{\\'i\}", "í"),
]


def _clean(s: str) -> str:
    s = s.strip()
    for pat, rep in _LATEX:
        s = re.sub(pat, rep, s)
    s = s.replace("{", "").replace("}", "").replace("~", " ")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _split_fields(body: str) -> Dict[str, str]:
    fields: Dict[str, str] = {}
    i = 0
    n = len(body)
    while i < n:
        m = re.match(r"\s*,?\s*([A-Za-z_]+)\s*=\s*", body[i:])
        if not m:
            break
        key = m.group(1).lower()
        i += m.end()
        if i >= n:
            break
        if body[i] == "{":
            depth = 0
            j = i
            while j < n:
                if body[j] == "{":
                    depth += 1
                elif body[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            fields[key] = body[i + 1:j]
            i = j + 1
        elif body[i] == '"':
            j = body.index('"', i + 1)
            fields[key] = body[i + 1:j]
            i = j + 1
        else:
            m2 = re.match(r"([^,\n]+)", body[i:])
            fields[key] = m2.group(1).strip()
            i += m2.end()
    return fields


def load_bib(path: Path = BIB) -> Dict[str, dict]:
    text = path.read_text(encoding="utf-8")
    entries: Dict[str, dict] = {}
    for m in re.finditer(r"@(\w+)\s*\{\s*([^,\s]+)\s*,", text):
        kind = m.group(1).lower()
        key = m.group(2)
        # body until the matching closing brace
        i = m.end()
        depth = 1
        j = i
        while j < len(text) and depth:
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
            j += 1
        body = text[i:j - 1]
        fields = _split_fields(body)
        entries[key] = dict(kind=kind, key=key, raw="@" + kind + "{" + key + "," + body + "}", **fields)
    return entries


def _author_list(s: str) -> List[str]:
    parts = [p.strip() for p in re.split(r"\s+and\s+", _clean(s)) if p.strip()]
    out = []
    for p in parts:
        if "," in p:
            last, first = [q.strip() for q in p.split(",", 1)]
        else:
            toks = p.split()
            last, first = toks[-1], " ".join(toks[:-1])
        # Chin-Hung gives C.-H., as in the bibliography of the thesis
        initials = " ".join("-".join(x[0] + "." for x in tok.split("-") if x) for tok in first.split() if tok)
        out.append(f"{last}, {initials}".strip().rstrip(","))
    return out


def _acm_title(raw: str) -> str:
    """The title as the acm style of the thesis prints it: lower case except the first letter, braced groups, math and the
    letter after a colon and a space (BibTeX change.case$ "t")."""
    out, depth, math, first, colon = [], 0, False, True, 0
    for c in raw:
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == "$":
            math = not math
        if c.isalpha() and depth == 0 and not math:
            out.append(c if first or colon == 2 else c.lower())
            first, colon = False, 0
            continue
        if c.isalpha():
            first, colon = False, 0
        colon = 1 if c == ":" and depth == 0 else (2 if colon in (1, 2) and c.isspace() else 0)
        out.append(c)
    return "".join(out)


def format_entry(e: dict) -> dict:
    authors = _author_list(e.get("author", "")) if e.get("author") else []
    if len(authors) > 1:
        auth = ", ".join(authors[:-1]) + ", and " + authors[-1]
    else:
        auth = authors[0] if authors else ""
    kind = e["kind"]
    title = _clean(e.get("title", "") if kind in ("book", "phdthesis", "mastersthesis") else _acm_title(e.get("title", "")))
    year = _clean(e.get("year", ""))
    venue = ""
    if kind == "article":
        j = _clean(e.get("journal", ""))
        vol = _clean(e.get("volume", ""))
        num = _clean(e.get("number", ""))
        pages = _clean(e.get("pages", "")).replace("--", "–")
        venue = j
        if vol:
            venue += f" {vol}"
            if num:
                venue += f", {num}"
        if year:
            venue += f" ({year})"
        if pages:
            venue += f", {pages}"
    elif kind == "book":
        pub = _clean(e.get("publisher", ""))
        addr = _clean(e.get("address", ""))
        venue = ", ".join(x for x in (pub, addr, year) if x)
        vol, series = _clean(e.get("volume", "")), _clean(e.get("series", ""))
        if vol and series:  # "Inverse Problems and Zero Forcing for Graphs, vol. 270 of Mathematical Surveys and Monographs."
            title = f"{title}, vol. {vol} of {series}"
    elif kind in ("inproceedings", "incollection"):
        venue = ", ".join(x for x in (_clean(e.get("booktitle", "")), _clean(e.get("pages", "")).replace("--", "–"), year) if x)
    else:
        venue = ", ".join(x for x in (_clean(e.get("note", "")), year) if x)
    note = _clean(e.get("note", "")) if kind not in ("unpublished", "misc") else ""
    # a web address in howpublished comes before the year and the note after it, as the thesis prints it
    web = re.search(r"\\url\{([^}]+)\}", e.get("howpublished", "") or "")
    if web and kind == "misc":
        venue = ", ".join(x for x in (web.group(1), year) if x)
        note = _clean(e.get("note", ""))
    auth_dot = (auth if auth.endswith(".") else auth + ".") if auth else ""
    formatted = (f"{auth_dot} {title}. {venue}." if venue else f"{auth_dot} {title}.").strip()
    if note and (kind == "article" or web):
        formatted += f" {note}."
    doi = _clean(e.get("doi", "")) if e.get("doi") else ""
    arxiv = ""
    for f in ("journal", "eprint", "note", "howpublished"):
        m = re.search(r"arXiv[:\s]*([0-9]{4}\.[0-9]{4,5})", e.get(f, "") or "")
        if m:
            arxiv = m.group(1)
            break
    url = _clean(e.get("url", "")) if e.get("url") else (web.group(1) if web else "")
    return dict(key=e["key"], formatted=formatted, authors=auth, title=title, venue=venue, year=year,
                doi=doi or None, arxiv=arxiv or None, url=url or None, bibtex=e["raw"])


_CACHE: Dict[str, dict] | None = None


def bibliography() -> Dict[str, dict]:
    global _CACHE
    if _CACHE is None:
        _CACHE = load_bib()
    return _CACHE


def get_entries(keys: List[str]) -> List[dict]:
    bib = bibliography()
    out = []
    for k in keys:
        if k in bib:
            out.append(format_entry(bib[k]))
        else:
            out.append(dict(key=k, formatted=f"[{k}: not found in thesis.bib]", authors="", title="", venue="", year="", doi=None, arxiv=None, url=None, bibtex=""))
    return out


def short_cite(key: str) -> str:
    """'Johnson and Saiago 2016'-style label for chips."""
    bib = bibliography()
    e = bib.get(key)
    if not e:
        return key
    authors = _author_list(e.get("author", ""))
    lasts = [a.split(",")[0] for a in authors]
    year = _clean(e.get("year", ""))
    if not lasts:
        s = _clean(e.get("title", "")) or key
    elif len(lasts) == 1:
        s = lasts[0]
    elif len(lasts) == 2:
        s = f"{lasts[0]} and {lasts[1]}"
    else:
        s = f"{lasts[0]} et al."
    return f"{s} {year}".strip()
