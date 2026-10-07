# Plan

The plan now lives in small files under `plan/` (one per stage, task, decision and risk).
The old single-file plan is kept at `_archive/PLAN-monolith.md`.

    python build/plan.py                 status board
    python build/plan.py --next          what is ready to do next
    python build/plan.py --task M01      one task in full
    python build/plan.py --set M01 done  update a status

Change one thing by editing one file: `plan/tasks/<id>.yaml`, `plan/decisions/<id>.yaml`, `plan/risks/<id>.yaml`.
Rules: a task is size S or M only (split anything bigger); each has one change and a done_when check; ids are permanent.
