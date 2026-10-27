# Plan

The plan lives in small files under `plan/` (one per stage, task, decision and risk). The old single-file plan is kept at `_archive/PLAN-monolith.md`.

    python build/plan.py                 status board
    python build/plan.py --next          what is ready to do next
    python build/plan.py --task M01      one task in full
    python build/plan.py --set M01 done  update a status

Change one thing by editing one file: `plan/tasks/<id>.yaml`, `plan/decisions/<id>.yaml`, `plan/risks/<id>.yaml`.
Rules: a task is size S or M only (split anything bigger); each has one change and a done_when check; ids are permanent.

This page is the living summary: where we are, what is left and what comes next. Last updated 2026-10-22. The board is the source of truth for task status.

## The goal (unchanged)

Learn Italian by **using** it, not by studying rules. The method is Olly Richards' five steps, taken from the videos and the Italy Made Easy course:

1. **Lean hard on cognates.** Use the English you already have (-tion to -zione).
2. **Read with audio.** Stories with sound, retell them in four sentences.
3. **Let grammar come to you.** Look a rule up only when you get stuck on it.
4. **Speak before you're ready.** Low-stakes places first; expect people to switch to English.
5. **Build an Italian home.** Podcasts, video and TV every day.

Everything is free, runs on a phone, and works offline. A day is 30 minutes: 10 reading with audio, 10 speaking out loud, 10 of real Italian.

## Review against the goal (2026-10-22)

We have not dropped the goal, but the weight has drifted.

**On target:** the Today plan, flashcards made of phrases (not rules), the role-play scenarios, Retell it, the 200-phrase book, and above all **Translate and log**: real conversations become your own flashcards. That is learning by use.

**Plumbing (needed, but not learning):** about 24 of the 58 finished tasks are sync, the database tables and phone polish (stages S, DB, H). Useful, and you asked for them, but they do not teach Italian by themselves.

**The gap:** the content that came from the videos is almost untouched. Stage M (the mini-course: pronunciation, formality, the speaking caution, accents, immersion method) is 1 of 25 tasks done. And Step 1, cognates, has reading material but no practice at all (new task B19).

**Where we lean toward rules:** the grammar rows (M02 to M10) and the avere/essere participle drill (R04) are rule-learning, and the CILS mock exam (R09) is test prep. They are fine as lookups or on demand, but they should not lead.

**Principle going forward:** a new feature must serve one of the five steps. Grammar is written when your own log shows you keep getting it wrong (task T08), not in advance.

## Done

Stages A (content in YAML, PDFs), C (scenario role-play) complete. B (the app) 15 of 18. T (translate and log) 5 of 10: translator, log, flashcards from the log. H (phone first) 10 of 11. DB (database tables) 9 of 11. S (sync) 5 of 10. R (deeper role-play) 3 of 9: scenario tiers, the Tu or Lei drill, "make it harder" prompts. Search with filters, self-hosted fonts, the two-user security tests.

## Left for you (only you can do these)

1. **B13** turn on GitHub Pages (repo Settings, Pages, branch main, folder /docs).
2. **S05** run `supabase/schema.sql` in your Supabase SQL editor, then **S06 to S08**: sign-ups off, create your user, sign in on each device, check sync on two devices. Take a backup from Settings first.
3. **H11 / B16** try the app on your phone: keyboard, notch, one-handed Review.
4. **P01** have a native speaker read the 200-phrase book and the new scenario lines.
5. Decide what to do with `checklist-A1-version-2.0 (1).doc` in the project folder (left uncommitted; ignore it in git if it is not yours).
6. **S10** rotate the publishable key only if the repo ever goes public with a key in it (the key is not in the repo now).

## Next, in this order (proposed)

0. **Install on the phone (stage I, I01 to I06).** The owner asked for this first: one tap puts the app on the home screen so it is easy to find. Plan: see the board, decision D24, risk R10.
1. **Use it.** Steps 1 to 3 above, then log real conversations. Your own use should drive what comes next.
2. **Learn from your own log:** T06 own-sentence cards, T07 cloze cards, T08 recurring-error view. This is the method at its best.
3. **The video content (stage M, the useful half):** M14 to M17 pronunciation, M19 and M21 formality and the speaking caution, M22 accents and dialects, M23 and M24 the Italian home. Then **B19** cognate practice.
4. **Real life:** R05 words you will hear, R06 healthcare as a resident, R08 how bars and tickets really work, R07 minimal pairs.
5. **Only when needed:** M02 to M10 grammar rows (write the one your log points to), T09 paste import.

## Parked unless you say otherwise

R04 participle drill (rule drilling), R09 CILS practice (only if you plan the exam), DB09 review-history table, DB10 dropping the old table, T10 hidden-key translator, stage D (Claude as a conversation partner, blocked: a static site cannot hold an API key), stage Z (later).

## Questions for you

- Apply the order above and park R04 and R09? (Nothing is changed in the board until you say yes.)
- Tier 4 (open conversation) is not built: it needs a partner who answers. A self-run "topic cards" mode is possible; say if you want it.
