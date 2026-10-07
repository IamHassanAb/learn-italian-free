# -*- coding: utf-8 -*-
"""Export content for the web app: docs/data/content.json. Usage: python build/appdata.py"""
import os, sys, json, hashlib
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import Content, ROOT

def export(c):
    mods = {}
    for mid in c.manifest:
        m = c.modules[mid]
        mods[mid] = {k: v for k, v in m.items() if not k.startswith("_") and k != "parts"}
        mods[mid]["parts"] = [{k: v for k, v in p.items() if not k.startswith("_")} for p in m["_parts"]]
    res = {rid: {k: r[k] for k in ("title", "url", "type", "level", "cost", "notes") if k in r} for rid, r in c.resources.items() if r.get("status") != "deprecated"}
    pdfs = [{"id": b["id"], "title": b["title"], "subtitle": b["subtitle"], "file": b["filename"]} for b in sorted(c.bundles.values(), key=lambda b: b["id"]) if b.get("output") == "pdf"]
    today = [b for b in c.bundles.values() if b.get("output") == "app" and b["id"] == "app-today"]
    data = {
        "steps": [c.steps[k] for k in sorted(c.steps)],
        "order": list(c.manifest),
        "modules": mods,
        "resources": res,
        "pdfs": pdfs,
        "today": today[0]["blocks"] if today else [],
    }
    data["version"] = hashlib.sha1(json.dumps(data, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")).hexdigest()[:10]
    return data

def main():
    c = Content()
    if c.problems:
        print("Content has problems; run build/lint.py first:"); [print("  -", p) for p in c.problems]; sys.exit(1)
    data = export(c)
    out = os.path.join(ROOT, "docs", "data"); os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "content.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f: json.dump(data, f, ensure_ascii=False, separators=(",", ":"), default=str)
    cards = sum(len(p.get("items", [])) for m in data["modules"].values() for p in m["parts"] if p["type"] in ("vocab", "phrases"))
    print("wrote %s  (%d modules, %d card items, version %s, %d KB)" % (path, len(data["modules"]), cards, data["version"], os.path.getsize(path) // 1024))
    return data

if __name__ == "__main__":
    main()
