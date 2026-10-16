import { test } from "node:test";
import assert from "node:assert/strict";
import { norm, buildIndex, search } from "../js/lib/search.js";

const cards = [
  { id: "a.1", deck: "d", deckTitle: "Pharmacy", it: "Dov'è la farmacia?", en: "Where is the pharmacy?" },
  { id: "a.2", deck: "d", deckTitle: "Pharmacy", it: "Ho bisogno di un medico.", en: "I need a doctor." },
  { id: "g1", deck: "gaps", deckTitle: "Your gaps", it: "Così così", en: "so-so" },
];
const content = { modules: { "step3-grammar": { title: "Grammar", parts: [{ type: "lookup-row", id: "r1", when: "Which word for 'the'?", answer: "il, lo, la" }] } } };
const index = buildIndex(cards, content);

test("norm strips accents, case and punctuation", () => assert.equal(norm("Dov'è  la FARMACIA?"), "dov'e la farmacia"));
test("finds by English and by Italian, ignoring accents", () => {
  assert.equal(search(index, "pharmacy")[0].id, "a.1");
  assert.equal(search(index, "farmacia")[0].id, "a.1");
  assert.equal(search(index, "COSI")[0].id, "g1");
});
test("every word must match; short queries return nothing", () => {
  assert.equal(search(index, "need doctor").length, 1);
  assert.equal(search(index, "need pharmacy").length, 0);
  assert.equal(search(index, "p").length, 0);
});
test("grammar rows are searchable", () => assert.equal(search(index, "word the")[0].kind, "grammar"));
