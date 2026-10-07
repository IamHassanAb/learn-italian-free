import test from "node:test";
import assert from "node:assert/strict";
import { numberQuestion, timeQuestion, calendarQuestion, makeSession, check, DRILLS } from "../js/lib/drills.js";

const seeded = (seed = 7) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test("number questions accept the spelling and ignore accents and case", () => {
  const q = numberQuestion(0, () => 0.5); // max 0 -> always 0
  assert.equal(q.show, "zero"); assert.ok(check(q, " Zero "));
  const r = { prompt: "23", answers: ["ventitré"] }; assert.ok(check(r, "ventitre")); assert.ok(check(r, "Ventitré")); assert.ok(!check(r, "ventitrè e"));
});
test("number listen asks for digits", () => {
  const q = numberQuestion(20, seeded(), "listen"); assert.match(q.show, /^\d+$/); assert.ok(check(q, q.show)); assert.ok(q.speak.length > 0);
});
test("time questions always have an everyday answer and never midnight/noon with minutes", () => {
  const rnd = seeded(3);
  for (let i = 0; i < 300; i++) {
    const q = timeQuestion(rnd); assert.match(q.prompt, /^\d\d:\d\d$/); assert.ok(q.answers.length >= 1); assert.ok(check(q, q.show));
    assert.ok(!/^(00|12):(?!00)/.test(q.prompt), q.prompt);
  }
});
test("calendar questions", () => {
  const rnd = seeded(5);
  for (let i = 0; i < 200; i++) { const q = calendarQuestion("date", rnd); assert.match(q.show, /^(il|l')/); assert.ok(check(q, q.show)); }
  assert.ok(check(calendarQuestion("weekday", () => 0), "domenica"));
  assert.equal(calendarQuestion("month", () => 0).show, "gennaio");
});
test("sessions: right size, unique, every drill works", () => {
  for (const [id, d] of Object.entries(DRILLS)) for (const opt of d.options) {
    const s = makeSession(id, opt, 10, seeded(11));
    assert.ok(s.length >= (id === "numbers" && opt === "0-20" ? 10 : 7) || s.length >= 7, `${id}/${opt} gave ${s.length}`);
    assert.equal(new Set(s.map(q => q.prompt + "|" + q.show)).size, s.length);
  }
});
