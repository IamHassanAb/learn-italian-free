import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { withArticle, topicWords, topicQuestion, buildTopicDrills, topicDrillId, setVoiceAvailable } from "../js/lib/vocabdrills.js";
import { DRILLS, registerDrills, makeSession, check } from "../js/lib/drills.js";

const seeded = (seed = 3) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mod = {
  id: "t-colours", title: "Colours", drills: ["pick", "type", "listen", "swatch", "gender"],
  parts: [{ id: "t-colours.words", type: "vocab", items: [
    { id: "c1", it: "rosso", en: "red", swatch: "#d32f2f", forms: { m: "rosso", f: "rossa", mp: "rossi", fp: "rosse" } },
    { id: "c2", it: "verde", en: "green", swatch: "#388e3c", forms: { m: "verde", f: "verde", mp: "verdi", fp: "verdi" } },
    { id: "c3", it: "blu", en: "dark blue", swatch: "#1e40af", forms: { m: "blu", f: "blu", mp: "blu", fp: "blu" } },
    { id: "c4", it: "marrone", en: "brown", swatch: "#795548", forms: { m: "marrone", f: "marrone", mp: "marroni", fp: "marroni" }, accept_forms: { mp: ["marrone"], fp: ["marrone"] } },
    { id: "c5", it: "bianco", en: "white", swatch: "#fafafa", forms: { m: "bianco", f: "bianca", mp: "bianchi", fp: "bianche" }, example: "Una casa bianca." },
    { id: "c6", it: "padre", en: "father", art: "il" }, { id: "c7", it: "amico", en: "friend", art: "l'" },
  ] }],
};

test("articles: il padre, l'amico, and no article when there is none", () => {
  assert.equal(withArticle({ art: "il", it: "padre" }), "il padre"); assert.equal(withArticle({ art: "l'", it: "amico" }), "l'amico"); assert.equal(withArticle({ it: "rosso" }), "rosso");
});
test("topicWords carries the card id of every word", () => assert.equal(topicWords(mod)[0].card, "t-colours.words.c1"));

