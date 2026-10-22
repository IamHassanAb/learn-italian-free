import test from "node:test";
import assert from "node:assert/strict";
import { PEOPLE, ACTIONS, registerQuestion } from "../js/lib/register.js";
import { DRILLS, makeSession, check } from "../js/lib/drills.js";

const seeded = (seed = 5) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test("every person has a register and a reason; both registers are covered", () => {
  for (const p of PEOPLE) { assert.ok(["tu", "Lei"].includes(p.reg)); assert.ok(p.who && p.why); }
  assert.ok(PEOPLE.some((p) => p.reg === "tu") && PEOPLE.some((p) => p.reg === "Lei"));
});
test("every action has a casual and a polite form that differ", () => {
  for (const a of ACTIONS) { assert.ok(a.tu.length && a.lei.length); assert.notEqual(a.tu[0], a.lei[0]); }
});
test("choose questions: two buttons, the right one is accepted, the other is not", () => {
  const rnd = seeded();
  for (let i = 0; i < 100; i++) {
    const q = registerQuestion("choose", rnd); assert.deepEqual(q.choices, ["tu", "Lei"]); assert.ok(check(q, q.show));
    assert.ok(!check(q, q.show === "tu" ? "Lei" : "tu")); assert.ok(q.why);
  }
});
test("say-it questions: the form matches the register, accents and punctuation are forgiven, the other register is wrong", () => {
  const rnd = seeded(9);
  for (let i = 0; i < 200; i++) {
    const q = registerQuestion("say it", rnd); assert.ok(q.speak); assert.ok(check(q, q.show));
    const a = ACTIONS.find((x) => q.prompt.endsWith(x.ask)), person = PEOPLE.find((p) => q.prompt.toLowerCase().startsWith(p.who));
    const other = person.reg === "tu" ? a.lei : a.tu;
    assert.ok(!check(q, other[0]), `${q.prompt} accepted ${other[0]}`);
  }
  const q = { answers: ["Di dov'è?", "Di dove è?"] }; assert.ok(check(q, "di dove e")); assert.ok(check(q, "Di dov'è"));
});
test("a round of ten is possible in every mode, with no repeated question", () => {
  for (const mode of DRILLS["tu-lei"].options) {
    const s = makeSession("tu-lei", mode, 10, seeded(3)); assert.equal(s.length, 10);
    assert.equal(new Set(s.map((q) => q.prompt + "|" + q.show)).size, 10);
  }
});
test("mixed mode gives both kinds", () => {
  const kinds = new Set(makeSession("tu-lei", "mixed", 10, seeded(8)).map((q) => q.kind)); assert.equal(kinds.size, 2);
});
