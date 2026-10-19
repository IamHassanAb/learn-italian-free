import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../js/lib/store.js";
import { rowFor, collectDirty, applyRows, markAllDirty, emptySync, hasDirty, TABLE } from "../js/lib/rows.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
const fresh = () => createStore(mem());
const keysOf = (rows) => Object.fromEntries(Object.entries(rows).map(([t, l]) => [t, l.length]));

test("a new store has nothing to upload; each change marks only its own row", () => {
  const s = fresh(); assert.equal(s.hasDirty(), false);
  s.setCard("p1.a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-19" });
  assert.deepEqual(Object.keys(s.state.sync.dirty.cards), ["p1.a"]);
  assert.deepEqual(keysOf(collectDirty(s.state).rows), { italiano_card_states: 1 });
  s.markBlock("2026-10-19", "read", true); s.addDrill("2026-10-19", "numbers", 8, 10); s.setRating("scenario-bar", 3);
  assert.deepEqual(keysOf(collectDirty(s.state).rows), { italiano_card_states: 1, italiano_daily: 1, italiano_drill_stats: 1, italiano_scenario_ratings: 1 });
});

test("rows carry the right columns", () => {
  const s = fresh();
  s.setCard("p1.a", { box: 2, due: "2026-10-22", reps: 3, lapses: 1, last: "2026-10-19" });
  const g = s.addGap({ it: "Un caffè, per favore", en: "A coffee, please", ctx: "café", kind: "wanted", src: "translate", provider: "mymemory", checked: false });
  const c = rowFor("cards", "p1.a", s.state, "T"), l = rowFor("gaps", g.id, s.state, "T");
  assert.deepEqual(c, { card_id: "p1.a", box: 2, due: "2026-10-22", reps: 3, lapses: 1, last_reviewed: "2026-10-19", client_updated_at: "T" });
  assert.equal(l.italian, "Un caffè, per favore"); assert.equal(l.situation, "café"); assert.equal(l.source, "translate"); assert.equal(l.checked, false); assert.equal(l.deleted_at, null);
  s.addReviewed("2026-10-19", 4, 2); s.markBlock("2026-10-19", "speak", true);
  assert.deepEqual(rowFor("daily", "2026-10-19", s.state, "T"), { day: "2026-10-19", blocks: ["speak"], reviewed: 4, new_seen: 2, drills: 0, retells: 0, client_updated_at: "T" });
});

test("a deleted log line becomes a marker row with no text", () => {
  const s = fresh(); const g = s.addGap({ it: "segreto", en: "secret", src: "manual" });
  s.removeGap(g.id);
  const row = collectDirty(s.state).rows.italiano_log_entries[0];
  assert.equal(row.id, g.id); assert.ok(row.deleted_at); assert.equal(row.italian, "-"); assert.equal(row.english, "-");
});

test("only study preferences are shared; voice, theme and translator stay on the device", () => {
  const s = fresh(); s.setting("rate", 0.7); s.setting("theme", "dark"); assert.equal(s.hasDirty(), false);
  s.setting("newPerDay", 15);
  const row = collectDirty(s.state).rows.italiano_profiles[0];
  assert.deepEqual(Object.keys(row.prefs).sort(), ["decks", "direction", "newPerDay"]); assert.equal(row.prefs.newPerDay, 15);
});

test("uploading clears only what was sent; a change made meanwhile stays", () => {
  const s = fresh(); s.setCard("a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-19" });
  const { sent } = collectDirty(s.state);
  s.state.sync.dirty.cards.a = "2099-01-01T00:00:00.000Z";          // edited again during the upload
  s.markSent(sent); assert.equal(s.hasDirty(), true);
  s.markSent({ cards: { a: "2099-01-01T00:00:00.000Z" } }); assert.equal(s.hasDirty(), false);
});

