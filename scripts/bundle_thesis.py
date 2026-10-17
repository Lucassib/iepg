"""Compiles a copy of the thesis and copies the files the backend reads into build/thesis.

The thesis folder is only read. The .aux files there can be older than the .tex files, since tectonic keeps the
intermediate files only on request, so a copy of the folder is compiled first (tectonic --keep-intermediates in a
temporary folder) and the numbers of the theorems come from that compilation.

The backend reads the thesis at run time (labels and numbers from the .aux files, statements and definitions from the
.tex sources, the bibliography, the open questions, the macros). This script records every file the backend opens
while it answers each read-only endpoint once, copies exactly those files, and then checks that the backend answers
the same from the copy as from the original. It exits with an error if any answer differs.

Usage (from iepg_app/):  backend/.venv/bin/python scripts/bundle_thesis.py [--source DIR]
"""
from __future__ import annotations

import argparse
import builtins
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent
BACKEND = APP / "backend"
OUT = APP / "build" / "thesis"

GETS = ["/api/v1/meta", "/api/v1/catalog/seeds", "/api/v1/catalog/rooted-seeds", "/api/v1/catalog/counts",
        "/api/v1/catalog/gallery", "/api/v1/bibliography", "/api/v1/statements", "/api/v1/glossary", "/api/v1/macros",
        "/api/v1/questions", "/api/v1/notation"] + [f"/api/v1/playground/seeds?d={d}" for d in range(1, 16)]
POSTS = [("/api/v1/trees/analyze", {"tree": {"format": "catalog", "data": "S6_3"}}),
         ("/api/v1/trees/analyze", {"tree": {"format": "catalog", "data": "R2xR5"}}),
         ("/api/v1/lab/tower", {"pair": [2, 5], "k": 4}),
         ("/api/v1/lab/strong-realization", {"k": 3}),
         ("/api/v1/playground/generate", {"seed": "T_2_5", "d": 7, "ops": []}),
         ("/api/v1/graphs/threshold", {"sequence": "0101"}),
         ("/api/v1/graphs/cograph", {"expr": {"op": "join", "children": [{"op": "v"}, {"op": "v"}]}})]

# run by a child process: answer every request above and print the answers (and, with --trace, the files read)
CHILD = r"""
import builtins, json, os, sys, pathlib
os.environ["IEPG_RATE_LIMITS"] = "0"
thesis = pathlib.Path(os.environ["IEPG_THESIS_DIR"]).resolve()
seen = set()
real_open = builtins.open
def rec(p):
    try:
        q = pathlib.Path(p).resolve()
    except Exception:
        return
    if q.is_relative_to(thesis) and q.is_file():
        seen.add(str(q.relative_to(thesis)))
def open_(file, *a, **k):
    rec(file)
    return real_open(file, *a, **k)
builtins.open = open_
_read_text, _read_bytes = pathlib.Path.read_text, pathlib.Path.read_bytes
pathlib.Path.read_text = lambda self, *a, **k: (rec(self), _read_text(self, *a, **k))[1]
pathlib.Path.read_bytes = lambda self, *a, **k: (rec(self), _read_bytes(self, *a, **k))[1]
sys.path.insert(0, os.environ["IEPG_BACKEND"])
from fastapi.testclient import TestClient
from iepg.main import app
c = TestClient(app)
gets, posts = json.loads(os.environ["IEPG_REQUESTS"])
answers = {}
for g in gets:
    r = c.get(g); answers[g] = [r.status_code, r.json()]
for i, (p, b) in enumerate(posts):
    r = c.post(p, json=b); answers[f"{i} {p}"] = [r.status_code, r.json()]
print(json.dumps({"files": sorted(seen), "answers": answers}, sort_keys=True))
"""


def run_child(thesis: Path) -> dict:
    env = {**os.environ, "IEPG_THESIS_DIR": str(thesis), "IEPG_BACKEND": str(BACKEND), "IEPG_REQUESTS": json.dumps([GETS, POSTS])}
    env.pop("IEPG_DIST_DIR", None)
    out = subprocess.run([sys.executable, "-c", CHILD], env=env, capture_output=True, text=True, cwd=BACKEND)
    if out.returncode != 0:
        sys.exit(f"the backend failed on {thesis}:\n{out.stderr[-3000:]}")
    return json.loads(out.stdout.strip().splitlines()[-1])


IGNORE = shutil.ignore_patterns("*.zip", "propostas", "_antes*", "old_chapters", "TESE_*.pdf", "main.pdf", "*.aux", "*.log",
                                 "*.synctex.gz", ".DS_Store")


def compiled_copy(thesis: Path, work: Path) -> Path:
    """A copy of the thesis folder compiled with tectonic, keeping the .aux files."""
    dst = work / "thesis"
    shutil.copytree(thesis, dst, ignore=IGNORE)
    out = subprocess.run(["tectonic", "-X", "compile", "main.tex", "--keep-intermediates"], cwd=dst, capture_output=True, text=True)
    if out.returncode != 0 or not (dst / "main.aux").exists():
        sys.exit("tectonic could not compile the copy of the thesis:\n" + (out.stderr or out.stdout)[-3000:])
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(APP.parent / "tese" / "Tese_fable_51"))
    args = ap.parse_args()
    thesis = Path(args.source).resolve()
    if not (thesis / "main.tex").exists():
        sys.exit(f"no main.tex in {thesis}")
    if shutil.which("tectonic") is None:
        sys.exit("tectonic is needed to compile the copy of the thesis (brew install tectonic)")
    work = Path(tempfile.mkdtemp(prefix="iepg-thesis-"))
    src = compiled_copy(thesis, work)

    first = run_child(src)
    files = first["files"]
    if OUT.exists():
        shutil.rmtree(OUT)
    manifest = []
    for rel in files:
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src / rel, dst)
        manifest.append(dict(file=rel, sha256=hashlib.sha256((src / rel).read_bytes()).hexdigest()[:16]))
    texs = [thesis / m["file"] for m in manifest if m["file"].endswith(".tex") and (thesis / m["file"]).exists()]
    thesis_date = date.fromtimestamp(max(p.stat().st_mtime for p in texs)).isoformat() if texs else None
    try:
        source = str(thesis.resolve().relative_to(APP.parent.resolve()))
    except ValueError:
        source = thesis.name
    (OUT / "BUNDLE.json").write_text(json.dumps(dict(source=source, compiled=True, date=date.today().isoformat(),
                                                     thesis_date=thesis_date, files=manifest), indent=1))

    second = run_child(OUT)
    diff = [k for k in first["answers"] if first["answers"][k] != second["answers"].get(k)]
    if diff:
        sys.exit(f"the bundle answers differently on: {diff}")
    bad = [k for k, (code, _) in first["answers"].items() if code != 200]
    if bad:
        sys.exit(f"these requests failed on the original thesis: {bad}")
    size = sum((OUT / m["file"]).stat().st_size for m in manifest)
    shutil.rmtree(work, ignore_errors=True)
    print(f"compiled a copy of the thesis and bundled {len(files)} files ({size / 1024:.0f} kB) into {OUT.relative_to(APP)}; "
          f"{len(first['answers'])} answers identical to the compiled copy")


if __name__ == "__main__":
    main()
