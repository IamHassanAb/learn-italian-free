# -*- coding: utf-8 -*-
"""Open every resource URL and report status. Never edits content. Output: dist/linkcheck.json
Note: youtube.com answers 200 even for ids that do not exist, so YouTube rows say 'loads' and still need a human look."""
import os, sys, json, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import Content, ROOT

def check(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "en"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, url
    except Exception as e:
        return 0, "%s: %s" % (type(e).__name__, e)

def main():
    c, rows = Content(), []
    for rid, r in sorted(c.resources.items()):
        status, final = check(r["url"])
        yt = "youtube.com" in r["url"] or "youtu.be" in r["url"]
        verdict = "OK" if status == 200 else ("DEAD" if status in (404, 410) else "CHECK")
        if verdict == "OK" and yt: verdict = "OK (youtube: loads; confirm content by eye)"
        rows.append(dict(id=rid, url=r["url"], status=status, final=final if final != r["url"] else "", verdict=verdict, cost=r["cost"], verified=r["verified"]))
        print("%-34s %-4s %s" % (rid, status, verdict))
    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    with open(os.path.join(ROOT, "dist", "linkcheck.json"), "w", encoding="utf-8") as f: json.dump(rows, f, indent=1, ensure_ascii=False)
    bad = [x for x in rows if x["verdict"] in ("DEAD",)]
    print("\n%d resources, %d dead" % (len(rows), len(bad)))
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
