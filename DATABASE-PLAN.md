# Database plan: from one JSON blob to proper tables

Status: **approved 2026-10-19; DB01-DB08 and DB11 built, DB09 and DB10 later** (plan stage `DB`, tasks DB01-DB11, decision D22). Written 2026-10-17.
The sync before this change is `supabase/legacy/italiano_progress.sql` with `app/js/lib/merge.js`; the new one is `supabase/schema.sql`, `app/js/lib/rows.js` and `app/js/lib/sync.js`.

## 1. Where we are

One table, `italiano_progress`, one row per user. The whole study state sits in a single `jsonb` column `data`:

| Part of the blob | What it holds | Shape today |
|---|---|---|
| `cards` | Flashcard schedule | `{cardId: {box, due, reps, lapses, last}}` |
| `daily` | One record per day | `{date: {blocks:{id:bool}, reviewed, newSeen, drills, retells}}` |
| `gaps` | Conversation log | list of `{id, it, en, tag, ctx, kind, note, src, provider, checked, created, updated}` |
| `gapsDeleted` | Tombstones for deleted log lines | list of ids, **capped at 500** |
| `ratings` | Role-play self ratings | `{scenarioId: {stars 1-3, last}}` |
| `drills` | Drill totals | `{kind: {sessions, correct, total}}` |

Settings (voice, theme, hand, translator, email) are per device and **never leave the device**. That stays true.

### What is wrong with it

1. **Lost updates between two devices.** Sync is "download everything, merge in the browser, upload everything". If phone and laptop sync within the same few seconds, the second upload can overwrite the first's changes. One user rarely hits this; it will happen.
2. **It only grows.** The whole blob is re-sent on every sync, and the table rejects anything over 1 MB. A year of daily records plus a few thousand log lines gets close.
3. **The database can't help.** It can't search the log, count corrections per grammar topic, or tell you how many cards are due. Every question has to be answered in the browser.
4. **Deletes are hacks.** The 500-item tombstone cap means a device that was off for a long time can bring a deleted line back.
5. **No validation.** Nothing stops a wrong value, a missing field or a typo in a key.
6. **Many users.** Row-level security already keeps users apart, but one big row per user makes every future feature (shared decks, a teacher view, statistics) awkward.

Not problems: privacy (RLS works), the key handling (publishable key only, kept on the device), offline use (the app works from local storage).

## 2. Goals and non-goals

Goals
- Each kind of data in its own table, with real types and constraints.
- Syncing sends **only what changed**, one row at a time, so two devices can't overwrite each other's work.
- Safe for many users: every row has a `user_id`, every table has row-level security, no user can see another's data.
- The app keeps working offline from local storage, exactly as now.
- Existing progress moves across without loss.
- Anyone who uses this repo can still set it up on their own free Supabase project.

Non-goals (now)
- No server-side content tables. Lessons stay in the YAML files; the database only stores *your* data and refers to content by its permanent id (for example `pb-banking.p146`).
- No accounts system of our own, no payments, no admin console.
- No change to how the app looks.

## 3. The big choice: whose Supabase project?

| | A. Each learner brings their own project (today) | B. One shared project run by you |
|---|---|---|
| Setup for a learner | Create a free project, run one SQL file, enter two values in Settings | Just sign up |
| Cost and limits | Each person's own free tier | All on your free tier (500 MB; projects pause after a week of inactivity unless upgraded) |
| Privacy | Your data is in your own project | You hold other people's study data and email addresses: privacy notice, deletion on request, GDPR duties |
| Abuse | None | Sign-up spam, so you'd need email confirmation, rate limits and CAPTCHA |
| Fits "free, open, anyone can pull the repo" | Yes | Only while you keep running it |

**Recommendation: keep A as the default. Design the schema so B works later without a rewrite.** That means every table is multi-user-safe from day one, but we do not build sign-up flows, a privacy page or abuse controls until you decide to host for others. This is the cheap way to keep the option open.

## 4. Proposed schema

All in the `public` schema, prefix `italiano_` so the tables can't clash with anything else in a project. `user_id` always references `auth.users(id) on delete cascade` (deleting a user deletes their data in one step).

Every synced row has two timestamps:
- `client_updated_at timestamptz`: set by the app when the user changed the row. Used to decide which version wins.
- `updated_at timestamptz`: set by the server on every write. Used as the cursor for "give me everything changed since I last synced".

### 4.1 `italiano_profiles` (one row per user)
`user_id` pk, `created_at`, `schema_version int`, `timezone text`, `prefs jsonb` (the small cross-device preferences such as new cards per day, if you want those to follow you; device settings stay local). Genuinely free-form data like preferences is the one good use of `jsonb`.