test("pulling rows from the cloud into an empty device", () => {
  const s = fresh();
  const remote = {
    cards: [{ card_id: "p1.a", box: 3, due: "2026-10-30", reps: 4, lapses: 0, last_reviewed: "2026-10-18", client_updated_at: "2026-10-18T10:00:00+00:00" }],
    gaps: [{ id: "g1", italian: "Ciao", english: "Hi", situation: "café", kind: "heard", note: null, grammar_tag: null, source: "translate", provider: "mymemory", checked: true, created_on: "2026-10-17", deleted_at: null, client_updated_at: "2026-10-17T09:00:00+00:00" }],
    daily: [{ day: "2026-10-18", blocks: ["read"], reviewed: 12, new_seen: 5, drills: 1, retells: 0, client_updated_at: "2026-10-18T20:00:00+00:00" }],
    ratings: [{ scenario_id: "scenario-bar", stars: 2, rated_on: "2026-10-16", client_updated_at: "2026-10-16T10:00:00+00:00" }],
    drills: [{ kind: "numbers", sessions: 3, correct: 25, total: 30, client_updated_at: "2026-10-16T10:00:00+00:00" }],
    prefs: [{ prefs: { newPerDay: 20, direction: "it-en", decks: null }, client_updated_at: "2026-10-15T10:00:00+00:00" }],
  };
  const { state, changed } = applyRows(s.state, remote);
  assert.equal(changed, true); assert.equal(state.cards["p1.a"].box, 3); assert.equal(state.gaps[0].it, "Ciao"); assert.equal(state.gaps[0].checked, true);
  assert.deepEqual(state.daily["2026-10-18"].blocks, { read: true }); assert.equal(state.ratings["scenario-bar"].stars, 2); assert.equal(state.drills.numbers.sessions, 3);
  assert.equal(state.settings.newPerDay, 20); assert.equal(state.settings.direction, "it-en");
  assert.equal(hasDirty(state), false);                                // nothing to send back
  const again = applyRows(state, remote); assert.equal(again.changed, false);    // pulling the same rows twice changes nothing
});

test("two devices editing different things keep both edits", () => {
  const phone = fresh(), laptop = fresh();
  phone.setCard("a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-19" });
  const cloud = { cards: [{ ...rowFor("cards", "a", phone.state, "2026-10-19T10:00:00.000Z") }] };      // the phone uploaded
  laptop.setCard("b", { box: 1, due: "2026-10-21", reps: 1, lapses: 0, last: "2026-10-19" });
  const merged = applyRows(laptop.state, cloud).state;
  assert.ok(merged.cards.a && merged.cards.b);
  assert.deepEqual(Object.keys(merged.sync.dirty.cards), ["b"]);       // only the laptop's own card still needs uploading
});

test("the more recently reviewed card wins, and the loser's copy is replaced", () => {
  const s = fresh(); s.setCard("a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-18" });
  const newer = { card_id: "a", box: 4, due: "2026-11-01", reps: 5, lapses: 0, last_reviewed: "2026-10-19", client_updated_at: "2026-10-19T08:00:00.000Z" };
  const r = applyRows(s.state, { cards: [newer] }).state; assert.equal(r.cards.a.box, 4); assert.equal(r.sync.dirty.cards.a, undefined);
  const older = { ...newer, box: 0, reps: 1, last_reviewed: "2026-10-10" };
  const k = applyRows(r, { cards: [older] }).state; assert.equal(k.cards.a.box, 4);
  assert.ok(k.sync.dirty.cards.a > older.client_updated_at);            // kept, and will be uploaded with a later time so the database accepts it
});

test("daily records merge: blocks unite, counters take the larger value", () => {
  const s = fresh(); s.markBlock("2026-10-19", "read", true); s.addReviewed("2026-10-19", 3, 1);
  const remote = { daily: [{ day: "2026-10-19", blocks: ["speak"], reviewed: 9, new_seen: 0, drills: 2, retells: 0, client_updated_at: "2026-10-19T12:00:00.000Z" }] };
  const r = applyRows(s.state, remote).state, d = r.daily["2026-10-19"];
  assert.deepEqual(d.blocks, { read: true, speak: true }); assert.equal(d.reviewed, 9); assert.equal(d.newSeen, 1); assert.equal(d.drills, 2);
  assert.ok(r.sync.dirty.daily["2026-10-19"]);                          // the merged result differs from the cloud copy, so it is uploaded
});

