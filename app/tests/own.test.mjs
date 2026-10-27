import test from "node:test";
import assert from "node:assert/strict";
import { readyForOwn, cleanSentence, usesChunk, MIN_REPS, SESSION_SIZE } from "../js/lib/own.js";
import { createStore } from "../js/lib/store.js";
import { rowFor, applyRows } from "../js/lib/rows.js";

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test("lines are ready after two reviews and while nothing is written; corrected lines come first", () => {
  const gaps = [{ id: "a", created: "2026-10-01" }, { id: "b", created: "2026-10-02", kind: "corrected" }, { id: "c", created: "2026-10-03", mine: [{ id: "s1", text: "x y" }] }, { id: "d", created: "2026-10-04" }];
  const states = { a: { reps: 2 }, b: { reps: 2 }, c: { reps: 5 }, d: { reps: 1 } };
  assert.deepEqual(readyForOwn(gaps, states).map((g) => g.id), ["b", "a"]); assert.equal(MIN_REPS, 2);
  assert.equal(readyForOwn(Array.from({ length: 9 }, (_, i) => ({ id: "g" + i, created: "2026-10-0" + (i + 1) })), Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["g" + i, { reps: 3 }]))).length, SESSION_SIZE);
});
test("sentences are tidied; empty or one-word input is refused", () => {
  assert.equal(cleanSentence("  Vorrei   un caffè \n per favore "), "Vorrei un caffè per favore");
  assert.equal(cleanSentence(""), null); assert.equal(cleanSentence("ciao"), null); assert.equal(cleanSentence("12 34"), null);
  assert.equal(cleanSentence("ab ".repeat(200)).length <= 300, true);
});
test("did the sentence use the line? short lines as typed, accents forgiven", () => {
  assert.equal(usesChunk("Ieri ho perso il treno per Roma", "perso il treno"), true);
  assert.equal(usesChunk("Vorrei un caffe, per favore", "un caffè"), true);
  assert.equal(usesChunk("Mi piace la pizza", "perso il treno"), false);
  assert.equal(usesChunk("Dov'è la stazione dei treni?", "Dove si trova la stazione centrale?"), true);
  assert.equal(usesChunk("Buongiorno a tutti", "Dove si trova la stazione centrale?"), false);
});
test("the store keeps your sentences on the line, can confirm and remove them, and marks the line for upload", () => {
  const s = createStore(mem()), g = s.addGap({ it: "perso il treno", en: "missed the train", src: "manual" });
  s.markSent({ gaps: { [g.id]: s.state.sync.dirty.gaps[g.id] } }); assert.equal(s.hasDirty(), false);
  const e = s.addOwnSentence(g.id, "Ieri ho perso il treno."); assert.ok(e.id && !e.checked); assert.equal(s.state.gaps[0].mine.length, 1); assert.equal(s.hasDirty(), true);
  s.setOwnChecked(g.id, e.id, true); assert.equal(s.state.gaps[0].mine[0].checked, true);
  for (let i = 0; i < 7; i++) s.addOwnSentence(g.id, "Altra frase numero " + i); assert.equal(s.state.gaps[0].mine.length, 5);
  for (const m of [...s.state.gaps[0].mine]) s.removeOwnSentence(g.id, m.id); assert.equal(s.state.gaps[0].mine, undefined);
});
test("your sentences travel in the sync rows and come back", () => {
  const a = createStore(mem()), g = a.addGap({ it: "perso il treno", en: "missed the train", src: "manual" }); a.addOwnSentence(g.id, "Ieri ho perso il treno.");
  const row = rowFor("gaps", g.id, a.state, "2026-10-20T10:00:00.000Z"); assert.equal(row.own_sentences.length, 1); assert.equal(row.own_sentences[0].text, "Ieri ho perso il treno.");
  const b = createStore(mem()); const r = applyRows(b.state, { gaps: [{ ...row, created_on: g.created, deleted_at: null }] }).state;
  assert.equal(r.gaps[0].mine[0].text, "Ieri ho perso il treno."); assert.equal(r.gaps[0].mine[0].checked, false);
});