test("every mode makes a valid question, and the shown answer is always accepted", () => {
  setVoiceAvailable(true);
  const rnd = seeded();
  for (const mode of ["mixed", "pick", "type", "listen", "swatch", "gender"]) for (let i = 0; i < 80; i++) {
    const q = topicQuestion(mod, mode, rnd);
    assert.ok(q.prompt && q.answers.length && q.show && q.card, `${mode}: ${JSON.stringify(q)}`);
    assert.ok(check(q, q.answers[0]), `${mode} ${q.prompt}`);
    if (q.choices) { assert.equal(q.choices.length, 4); assert.equal(new Set(q.choices).size, 4, `duplicate choices ${q.choices}`); assert.ok(q.choices.some((c) => check(q, c)), "the right answer is among the choices"); assert.equal(q.choices.filter((c) => check(q, c)).length, 1, "only one choice is right"); }
  }
});
test("pick: distractors come from the topic and are never the answer", () => {
  const rnd = seeded(5);
  for (let i = 0; i < 100; i++) { const q = topicQuestion(mod, "pick", rnd); const right = q.choices.filter((c) => q.answers.includes(c)); assert.equal(right.length, 1); }
});
test("type: the article is optional, accents and case are forgiven", () => {
  const q = { ...topicQuestion({ ...mod, parts: [{ ...mod.parts[0], items: [{ id: "x", it: "padre", en: "father", art: "il" }, ...mod.parts[0].items] }] }, "type", () => 0), };
  const t = topicQuestion(mod, "type", () => 0.99); // last word: l'amico
  assert.ok(check(t, "l'amico") && check(t, "Amico") && check(t, " AMICO "));
  assert.equal(q.kind, "topic-type");
});
test("swatch: shows a colour and asks for its name", () => {
  const q = topicQuestion(mod, "swatch", seeded(2)); assert.match(q.swatch, /^#[0-9a-f]{6}$/i); assert.ok(q.choices.includes(q.show));
});
test("gender: asks for a form that differs, accepts listed variants, never asks about invariable words", () => {
  const rnd = seeded(7), seen = new Set();
  for (let i = 0; i < 200; i++) { const q = topicQuestion(mod, "gender", rnd); assert.notEqual(q.prompt, "blu"); assert.ok(!/blu$/.test(q.show) || q.show !== "blu"); seen.add(q.hint); }
  assert.deepEqual([...seen].sort(), ["Give the feminine form (just the word)", "Give the feminine plural form (just the word)", "Give the masculine plural form (just the word)"]);
  const rnd2 = () => 0.7; // find marrone fp: accepts marroni; marrone variant is only for the feminine singular? it is an accepted spelling of the base word
  const q = topicQuestion({ ...mod, parts: [{ ...mod.parts[0], items: mod.parts[0].items.filter((x) => ["c1", "c2", "c4"].includes(x.id)) }] }, "gender", rnd2);
  assert.ok(q.answers.length >= 1);
  // marrone: the plural marroni is expected, the unchanged form is also accepted; verde takes no extra answers
  const m4 = { ...mod, parts: [{ ...mod.parts[0], items: mod.parts[0].items.filter((x) => ["c1", "c2", "c4"].includes(x.id)) }] }, rr = seeded(21);
  let sawMarrone = false;
  for (let i = 0; i < 200; i++) { const g = topicQuestion(m4, "gender", rr); if (g.prompt === "marrone") { sawMarrone = true; assert.ok(check(g, "marroni") && check(g, "marrone")); } if (g.prompt === "rosso") assert.ok(!check(g, "rosso")); }
  assert.ok(sawMarrone);
});
test("without a voice, mixed rounds leave out listening and the listen mode is refused", () => {
  setVoiceAvailable(false);
  const kinds = new Set(Array.from({ length: 200 }, (_, i) => topicQuestion(mod, "mixed", seeded(i + 1)).kind));
  assert.ok(!kinds.has("topic-listen")); assert.throws(() => topicQuestion(mod, "listen"));
  setVoiceAvailable(true);
});
test("topic drills register next to the older drills and make whole rounds", () => {
  const content = { order: ["t-colours", "other"], modules: { "t-colours": mod, other: { id: "other", title: "Other", parts: [] } } };
  const defs = buildTopicDrills(content); assert.deepEqual(Object.keys(defs), [topicDrillId("t-colours")]);
  registerDrills(defs); const id = topicDrillId("t-colours");
  assert.ok(DRILLS[id] && DRILLS.numbers); assert.equal(DRILLS[id].group, "Vocabulary topics"); assert.equal(DRILLS[id].defaultOption, "mixed");
  for (const opt of DRILLS[id].options) assert.equal(makeSession(id, opt, 5, seeded(4)).length, 5, opt);
});
const realContent = () => JSON.parse(readFileSync(new URL("../../docs/data/content.json", import.meta.url), "utf8"));
const haveContent = existsSync(new URL("../../docs/data/content.json", import.meta.url));
test("every real topic module builds drills that work (when the app data has been built)", { skip: !haveContent }, () => {
  const c = realContent(), mods = Object.values(c.modules).filter((m) => m.drills && m.drills.length);
  assert.ok(mods.length >= 3, "colours, family and professions at least");
  for (const m of mods) {
    const words = topicWords(m), rnd = seeded(9);
    assert.ok(words.length >= 12, `${m.id}: ${words.length} words`);
    for (const mode of ["mixed", ...m.drills.filter((d) => d !== "listen")]) for (let i = 0; i < 60; i++) {
      const q = topicQuestion(m, mode, rnd);
      assert.ok(check(q, q.answers[0]), `${m.id} ${mode}: ${q.prompt}`);
      if (q.choices) { assert.equal(new Set(q.choices).size, 4, `${m.id}: duplicate choices`); assert.equal(q.choices.filter((c2) => check(q, c2)).length, 1, `${m.id} ${q.prompt}: more than one right choice ${q.choices}`); }
    }
  }
});
test("every word in every topic is well formed: the masculine form is the word, no repeats, forms complete", { skip: !haveContent }, () => {
  const c = realContent();
  for (const m of Object.values(c.modules).filter((x) => x.drills && x.drills.length)) {
    const seen = new Set();
    for (const w of topicWords(m)) {
      assert.ok(!seen.has(w.it), `${m.id}: ${w.it} twice`); seen.add(w.it);
      if (w.forms) { assert.equal(w.forms.m, w.it, `${m.id}: ${w.id} forms.m`); for (const k of ["f", "mp", "fp"]) assert.ok(w.forms[k], `${m.id}: ${w.it} lacks forms.${k}`); }
      assert.ok(w.en && w.example, `${m.id}: ${w.it} needs a meaning and an example`);
    }
  }
});
