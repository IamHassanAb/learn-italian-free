import test from "node:test";
import assert from "node:assert/strict";
import { numberToItalian as n, numberVariants } from "../js/lib/numbers.js";
import { everyday, official, acceptable } from "../js/lib/clock.js";
import { dateWords, longDate } from "../js/lib/calendar.js";
import { rate, previewDays, buildQueue, LADDER } from "../js/lib/srs.js";
import { norm, addDays, daysBetween, speakable, localDate } from "../js/lib/util.js";
import { createStore } from "../js/lib/store.js";

test("numbers: basics and elision", () => {
  const cases = { 0: "zero", 3: "tre", 13: "tredici", 20: "venti", 21: "ventuno", 23: "ventitré", 28: "ventotto", 33: "trentatré", 40: "quaranta", 48: "quarantotto",
    99: "novantanove", 100: "cento", 101: "centouno", 108: "centootto", 123: "centoventitré", 180: "centottanta", 181: "centottantuno", 200: "duecento", 999: "novecentonovantanove" };
  for (const [k, v] of Object.entries(cases)) assert.equal(n(+k), v, k);
});
test("numbers: thousands", () => {
  const cases = { 1000: "mille", 1001: "milleuno", 1100: "millecento", 2000: "duemila", 3000: "tremila", 2023: "duemilaventitré", 21000: "ventunomila", 23000: "ventitremila", 99999: "novantanovemilanovecentonovantanove" };
  for (const [k, v] of Object.entries(cases)) assert.equal(n(+k), v, k);
  assert.throws(() => n(-1)); assert.throws(() => n(100000)); assert.throws(() => n(1.5));
});
test("numbers: variants put the preferred form first", () => {
  assert.equal(numberVariants(108)[0], "centootto"); assert.ok(numberVariants(108).includes("centotto"));
  assert.equal(numberVariants(180)[0], "centottanta"); assert.ok(numberVariants(180).includes("centoottanta"));
  assert.deepEqual(numberVariants(21), ["ventuno"]); assert.ok(numberVariants(2108).includes("duemilacentotto"));
});
test("clock: everyday phrases", () => {
  assert.equal(everyday(1, 0), "È l'una"); assert.equal(everyday(13, 10), "È l'una e dieci"); assert.equal(everyday(15, 15), "Sono le tre e un quarto");
  assert.equal(everyday(15, 30), "Sono le tre e mezza"); assert.equal(everyday(14, 45), "Sono le tre meno un quarto"); assert.equal(everyday(2, 50), "Sono le tre meno dieci");
  assert.equal(everyday(0, 0), "È mezzanotte"); assert.equal(everyday(12, 0), "È mezzogiorno"); assert.equal(everyday(12, 20), null); assert.equal(everyday(11, 50), null);
});
test("clock: official and acceptable", () => {
  assert.equal(official(14, 30), "Sono le quattordici e trenta"); assert.equal(official(1, 5), "È l'una e cinque");
  assert.ok(acceptable(15, 30).includes("Sono le tre e mezzo")); assert.ok(acceptable(15, 30).includes("Sono le quindici e trenta"));
});
test("calendar: dates", () => {
  assert.equal(dateWords(1, 9), "il primo ottobre"); assert.equal(dateWords(7, 9), "il sette ottobre"); assert.equal(dateWords(8, 9), "l'otto ottobre");
  assert.equal(dateWords(11, 0), "l'undici gennaio"); assert.equal(dateWords(28, 1), "il ventotto febbraio");
  assert.equal(longDate(new Date(2026, 9, 7)), "mercoledì 7 ottobre");
});
test("srs: ladder and queue", () => {
  const t = "2026-10-07";
  let s = rate(undefined, "good", t); assert.equal(s.box, 1); assert.equal(s.due, "2026-10-08");
  s = rate(s, "easy", "2026-10-08"); assert.equal(s.box, 3); assert.equal(s.due, addDays("2026-10-08", LADDER[3]));
  s = rate(s, "again", "2026-10-15"); assert.equal(s.box, 0); assert.equal(s.lapses, 1); assert.equal(s.due, "2026-10-15");
  assert.equal(previewDays(undefined, "good"), 1); assert.equal(previewDays({ box: 7 }, "easy"), LADDER[7]);
  const cards = [{ id: "a", deck: "x" }, { id: "b", deck: "x" }, { id: "c", deck: "y" }, { id: "d", deck: "x" }];
  const q = buildQueue(cards, { a: { box: 1, due: "2026-10-06" }, c: { box: 1, due: "2026-10-10" } }, t, { newLimit: 1 });
  assert.deepEqual(q.queue.map(c => c.id), ["a", "b"]);
  assert.deepEqual(buildQueue(cards, {}, t, { newLimit: 10, decks: new Set(["y"]) }).queue.map(c => c.id), ["c"]);
});
test("util: norm, dates, speakable", () => {
  assert.equal(norm("  Ventitré! "), "ventitre"); assert.equal(norm("L’uovo"), "l'uovo");
  assert.equal(daysBetween("2026-10-07", "2026-10-10"), 3); assert.equal(localDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(speakable("un caffè / un cornetto"), "un caffè, un cornetto"); assert.equal(speakable("**Barista:** Buongiorno…"), "Barista: Buongiorno");
});
test("store: streak, export/import, reset, broken storage", () => {
  const mem = {}; const stub = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const s = createStore(stub);
  assert.equal(s.streak("2026-10-07"), 0);
  s.markBlock("2026-10-05", "read", true); s.markBlock("2026-10-06", "speak", true);
  assert.equal(s.streak("2026-10-07"), 2);
  s.addReviewed("2026-10-07", 6, 3); assert.equal(s.streak("2026-10-07"), 3);
  s.setCard("a.b.i01", rate(undefined, "good", "2026-10-07"));
  const dump = s.exportJSON(); const s2 = createStore({ getItem: () => null, setItem() {}, removeItem() {} });
  assert.deepEqual(s2.importJSON(dump), { ok: true }); assert.equal(s2.card("a.b.i01").box, 1);
  assert.equal(s2.importJSON("nope").ok, false); assert.equal(s2.importJSON('{"v":2}').ok, false);
  s2.reset(); assert.equal(s2.card("a.b.i01"), undefined);
  const bad = createStore({ getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } });
  bad.setting("newPerDay", 5); assert.equal(bad.state.settings.newPerDay, 5); assert.equal(bad.persistent(), false);
});
