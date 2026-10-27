# Plan

The plan lives in small files under `plan/` (one per stage, task, decision and risk). The old single-file plan is kept at `_archive/PLAN-monolith.md`.

    python build/plan.py                 status board
    python build/plan.py --next          what is ready to do next
    python build/plan.py --task M01      one task in full
    python build/plan.py --set M01 done  update a status

Change one thing by editing one file: `plan/tasks/<id>.yaml`, `plan/decisions/<id>.yaml`, `plan/risks/<id>.yaml`.
Rules: a task is size S or M only (split anything bigger); each has one change and a done_when check; ids are permanent.

This page is the living summary: where we are, what is left and what comes next. Last updated 2026-10-28. The board is the source of truth for task status.

## The goal (unchanged)

Learn Italian by **using** it, not by studying rules. The method is Olly Richards' five steps, taken from the videos and the Italy Made Easy course:

1. **Lean hard on cognates.** Use the English you already have (-tion to -zione).
2. **Read with audio.** Stories with sound, retell them in four sentences.
3. **Let grammar come to you.** Look a rule up only when you get stuck on it.
4. **Speak before you're ready.** Low-stakes places first; expect people to switch to English.
5. **Build an Italian home.** Podcasts, video and TV every day.

Everything is free, runs on a phone, and works offline. A day is 30 minutes: 10 reading with audio, 10 speaking out loud, 10 of real Italian.

## Review against the goal (2026-10-22, still true)

We have not dropped the goal, but the weight has drifted: a lot went into plumbing (sync, database tables, phone polish, install) and into vocabulary drills, and less into the content that came from the videos (pronunciation, formality, the speaking caution, the Italian home: stage M, 1 of 25 done) and into practice for Step 1 (cognates, task B19). Vocabulary and phrases are "chunks", which fits the method; rule drilling (the participle drill R04, the CILS mock exam R09, the grammar rows M02 to M10) should not lead. **Principle:** a new feature must serve one of the five steps; grammar is written when your own log shows you keep getting it wrong (T08).

## Done since the last update

- **Install on the phone (stage I):** install banner and Settings card (one tap on Android, Share steps on iPhone and iPad), icon shortcuts, share link, QR code in the README. Still to do: I06, you installing it on your own phone.
- **Topic vocabulary drills (stage V):** nine topics built, each verified against sources with a ledger: colours, family and people, jobs and professions, school and studying, the classroom, countries and nationalities, searching for a job, places of work, hobbies. Five drill types (pick, type, listen, colour, masculine/feminine), an all-topics mixed round, missed words back into review, group headings, search by any form of a word, `07-Topic-Words.pdf`, and a Print this topic button. Left: V14, you doing a round of each on your phone.
- **Deeper role-play (stage R):** scenario tiers (R01), "make it harder" prompts for every scenario (R02), the Tu or Lei drill (R03).
- **Database and sync (stages DB, S):** real tables, row-by-row sync, change tracking, import of the old copy, tested on real Postgres. Still to do by you: run the SQL and set up sync (S05 to S08).
- **Learning from your own log (stage T):** repeated-mistakes card in the log, fill-in-the-blank flashcards from your logged sentences, and a Write session for sentences of your own, synced (database version 3: run `supabase/schema.sql` again when you set up sync; it is safe to run twice).
- **Fixes:** the Google Translate button now copies what you typed; an echoed translation ("sky" for sky) is replaced by the real one; every app file is checked to load in the tests.

## Left for you (only you can do these)

1. **S05 to S08** run `supabase/schema.sql` in your Supabase SQL editor, turn sign-ups off, create your user, sign in on each device, check sync on two. Take a backup from Settings first. (On iPhone and iPad, install the app first: the installed app keeps its own data.)
2. **I06 / H11 / B16** install the app on your phone and use it: keyboard, notch, one-handed Review, the install banner.
3. **V14** do a round of each vocabulary topic on your phone and tell me what feels wrong.
4. **P01** have a native speaker read the 200-phrase book, the new scenario lines and the topic word lists. The ledger marks every word that has only one source or no individual source.
5. **B13** is done: GitHub Pages is on.
6. **S10** rotate the publishable key only if the repo ever goes public with a key in it (the key is not in the repo now).

## Next, in this order (proposed)

1. **Use it.** Install it, do the daily plan, log real conversations. Your own use should drive what comes next.
2. **Learn from your own log:** built (T06 your own sentences, T07 fill-in-the-blank, T08 repeated mistakes). They need your conversations to work, so use Translate and log, then see what they show you. Still open here: T09 paste import.
3. **The video content (stage M, the useful half):** M14 to M17 pronunciation, M19 and M21 formality and the speaking caution, M22 accents and dialects, M23 and M24 the Italian home. Then **B19** cognate practice.
4. **Real life:** R05 words you will hear, R06 healthcare as a resident, R08 how bars and tickets really work, R07 minimal pairs.
5. **Only when needed:** M02 to M10 grammar rows (write the one your log points to), T09 paste import. Missing topic words noted in the ledgers (Germania, Svizzera and other countries, *borsa di studio*, *dipartimento*, *orario*) after a proper source check.

## Parked unless you say otherwise

R04 participle drill (rule drilling), R09 CILS practice (only if you plan the exam), DB09 review-history table, DB10 dropping the old table, T10 hidden-key translator, stage D (Claude as a conversation partner, blocked: a static site cannot hold an API key), stage Z (later). Tier 4 open conversation (needs a partner who answers; a self-run "topic cards" mode is possible if you want it).
