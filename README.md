# Learn Italian: a free, open study pack

A small, free set of PDFs and a plan for English speakers learning Italian from zero to about A2.
It is built around five ideas and nothing else: **cognates, reading with audio, grammar only when you need it,
speaking early, and surrounding yourself with Italian.** Every resource it links to is free.

## Start in two minutes
1. Download or clone this repo: `git clone <this repo's URL>`
2. Open `dist/pdf/00-START-HERE.pdf`.
3. Do 30 minutes a day: 10 min reading with audio, 10 min speaking out loud, 10 min of real Italian (a podcast, video or TV).

You do not need to install anything to learn. The PDFs are already built.

## What is inside
| PDF (in `dist/pdf/`) | Step | What you get |
|---|---|---|
| `00-START-HERE.pdf` | Overview | The 5-step path and a 30-minute daily routine |
| `01-Cognates-and-Grammar-Lookup.pdf` | 1 and 3 | English-to-Italian word patterns, false friends, and a "when you're stuck on X" grammar table |
| `02-Read-with-Audio.pdf` | 2 | Free stories with audio, a method, a 4-week schedule |
| `03-Speak-Now.pdf` | 4 | 14 key phrases, a kit for starting conversations, 8 real-life scenarios (café, flat hunting, university, bureaucracy...), short writing tasks |
| `04-Italian-Home.pdf` | 5 | A small set of free podcasts, videos and TV to repeat, with a weekly rhythm |
| `05-Everyday-Basics.pdf` | 4 | Numbers, time, days, months, weather, greetings, places, emergencies |

## Free means free
Everything linked is free to use. Some sites also sell apps or courses; they are marked "ignore" in the files and you never need them.
Links were opened and checked on the date recorded in each file in `content/resources/`. Links rot, so tell us if one breaks.

## The app (works on your phone, offline)
A small study app lives in `docs/` and is published with GitHub Pages: a daily 30-minute plan, flashcards with spaced repetition,
number/time/date drills, role-play scenarios and a log for words you get wrong. It installs to your home screen and works offline
after the first visit. Your progress stays on your device (Settings has a backup you can move to another device).

Run it locally: `python -m http.server 8000 --directory docs`, then open http://localhost:8000.

**Publish it (maintainer):** GitHub repo, Settings, Pages, "Deploy from a branch", branch `main`, folder `/docs`.
Rebuild the app after content changes with `python build/app.py` and commit `docs/`.
The app uses your portfolio's "Study Room at Dusk" design tokens (`app/styles.css`).

## Rebuild the PDFs (optional)
```
pip install -r requirements.txt
python build/all.py
```
Needs Python 3.9+. The build looks for Arial, Liberation Sans or DejaVu Sans; set `ITALIAN_FONT_DIR` to a folder with
`regular.ttf`, `bold.ttf` and `italic.ttf` if none is found. Checking links: `python build/linkcheck.py`.

## How the repo is organised
Content is split into small files so any one thing is easy to fix or replace:
`content/` (modules, one block per file; one file per link; fact-check ledger), `schema/` (what files may contain),
`build/` (checker, link checker, PDF and app builders), `app/` (web app source), `docs/` (built app for GitHub Pages), `plan/` (roadmap: one file per task; run `python build/plan.py`).
See [CONTRIBUTING.md](CONTRIBUTING.md) for how to fix, add or remove things.

## Roadmap
`python build/plan.py` prints the board. Next: more grammar rows and a pronunciation module.

## Credits and honest limits
- The five-step method follows Olly Richards' video "How I Would Learn Italian (if I could start over in 2026)" (StoryLearning).
  Method ideas also come from Joy of Languages and the Italy Made Easy mini-course. This project is not affiliated with any of them.
- We link to other people's work; we do not copy it. Sources for facts are recorded in `content/ledger/`.
- This is a study aid made by a learner, not a textbook. It can contain mistakes, and information about bureaucracy
  (permits, tax code, bank accounts) is general: always check official sources. Corrections are welcome.

## License
Content (the study material, PDFs and plan): [CC BY-SA 4.0](LICENSE-CONTENT.md). Code (`build/`, `schema/`, `.github/`): [MIT](LICENSE).
Contributions are accepted under the same licenses.
