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
        if mid.startswith("scenario-") and m.get("tier") not in sch["module"]["tiers"]: errors.append("%s: scenarios need a tier from %s, got %r" % (mid, sch["module"]["tiers"], m.get("tier")))
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
            if p["type"] == "vocab":
                for it in p.get("items", []):
                    w = "%s item %s" % (where, it.get("id"))
                    for k in it:
                        if k not in sch["item_required"]["vocab"] + sch["item_optional"]: errors.append("%s: unknown field %r" % (w, k))
                    if "art" in it and it["art"] not in sch["articles"]: errors.append("%s: bad article %r" % (w, it["art"]))
                    if "swatch" in it and not re.fullmatch(r"#[0-9a-fA-F]{6}", str(it["swatch"])): errors.append("%s: swatch must be #rrggbb, got %r" % (w, it["swatch"]))
                    if "forms" in it:
                        f = it["forms"]
                        if not isinstance(f, dict) or "m" not in f or not set(f) <= set(sch["form_keys"]): errors.append("%s: forms needs m and only keys %s" % (w, sch["form_keys"]))
                    if "accept_forms" in it:
                        af = it["accept_forms"]
                        if not (isinstance(af, dict) and set(af) <= {"f", "mp", "fp"} and all(isinstance(v, list) for v in af.values())): errors.append("%s: accept_forms must map f, mp or fp to lists" % w)
                    if "accept" in it and not (isinstance(it["accept"], list) and all(isinstance(a, str) for a in it["accept"])): errors.append("%s: accept must be a list of words" % w)
            for field, s in strings({k: v for k, v in p.items()}):
                if s.count("**") % 2: errors.append("%s: unbalanced ** in %r" % (where, s[:50]))
                if re.search(r"</?[a-zA-Z]+[ >]", s): errors.append("%s: raw HTML tag in %r (use **bold** / *italic*)" % (where, s[:50]))
                for mm in MARK.finditer(s):
                    used_res.add(mm.group(1))
                    if mm.group(1) not in c.resources: errors.append("%s: unknown resource %r" % (where, mm.group(1)))
                if field in sch["italian_fields"]:
                    for w in re.findall(r"[A-Za-z]+", MARK.sub("", s)):
                        if w.lower() in ACCENT: warns.append("%s: %r in Italian text, did you mean %r?" % (where, w, ACCENT[w.lower()]))

    # word-list quality: no repeated words in a module (or across topic modules, which would give two flashcards for one word),
    # the masculine form matches the word, examples use the word
    topic_words = {}
    for mid, m in c.modules.items():
        seen_it = {}
        for p in m["_parts"]:
            if p["type"] != "vocab": continue
            for it in p.get("items", []):
                if not any(k in it for k in ("forms", "art", "swatch", "group")): continue          # only the topic word lists
                key = (it.get("it") or "").strip().lower()
                if key in seen_it: errors.append("%s: word %r appears twice (%s and %s)" % (mid, it.get("it"), seen_it[key], it.get("id")))
                seen_it[key] = it.get("id")
                if key in topic_words and topic_words[key] != mid: warns.append("%s: word %r is also in %s (two flashcards for one word)" % (mid, it.get("it"), topic_words[key]))
                topic_words.setdefault(key, mid)
                f = it.get("forms")
                if f and f.get("m") != it.get("it"): errors.append("%s item %s: forms.m %r must equal the word %r" % (mid, it.get("id"), f.get("m"), it.get("it")))
                if it.get("example") and not re.search(r"[.?!]$", str(it.get("it", ""))):          # a whole sentence (ends like a sentence) does not need its example to repeat it
                    wordforms = {str(it.get("it", "")).lower()} | {str(v).lower() for v in (f or {}).values()}
                    text = it["example"].lower()
                    if not any(re.search(r"(?<![a-zà-ù])" + re.escape(w) + r"(?![a-zà-ù])", text) for w in wordforms if w):
                        warns.append("%s item %s: the example does not contain the word or one of its forms: %r" % (mid, it.get("id"), it["example"]))

    # a topic's drills need the right fields on its words
    for mid, m in c.modules.items():
        kinds = m.get("drills")
        if not kinds: continue
        items = [it for p in m["_parts"] if p["type"] == "vocab" for it in p.get("items", [])]
        for k in kinds:
            if k not in sch["module"]["drills"]: errors.append("%s: unknown drill %r (allowed: %s)" % (mid, k, sch["module"]["drills"]))
        if len(items) < 4: errors.append("%s: drills need at least 4 words, found %d" % (mid, len(items)))
        if "swatch" in kinds and sum(1 for it in items if "swatch" in it) < 4: errors.append("%s: the swatch drill needs at least 4 words with a swatch" % mid)
        if "gender" in kinds and sum(1 for it in items if "forms" in it) < 3: errors.append("%s: the gender drill needs at least 3 words with forms" % mid)

    for name, d in c.ledger.items():
        if d.get("module") not in c.modules: errors.append("ledger/%s: unknown module %r" % (name, d.get("module")))
        for cl in d.get("claims", []):
            for k in ("claim", "source", "verified"):
                if k not in cl: errors.append("ledger/%s: claim missing %r" % (name, k))
    for step_id, s in c.steps.items():
        for mid in s.get("modules", []):
            if mid not in c.modules: errors.append("steps/%s: unknown module %r" % (step_id, mid))
    for bid, b in c.bundles.items():
        if b.get("output") not in sch["bundle"]["outputs"]: errors.append("bundles/%s: bad output %r" % (bid, b.get("output")))
        for k in sch["bundle"]["required_by_output"].get(b.get("output"), []):
            if k not in b: errors.append("bundles/%s: missing %r for output %s" % (bid, k, b.get("output")))
        for blk in b.get("blocks", []):
            for rid in blk.get("resources", []):
                used_res.add(rid)
                if rid not in c.resources: errors.append("bundles/%s: block %s uses unknown resource %r" % (bid, blk.get("id"), rid))
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
