# Contributing

Thank you for helping other learners. Small, careful changes are best: one fix, one row, one resource per pull request.

## Ground rules
1. **Free only.** Every linked resource must be free to use. Paid extras can be noted as "ignore", never recommended.
2. **Verify before you add.** Any Italian example or fact needs a second source (dictionary, grammar reference, native speaker).
   Record it in `content/ledger/` (claim, source, date). Never copy Italian from auto-generated captions.
3. **No copied material.** Link to resources; do not paste transcripts, book text or course content.
4. **Ids are permanent.** Never reuse an id. Retire things instead of recycling them.
5. **One block per file**, about 60 lines at most. Content files hold knowledge only: no layout, no raw URLs.
6. **Inline markup only:** `**bold**`, `*italic*`, `[[res:<resource-id>|link text]]`. No HTML.

## Everyday jobs
| I want to... | Do this |
|---|---|
| Fix a typo or reword | Edit that one file under `content/modules/<module>/parts/` |
| Change a link | Edit its file in `content/resources/` (every PDF updates) |
| Link to something in text | Write `[[res:<resource-id>|link text]]` |
| Add a part to a module | New file in `modules/<id>/parts/` (id = `<module>.<name>`), add `<name>` to that module's `module.yaml` |
| Reorder parts | Reorder the list in `module.yaml` |
| Add a module | New folder with `module.yaml`; add its id to `manifest.yaml`, its step in `steps/` and a bundle in `bundles/` |
| Remove a module | Delete its id from `bundles/`, `steps/` and `manifest.yaml`; the checker lists any leftovers |
| Re-order or re-bundle a PDF | Edit the one file in `content/bundles/` |
| Add a free resource | New file in `content/resources/` (copy an existing one: id, title, url, type, cost: free, level, verified date, notes) |

## Before you open a pull request
```
pip install -r requirements.txt
python build/lint.py        # must pass (the same check runs on GitHub)
python build/all.py         # rebuild PDFs if your change should appear in them, and commit dist/pdf/
```

## Where to start
`python build/plan.py --next` lists tasks that are ready. Each task file in `plan/tasks/` says what changes and how to know it is done.
Found a mistake or a good free resource but don't want to edit files? Open an issue with one of the templates.
