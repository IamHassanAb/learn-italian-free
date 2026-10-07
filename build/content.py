# -*- coding: utf-8 -*-
"""Loads the content/ tree. Structural problems are collected (not raised) so lint can report them all."""
import os, re, html
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "content")
SCHEMA = os.path.join(ROOT, "schema", "blocks.yaml")

def _yaml(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)

def _ids(folder):
    if not os.path.isdir(folder): return []
    return sorted(f[:-5] for f in os.listdir(folder) if f.endswith(".yaml"))

class Content:
    def __init__(self):
        self.problems = []
        self.schema = _yaml(SCHEMA)
        self.resources, self.bundles, self.steps, self.modules, self.ledger = {}, {}, {}, {}, {}
        self.manifest = []
        self._load()

    def err(self, msg): self.problems.append(msg)

    def _load(self):
        for kind, store in (("resources", self.resources), ("bundles", self.bundles), ("steps", self.steps), ("ledger", self.ledger)):
            folder = os.path.join(CONTENT, kind)
            for name in _ids(folder):
                d = _yaml(os.path.join(folder, name + ".yaml"))
                if not isinstance(d, dict): self.err("%s/%s.yaml: not a mapping" % (kind, name)); continue
                if d.get("id") != name: self.err("%s/%s.yaml: id %r does not match file name" % (kind, name, d.get("id")))
                store[name] = d
        mpath = os.path.join(CONTENT, "manifest.yaml")
        self.manifest = (_yaml(mpath) or {}).get("modules", []) if os.path.exists(mpath) else []
        if not self.manifest: self.err("manifest.yaml: missing or empty")
        folders = _ids_dirs(os.path.join(CONTENT, "modules"))
        for mid in folders:
            if mid not in self.manifest: self.err("modules/%s: folder exists but is not listed in manifest.yaml (orphan)" % mid)
        for mid in self.manifest:
            mdir = os.path.join(CONTENT, "modules", mid)
            mfile = os.path.join(mdir, "module.yaml")
            if not os.path.exists(mfile): self.err("manifest lists %r but modules/%s/module.yaml is missing" % (mid, mid)); continue
            m = _yaml(mfile)
            if m.get("id") != mid: self.err("modules/%s/module.yaml: id %r does not match folder name" % (mid, m.get("id")))
            listed = m.get("parts", []) or []
            loaded = []
            for pname in listed:
                pfile = os.path.join(mdir, "parts", pname + ".yaml")
                if not os.path.exists(pfile): self.err("%s lists part %r but parts/%s.yaml is missing" % (mid, pname, pname)); continue
                p = _yaml(pfile)
                if p.get("id") != "%s.%s" % (mid, pname): self.err("%s/parts/%s.yaml: id %r should be %r" % (mid, pname, p.get("id"), "%s.%s" % (mid, pname)))
                p["_name"] = pname
                loaded.append(p)
            for pname in _ids(os.path.join(mdir, "parts")):
                if pname not in listed: self.err("%s/parts/%s.yaml exists but is not listed in module.yaml (orphan)" % (mid, pname))
            m["_parts"] = loaded
            self.modules[mid] = m

    # ---- inline markup -> reportlab markup
    def inline(self, s):
        s = html.escape(str(s), quote=False)
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        s = re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)
        def link(m):
            r = self.resources.get(m.group(1))
            if not r: return m.group(2)
            return '<a href="%s" color="blue">%s</a>' % (html.escape(r["url"], quote=True), m.group(2))
        return re.sub(r"\[\[res:([^|\]]+)\|([^\]]*)\]\]", link, s)

def _ids_dirs(folder):
    if not os.path.isdir(folder): return []
    return sorted(d for d in os.listdir(folder) if os.path.isdir(os.path.join(folder, d)))