test("log lines: newest edit wins; a delete elsewhere removes the line here", () => {
  const s = fresh(); const g = s.addGap({ it: "uno", en: "one", src: "manual" });
  s.markSent(collectDirty(s.state).sent);
  const edited = { id: g.id, italian: "uno!", english: "one", source: "manual", checked: false, created_on: g.created, deleted_at: null, client_updated_at: "2099-01-01T00:00:00.000Z" };
  assert.equal(applyRows(s.state, { gaps: [edited] }).state.gaps[0].it, "uno!");
  const gone = { ...edited, italian: "-", english: "-", deleted_at: "2099-01-02T00:00:00.000Z", client_updated_at: "2099-01-02T00:00:00.000Z" };
  const r = applyRows(s.state, { gaps: [gone] }).state; assert.equal(r.gaps.length, 0); assert.ok(r.gapsDeleted.includes(g.id));
});

test("a line deleted here stays deleted when an older live copy is pulled", () => {
  const s = fresh(); const g = s.addGap({ it: "due", en: "two", src: "manual" }); s.removeGap(g.id);
  const live = { id: g.id, italian: "due", english: "two", source: "manual", checked: false, created_on: g.created, deleted_at: null, client_updated_at: "2020-01-01T00:00:00.000Z" };
  const r = applyRows(s.state, { gaps: [live] }).state; assert.equal(r.gaps.length, 0);
  assert.ok(r.sync.dirty.gaps[g.id]);                                   // and the delete is still waiting to be uploaded
});

test("an edit made after a delete elsewhere brings the line back", () => {
  const s = fresh(); const g = s.addGap({ it: "tre", en: "three", src: "manual" }); s.markSent(collectDirty(s.state).sent);
  s.updateGap(g.id, { note: "edited offline" });
  const gone = { id: g.id, italian: "-", english: "-", source: "manual", checked: false, created_on: g.created, deleted_at: "2020-01-01T00:00:00.000Z", client_updated_at: "2020-01-01T00:00:00.000Z" };
  const r = applyRows(s.state, { gaps: [gone] }).state; assert.equal(r.gaps.length, 1); assert.ok(r.sync.dirty.gaps[g.id]);
});

test("existing data and old backups count as not yet uploaded, with their own times", () => {
  const raw = mem();
  raw.setItem("italiano-ogni-giorno:v1", JSON.stringify({ v: 1, settings: {}, cards: { a: { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-18" } }, daily: { "2026-10-18": { blocks: { read: true }, reviewed: 6, newSeen: 2, drills: 0, retells: 0 } }, gaps: [{ id: "gap.x", it: "ciao", en: "hi", created: "2026-10-10", updated: "2026-10-11T08:00:00.000Z", src: "manual" }], gapsDeleted: [], ratings: {}, drills: {} }));
  const s = createStore(raw);
  assert.equal(s.state.sync.dirty.cards.a, "2026-10-18T00:00:00.000Z"); assert.equal(s.state.sync.dirty.gaps["gap.x"], "2026-10-11T08:00:00.000Z");
  const { rows } = collectDirty(s.state); assert.deepEqual(keysOf(rows), { italiano_card_states: 1, italiano_daily: 1, italiano_log_entries: 1, italiano_profiles: 1 });
  // a newer cloud copy of the same card still wins over this old local one
  const r = applyRows(s.state, { cards: [{ card_id: "a", box: 5, due: "2026-12-01", reps: 9, last_reviewed: "2026-10-19", client_updated_at: "2026-10-19T09:00:00.000Z" }] }).state;
  assert.equal(r.cards.a.box, 5); assert.equal(r.sync.dirty.cards.a, undefined);
});

test("backups hold your data without upload bookkeeping, and importing one uploads everything", () => {
  const s = fresh(); s.setCard("a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-19" });
  const text = s.exportJSON(); assert.equal(JSON.parse(text).sync, undefined);
  const t = fresh(); assert.equal(t.importJSON(text).ok, true); assert.ok(t.state.sync.dirty.cards.a);
});

test("every kind has a table name", () => assert.equal(Object.keys(TABLE).length, 6));
test("markAllDirty is repeatable and resets cursors (used when moving to another project)", () => {
  const s = fresh(); s.setCard("a", { box: 1, due: "2026-10-20", reps: 1, lapses: 0, last: "2026-10-19" }); s.setCursors({ italiano_card_states: "X" });
  const m = markAllDirty(s.state); assert.deepEqual(m.sync.cursors, {}); assert.equal(markAllDirty(m).sync.dirty.cards.a, m.sync.dirty.cards.a);
  assert.deepEqual(emptySync().cursors, {});
});
