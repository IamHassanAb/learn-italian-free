# -*- coding: utf-8 -*-
"""Content checker. Usage: python build/lint.py   (exit 1 on errors; warnings do not fail)"""
import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import Content

# Common Italian words that must carry an accent. Heuristic, whole-word, only in Italian fields.
ACCENT = {"perche": "perché", "citta": "città", "universita": "università", "attivita": "attività", "possibilita": "possibilità",
          "piu": "più", "gia": "già", "cosi": "così", "caffe": "caffè", "puo": "può", "pero": "però", "poiche": "poiché",
          "lunedi": "lunedì", "martedi": "martedì", "mercoledi": "mercoledì", "giovedi": "giovedì", "venerdi": "venerdì"}
MARK = re.compile(r"\[\[res:([^|\]]+)\|([^\]]*)\]\]")

def strings(node, field=None):
    """Yield (field-name, string) for every string in a part, descending into lists/dicts."""
    if isinstance(node, str): yield field, node
    elif isinstance(node, list):
        for x in node: yield from strings(x, field)
    elif isinstance(node, dict):
        for k, v in node.items():
            if not str(k).startswith("_"): yield from strings(v, k)

def main():
    c = Content(); errors, warns = list(c.problems), []
    sch, ptypes = c.schema, c.schema["part_types"]
    used_res = set()

    def check_req(where, d, spec):
        for k in spec["required"]:
            if k not in d: errors.append("%s: missing required field %r" % (where, k))
        allowed = set(spec["required"]) | set(spec.get("optional", [])) | {"id", "type", "_name"}
        for k in d:
            if k not in allowed: warns.append("%s: unexpected field %r" % (where, k))

    for kind, store, spec in (("resources", c.resources, sch["resource"]), ("steps", c.steps, sch["step"]), ("bundles", c.bundles, sch["bundle"]), ("ledger", c.ledger, sch["ledger"])):
        for name, d in store.items():
            for k in spec["required"]:
                if k not in d: errors.append("%s/%s.yaml: missing required field %r" % (kind, name, k))
    for name, r in c.resources.items():
        if r.get("type") not in sch["resource"]["types"]: errors.append("resources/%s: bad type %r" % (name, r.get("type")))
        if r.get("cost") not in sch["resource"]["costs"]: errors.append("resources/%s: bad cost %r" % (name, r.get("cost")))
        if r.get("cost") != "free": warns.append("resources/%s: cost is %r (this pack should stay free)" % (name, r.get("cost")))
        if r.get("status") not in sch["resource"]["statuses"]: errors.append("resources/%s: bad status %r" % (name, r.get("status")))

    seen_ids = {}
    for mid, m in c.modules.items():
        for k in sch["module"]["required"]:
            if k not in m: errors.append("%s/module.yaml: missing required field %r" % (mid, k))
        if m.get("step") not in sch["module"]["steps"]: errors.append("%s: bad step %r" % (mid, m.get("step")))
        if m.get("skill") not in sch["module"]["skills"]: errors.append("%s: bad skill %r" % (mid, m.get("skill")))
        for p in m["_parts"]:
            where = "%s/parts/%s.yaml" % (mid, p["_name"])
            if p.get("id") in seen_ids: errors.append("%s: duplicate id %s (also %s)" % (where, p.get("id"), seen_ids[p.get("id")]))
            seen_ids[p.get("id")] = where
            spec = ptypes.get(p.get("type"))
            if not spec: errors.append("%s: unknown type %r" % (where, p.get("type"))); continue
            check_req(where, p, spec)
            if p["type"] in sch["item_required"]:
                ids = set()
                for it in p.get("items", []):
                    for k in sch["item_required"][p["type"]]:
                        if k not in it: errors.append("%s: item missing %r" % (where, k))
                    iid = str(it.get("id"))
                    if iid in ids: errors.append("%s: duplicate item id %s" % (where, iid))
                    ids.add(iid)
            for field, s in strings({k: v for k, v in p.items()}):
                if s.count("**") % 2: errors.append("%s: unbalanced ** in %r" % (where, s[:50]))
                if re.search(r"</?[a-zA-Z]+[ >]", s): errors.append("%s: raw HTML tag in %r (use **bold** / *italic*)" % (where, s[:50]))
                for mm in MARK.finditer(s):
                    used_res.add(mm.group(1))
                    if mm.group(1) not in c.resources: errors.append("%s: unknown resource %r" % (where, mm.group(1)))
                if field in sch["italian_fields"]:
                    for w in re.findall(r"[A-Za-z]+", MARK.sub("", s)):
                        if w.lower() in ACCENT: warns.append("%s: %r in Italian text, did you mean %r?" % (where, w, ACCENT[w.lower()]))

    for name, d in c.ledger.items():
        if d.get("module") not in c.modules: errors.append("ledger/%s: unknown module %r" % (name, d.get("module")))
        for cl in d.get("claims", []):
            for k in ("claim", "source", "verified"):
                if k not in cl: errors.append("ledger/%s: claim missing %r" % (name, k))
    for step_id, s in c.steps.items():
        for mid in s.get("modules", []):
            if mid not in c.modules: errors.append("steps/%s: unknown module %r" % (step_id, mid))
    for bid, b in c.bundles.items():
        for e in b.get("modules", []):
            mid = e["id"] if isinstance(e, dict) else e
            if mid not in c.modules: errors.append("bundles/%s: unknown module %r" % (bid, mid))
    for rid, r in c.resources.items():
        if rid not in used_res and r.get("status") == "active": warns.append("resources/%s: active but not referenced by any content" % rid)

    for w in warns: print("WARN ", w)
    for e in errors: print("ERROR", e)
    print("\n%d modules, %d parts, %d resources, %d bundles | %d errors, %d warnings" % (
        len(c.modules), sum(len(m["_parts"]) for m in c.modules.values()), len(c.resources), len(c.bundles), len(errors), len(warns)))
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
