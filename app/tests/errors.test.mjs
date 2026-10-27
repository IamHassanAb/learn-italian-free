import test from "node:test";
import assert from "node:assert/strict";
import { errorTopics, isMistake, FLAG_AT, NO_TOPIC } from "../js/lib/errors.js";

const topics = [{ id: "g.articles", when: "il / lo / la", answer: "Use lo before s+consonant." }, { id: "g.past", when: "Past (I did)", answer: "Use ho + participle." }];
const gap = (id, extra = {}) => ({ id, it: id, en: id, created: "2026-10-20", ...extra });

test("only tagged lines and corrections count as mistakes", () => {
  assert.equal(isMistake(gap("a")), false); assert.equal(isMistake(gap("b", { tag: "g.past" })), true); assert.equal(isMistake(gap("c", { kind: "corrected" })), true);
  assert.equal(isMistake(gap("d", { kind: "heard" })), false);
});
test("topics are counted, flagged at three, and sorted by count", () => {
  const gaps = [gap("1", { tag: "g.articles", created: "2026-10-18" }), gap("2", { tag: "g.articles", created: "2026-10-19" }), gap("3", { tag: "g.articles", created: "2026-10-21" }), gap("4", { tag: "g.past" }), gap("5"), gap("6", { kind: "heard" })];
  const r = errorTopics(gaps, topics);
  assert.deepEqual(r.map((x) => [x.tag, x.count, x.flagged]), [["g.articles", 3, true], ["g.past", 1, false]]);
  assert.equal(r[0].title, "il / lo / la"); assert.match(r[0].answer, /lo before/); assert.equal(r[0].last, "2026-10-21"); assert.equal(r[0].entries[0].id, "3");
  assert.equal(FLAG_AT, 3);
});
test("corrections without a topic are listed together and never flagged; unknown topic ids count as no topic", () => {
  const gaps = [gap("1", { kind: "corrected" }), gap("2", { kind: "corrected" }), gap("3", { kind: "corrected", tag: "gone.id" }), gap("4", { kind: "corrected" })];
  const r = errorTopics(gaps, topics); assert.equal(r.length, 1); assert.equal(r[0].tag, NO_TOPIC); assert.equal(r[0].count, 4); assert.equal(r[0].flagged, false); assert.equal(r[0].answer, null);
});
test("nothing logged, nothing listed", () => assert.deepEqual(errorTopics([], topics), []));
