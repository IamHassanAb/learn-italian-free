# -*- coding: utf-8 -*-
"""Build the static web app into docs/ (GitHub Pages can serve the docs/ folder). Usage: python build/app.py"""
import os, sys, json, shutil
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import ROOT
import appdata

APP = os.path.join(ROOT, "app")
DOCS = os.path.join(ROOT, "docs")
SKIP = {"tests", "package.json", "node_modules", "sw.js"}

def main():
    data = appdata.main()                                           # writes docs/data/content.json
    for name in os.listdir(DOCS):                                   # clean everything except the data we just wrote
        if name == "data": continue
        p = os.path.join(DOCS, name); shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    for name in os.listdir(APP):
        if name in SKIP: continue
        src, dst = os.path.join(APP, name), os.path.join(DOCS, name)
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns("tests")) if os.path.isdir(src) else shutil.copy2(src, dst)
    pdfs = os.path.join(ROOT, "dist", "pdf")
    if os.path.isdir(pdfs): shutil.copytree(pdfs, os.path.join(DOCS, "pdf"))
    open(os.path.join(DOCS, ".nojekyll"), "w").close()
    files = []
    for base, _, names in os.walk(DOCS):
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), DOCS).replace(os.sep, "/")
            if rel.startswith("pdf/") or rel in (".nojekyll", "sw.js"): continue       # PDFs are fetched on demand, not pre-cached
            files.append(rel)
    files = sorted(files)
    # one cache version per change to any shipped file
    import hashlib
    h = hashlib.sha1()
    for f in files: h.update(f.encode()); h.update(open(os.path.join(DOCS, f), "rb").read())
    version = h.hexdigest()[:10]
    sw = open(os.path.join(APP, "sw.js"), encoding="utf-8").read().replace("__VERSION__", version).replace("__FILES__", json.dumps(["./"] + files))
    open(os.path.join(DOCS, "sw.js"), "w", encoding="utf-8", newline="\n").write(sw)
    print("app built in %s: %d files precached, cache version %s" % (DOCS, len(files), version))

if __name__ == "__main__":
    main()
