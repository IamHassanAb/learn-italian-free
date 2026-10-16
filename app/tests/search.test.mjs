import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, buildIndex, search } from "../js/lib/search.js";

const content = {
  order: ["pb-health", "scenario-bar", "basics-time", "step3-grammar"],
  modules: {
    "pb-health": { title: "Healthcare", parts: [{ id: "p1", type: "phrases", items: [{ id: "a", it: "Dov'è la farmacia?", en: "Where is the pharmacy?" }, { id: "b", it: "Ho bisogno di un medico.", en: "I need a doctor." }] }] },
    "scenario-bar": { title: "Al bar", parts: [{ id: "p2", type: "vocab", items: [{ id: "a", it: "un caffè", en: "a coffee" }] }] },
    "basics-time": { title: "Time", parts: [{ id: "p3", type: "vocab", items: [{ id: "a", it: "l'ora", en: "the hour" }] }] },
    "step3-grammar": { title: "Grammar", parts: [{ id: "r1", type: "lookup-row", when: "Which word for 'the'?", answer: "il, lo, la" }] },
  },
};
const gaps = [
  { id: "g1", it: "Così così", en: "so-so", ctx: "café", kind: "heard", src: "translate", checked: false, created: "2026-10-10" },
  { id: "g2", it: "Un attimo, per favore", en: "One moment, please", ctx: "shop", kind: "corrected", src: "translate", checked: true, note: "said 'un momento'", created: "2026-10-12" },
  { id: "g3", it: "Ciao ragazzi", en: "Hi guys", src: "manual", created: "2026-10-14" },
];
const index = buildIndex(content, gaps);
const set = (...v) => new Set(v);
const ids = (r) => r.map((x) => x.id);

test("norm strips accents, case and punctuation", () => assert.equal(norm("Dov'è  la FARMACIA?"), "dov'e la farmacia"));
test("finds by English and by Italian, ignoring accents", () => {
  assert.equal(search(index, "pharmacy")[0].id, "p1.a");
  assert.equal(search(index, "farmacia")[0].id, "p1.a");
  assert.equal(search(index, "COSI")[0].id, "g1");
});
test("every word must match; one letter returns nothing", () => {
  assert.equal(search(index, "need doctor").length, 1);
  assert.equal(search(index, "need pharmacy").length, 0);
  assert.equal(search(index, "p").length, 0);
});
test("log notes and situations are searchable", () => {
  assert.equal(search(index, "momento")[0].id, "g2");
  assert.equal(search(index, "cafe").some((r) => r.id === "g1"), true);
});
test("filters: source, kind and topic combine", () => {
  assert.deepEqual(ids(search(index, "", { src: set("scenario") })), ["p2.a"]);
  assert.deepEqual(ids(search(index, "", { kind: set("word") })), ["p2.a", "p3.a"]);
  assert.deepEqual(ids(search(index, "", { src: set("phrasebook", "scenario"), kind: set("word") })), ["p2.a"]);
  assert.deepEqual(ids(search(index, "", { deck: set("basics-time") })), ["p3.a"]);
});
test("log filters: situation, kind, status; browsing is newest first", () => {
  assert.deepEqual(ids(search(index, "", { sit: set("café") })), ["g1"]);
  assert.deepEqual(ids(search(index, "", { logKind: set("corrected") })), ["g2"]);
  assert.deepEqual(ids(search(index, "", { status: set("unchecked") })), ["g1"]);
  assert.deepEqual(ids(search(index, "", { status: set("typed") })), ["g3"]);
  assert.deepEqual(ids(search(index, "", { src: set("log") })), ["g3", "g2", "g1"]);
});
test("a query and a filter work together; grammar is searchable", () => {
  assert.equal(search(index, "moment", { src: set("log"), sit: set("shop") }).length, 1);
  assert.equal(search(index, "moment", { sit: set("café") }).length, 0);
  assert.equal(search(index, "word the")[0].kind, "grammar");
});
