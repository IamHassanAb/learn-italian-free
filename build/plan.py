# -*- coding: utf-8 -*-
"""Plan board. Usage:
  python build/plan.py                 status board by stage (and validates the plan)
  python build/plan.py --next          tasks that are ready (todo, all dependencies done)
  python build/plan.py --task M01      show one task
  python build/plan.py --set M01 done  change a task's status (todo | doing | done | blocked)"""
import os, re, sys, yaml
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, "plan")
STATUSES = ("todo", "doing", "done", "blocked")

def load(kind):
    d, folder = {}, os.path.join(PLAN, kind)
    for f in sorted(os.listdir(folder)):
        if f.endswith(".yaml"):
            x = yaml.safe_load(open(os.path.join(folder, f), encoding="utf-8")); d[f[:-5]] = x
            if x.get("id") != f[:-5]: print("ERROR plan/%s/%s: id %r does not match file name" % (kind, f, x.get("id")))
    return d

def validate(stages, tasks):
    errs = []
    for tid, t in tasks.items():
        if t["stage"] not in stages: errs.append("%s: unknown stage %r" % (tid, t["stage"]))
        if t["status"] not in STATUSES: errs.append("%s: bad status %r" % (tid, t["status"]))
        for d in t.get("depends_on", []):
            if d not in tasks: errs.append("%s: depends on unknown task %r" % (tid, d))
        if t.get("size") not in ("S", "M"): errs.append("%s: size must be S or M (split bigger tasks)" % tid)
        if t["status"] == "done":
            for d in t.get("depends_on", []):
                if d in tasks and tasks[d]["status"] != "done": errs.append("%s is done but depends on %s (%s)" % (tid, d, tasks[d]["status"]))
    return errs

def main(argv):
    stages, tasks = load("stages"), load("tasks")
    errs = validate(stages, tasks)
    if "--set" in argv:
        tid, st = argv[argv.index("--set") + 1], argv[argv.index("--set") + 2]
        if tid not in tasks or st not in STATUSES: sys.exit("usage: --set <task-id> <todo|doing|done|blocked>")
        p = os.path.join(PLAN, "tasks", tid + ".yaml"); s = open(p, encoding="utf-8").read()
        open(p, "w", encoding="utf-8", newline="\n").write(re.sub(r"^status: .*$", "status: " + st, s, count=1, flags=re.M))
        print("%s -> %s" % (tid, st)); return
    if "--task" in argv:
        t = tasks[argv[argv.index("--task") + 1]]
        print(yaml.safe_dump(t, allow_unicode=True, sort_keys=False, width=110)); return
    if "--next" in argv:
        for tid, t in tasks.items():
            if t["status"] == "todo" and all(tasks[d]["status"] == "done" for d in t.get("depends_on", [])):
                print("%-4s [%s] %s" % (tid, t["size"], t["title"]))
        return
    for sid, s in sorted(stages.items(), key=lambda kv: kv[1].get("order", 99)):
        ts = [t for t in tasks.values() if t["stage"] == sid]
        n = {k: sum(1 for t in ts if t["status"] == k) for k in STATUSES}
        print("\n%s  %s   (%d done / %d total)" % (sid, s["title"], n["done"], len(ts)))
        for t in ts:
            mark = {"done": "x", "doing": "~", "blocked": "!", "todo": " "}[t["status"]]
            print("  [%s] %-4s %s %s" % (mark, t["id"], t["size"], t["title"]))
    print("\n%d tasks | %d decisions | %d risks" % (len(tasks), len(load("decisions")), len(load("risks"))))
    for e in errs: print("ERROR", e)
    sys.exit(1 if errs else 0)

if __name__ == "__main__":
    main(sys.argv[1:])
