import test from "node:test";
import assert from "node:assert/strict";
import { makeCloze, useCloze } from "../js/lib/cloze.js";

test("a content word is hidden and the rest of the sentence is kept exactly", () => {
  const c = makeCloze("Vorrei un caffè, per favore.", 1);
  assert.ok(c); assert.equal(c.before + c.answer + c.after, "Vorrei un caffè, per favore.");
  assert.ok(["Vorrei", "caffè", "favore"].includes(c.answer), c.answer);
});
test("small words, short words and one- or two-word lines are never hidden", () => {
  assert.equal(makeCloze("Grazie mille", 1), null); assert.equal(makeCloze("caffè", 1), null);
  assert.equal(makeCloze("Io non ho una casa", 3).answer, "casa");
  for (let s = 0; s < 50; s++) assert.ok(!["Io", "non", "ho", "una"].includes(makeCloze("Io non ho una casa", s).answer));
});
test("elisions keep the apostrophe part: l'acqua becomes l'___", () => {
  const c = makeCloze("Vorrei l'acqua frizzante", 0); assert.equal(c.before + c.answer + c.after, "Vorrei l'acqua frizzante");
  for (let s = 0; s < 30; s++) { const x = makeCloze("Vorrei l'acqua frizzante", s); if (x.answer === "acqua") assert.equal(x.before.endsWith("l'"), true); }
});
test("the same seed gives the same blank, different seeds spread over the words", () => {
  assert.equal(makeCloze("Domani vado alla stazione centrale", 7).answer, makeCloze("Domani vado alla stazione centrale", 7).answer);
  const seen = new Set(); for (let s = 0; s < 80; s++) seen.add(makeCloze("Domani vado alla stazione centrale", s).answer);
  assert.ok(seen.size >= 3, [...seen].join());
});
test("accents are kept inside words", () => { const c = makeCloze("Questa città è molto bella", 2); assert.equal(c.before + c.answer + c.after, "Questa città è molto bella"); });
test("the setting: off never, always whenever possible, sometimes about half the time", () => {
  assert.equal(useCloze("off", "Vado alla stazione centrale", 1), null);
  for (let s = 0; s < 30; s++) assert.ok(useCloze("always", "Vado alla stazione centrale", s));
  let n = 0; for (let s = 0; s < 400; s++) if (useCloze("sometimes", "Vado alla stazione centrale", "card" + s)) n++;
  assert.ok(n > 120 && n < 280, `${n} of 400`);
  assert.equal(useCloze("always", "Grazie", 1), null);
});