### 4.2 `italiano_card_states` (flashcard schedule)
```
user_id uuid, card_id text,                      -- primary key (user_id, card_id)
box smallint not null check (box between 0 and 7),
due date not null,
reps int not null default 0 check (reps >= 0),
lapses int not null default 0 check (lapses >= 0),
last_reviewed date,
client_updated_at timestamptz not null, updated_at timestamptz not null default now()
```
`card_id` is the content id (`p146.p1`) or a log-line id (`gap.<uuid>`). Index `(user_id, due)` makes "what is due today" a single index lookup.

### 4.3 `italiano_review_events` (append-only history, phase 2)
`id uuid` (made by the app, so a retry can't double-insert) pk, `user_id`, `card_id`, `grade text check in ('again','good','easy')`, `reviewed_at timestamptz`, `box_before`, `box_after`.
Why: it makes daily counts exact when two devices review on the same day (see 4.4), gives real statistics, and lets us change the scheduling algorithm later (for example to FSRS) by replaying history. It is optional and can come after the first migration. Rows are never edited, so there are no conflicts.

### 4.4 `italiano_daily` (one row per user per day)
`user_id, day date` pk, `blocks text[]` (ids of the Today blocks you ticked), `reviewed int`, `new_seen int`, `drills int`, `retells int`, timestamps.
Merging: `blocks` merges as a union, as today. The counters use "highest value wins", as today, which under-counts if two devices both review on the same day. Once review events exist (4.3) the counters can be calculated from them, which fixes that. Until then it stays as is; the streak only cares whether a day was active, so the effect is small.

### 4.5 `italiano_log_entries` (the conversation log; today's `gaps`)
```
id text not null check (id <> ''),               -- made by the app (works offline); primary key is (user_id, id)
user_id uuid not null,
italian text not null, english text not null,
situation text, kind text check (kind in ('wanted','heard','corrected')),
note text, grammar_tag text,                     -- id of a grammar lookup row in the content
source text not null check (source in ('manual','translate')),
provider text,                                   -- 'chrome' | 'mymemory' | null
checked boolean not null default false,
created_on date not null,
deleted_at timestamptz,                          -- soft delete: replaces the 500-item tombstone list
client_updated_at timestamptz not null, updated_at timestamptz not null default now()
```
Indexes: `(user_id, updated_at)` for sync, `(user_id, created_on desc)` for the list, and later a `pg_trgm` index on `italian`/`english` if server-side search is ever wanted (the app's search stays in the browser, which is instant at this size).
Soft delete means a device that was offline for months still learns the line was deleted. A weekly clean-up can remove rows deleted more than a year ago.

Existing log ids look like `gap.mgx4k2` and are not UUIDs. The id is therefore `text`, the primary key is `(user_id, id)`, old rows keep their ids, and new rows use UUID strings. This avoids rewriting ids already referenced by `card_states`, and two users can never clash on an id.

### 4.6 `italiano_scenario_ratings`
`user_id, scenario_id text` pk, `stars smallint check (stars between 1 and 3)` (1 Rough, 2 OK, 3 Smooth), `rated_on date`, timestamps.

### 4.7 `italiano_drill_stats`
`user_id, kind text` pk, `sessions int`, `correct int`, `total int`, timestamps. (Later, a per-session `italiano_drill_sessions` table would give a progress chart. Not needed now.)

### 4.8 Security on every table
- `alter table ... enable row level security`.
- Four policies per table (select, insert, update, and delete only where deleting is allowed), all `to authenticated`, all `(select auth.uid()) = user_id`; insert and update also `with check`.
- `revoke all ... from anon`; grant only what each table needs to `authenticated`. (New tables are not exposed automatically in Supabase, so grants are explicit.)
- Foreign key and every query lead with `user_id`, so the policy check and the indexes work together.
- Size and shape checks (`char_length(italian) <= 1000`, and so on) so one bad client can't fill the database.
- Functions use `set search_path = ''`.

### 4.9 Conflict rule in the database itself
A `before update` trigger on each synced table: if the incoming `client_updated_at` is **older** than the stored one, skip the write (return `null`). The app can then upload with a plain "upsert" and the database refuses to let an older edit overwrite a newer one. This also makes retries safe (sending the same row twice changes nothing).
One honest weak spot: it trusts each device's clock. A phone with a badly wrong clock could win or lose conflicts unfairly. Mitigation: the app compares the phone clock with the server's `Date` header on every sync and corrects its timestamps by the difference.

## 5. How syncing changes

Today: `GET row → merge in browser → POST row`.
New: for each table, in this order (profiles, log entries, card states, daily, ratings, drills):
1. **Pull:** `select * where updated_at > :cursor order by updated_at` (page of 500). The cursor is the largest `updated_at` seen, stored per table on the device.
2. **Apply** pulled rows to local storage. For each row, newest `client_updated_at` wins; the app keeps its own rule that a deleted entry stays deleted.
3. **Push:** upsert only the rows marked "changed since last push" (the store keeps a small set of changed ids per table). One request per table, batched.
4. **Clear** the changed marks only after the server confirms.

What stays the same: the local store, the backup file format (v1 backups still import), offline behaviour, the setup screen, the way the key is kept on the device, and the sync button and status line. The new code is a pure "state ⇄ rows" translation module plus a rewritten `sync.js`, so it can be unit-tested without a server, like `merge.js` is now.

## 6. Moving existing data across (as built)

1. You run **one file**, `supabase/schema.sql`, in the SQL editor. It only adds tables; the old `italiano_progress` table is untouched. (The old SQL file now lives in `supabase/legacy/`.)
2. The next time the app syncs, it notices this device has not synced with the new tables yet, reads the old row (if the table exists), merges it with what is on the device, and uploads everything into the new tables. It does this once per device and project. No second SQL script and no manual copying, and it is tested with a fake server.
3. If the project does not have the new tables yet, Settings says exactly what to do ("run supabase/schema.sql, then sync again") and your data stays safe on the device.
4. Later (task DB10), once you have checked everything arrived, you can revoke writes on the old table and then drop it. Not urgent.

Before the first sync after upgrading, take a backup from Settings → Progress backup. That file is the rollback plan.

**Moving to another Supabase project** (decision D22): run `schema.sql` in the new project, change the address and key in Settings, sign in. The app sees a different project and uploads everything from this device. Rows never carry a user id from the device; the signed-in user's id is added when uploading, so the same data lands under the new account.

## 7. Work breakdown (each task small, with a check)

| Id | Task | Done when |
|---|---|---|
| DB01 | Write `supabase/schema.sql` and numbered migrations for tables, constraints, indexes, RLS, grants, the older-edit-loses trigger, and `italiano_schema_version()` | Runs cleanly twice on an empty project; Supabase's security advisor shows no warnings for the new tables |
| DB02 | `app/js/lib/rows.js`: pure functions turning local state into rows and rows into local state (all six tables) | Unit tests: round trip is lossless; old v1 backup converts correctly |
| DB03 | Change tracking in the store: which ids changed since the last push, per table | Test: changing one card marks only that card |
| DB04 | Rewrite `sync.js` to the pull/apply/push loop with cursors, batching and clock correction | Tests with a fake server: two devices editing at once keep both edits; offline edits upload later; a deleted entry stays deleted |
| DB05 | The app copies the old blob into the tables on first sync (replaces the SQL migration file) | Fake-server test; on your real data the counts match |
| DB06 | Schema-version check and the "run the upgrade SQL" message in Settings | An old project shows the message; a new one syncs |
| DB07 | Two-user security test script `tools/rls-check.mjs` | User A cannot read, change or delete user B's rows in any table |
| DB08 | Update the README setup steps and `docs` text | A new learner can set up from the README alone |
| DB09 | Review events table and calculating daily counts from it (optional, later) | Two devices reviewing the same day give the exact total |
| DB10 | Lock and later drop the old blob table | Old table read-only, then gone |

Order: DB01 → DB02 → DB03 → DB04 → DB05 → DB06 → DB07 → DB08 → DB10. DB09 any time after DB04.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Migration loses or duplicates data | Backup first; the copy function is repeatable; compare counts; keep the old table read-only for a month |
| A device with a wrong clock overwrites newer work | Clock correction from the server's time on each sync; the database refuses older edits |
| A device that was offline for a long time brings back deleted lines | Soft deletes kept for a year |
| Policies written wrong, so users see each other's data | Two-user test script (DB07); Supabase security advisor; policies on every table written from one template |
| Nobody can test the SQL here: the Supabase connector in this setup only sees the unrelated Law_Firm_DB project, which must never be touched | You run the SQL in your own project (`gebbkrttofqrytialpgx`); the checks above use a real sign-in against it. Optionally test on a scratch Supabase project first |
| The change is bigger than the benefit while you are the only user | It is a real cost (about 10 small tasks). See the decision below |

## 9. Decisions (answered 2026-10-19)

1. **Do this now or later?** The blob works for one user. The real triggers for switching are: you use two devices at the same time, the log passes a few thousand lines, or you want others on a shared backend. Doing it now means one migration while the data is small and easy to check; doing it later means a bigger migration. My recommendation: **do it now, but in the order above, and stop after DB06 if you want to pause.**
2. **Model A or B** (section 3)? Recommended: A, with a multi-user-safe schema.
3. **Review events (DB09):** include now, or later? Recommended: later.
4. **Should preferences like new cards per day follow you between devices** (stored in `prefs`)? Recommended: yes for study preferences, no for voice, theme, hand and translator.
5. **Keep log ids as they are** (text, old and new together), or rewrite them all to UUIDs? Recommended: keep (less to go wrong).

Answers: (1) do it now; (2) each learner brings their own project, with an easy move to a shared backend; (3) review events later; (4) study preferences follow you; (5) keep the existing log ids.

**Moving to a shared backend (from answer 2).** Two design rules make this easy: the app never trusts a `user_id` stored on the device (it always uses the signed-in user's id when pushing), and every row can be re-sent. So moving to another project is: sign in to the new project, mark every row as changed, push. That is task DB11.
