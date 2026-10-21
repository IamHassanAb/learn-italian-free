import { test } from "node:test";
import assert from "node:assert/strict";
import { TIERS, tierOf, byTier, suggestNext } from "../js/lib/tiers.js";

const mods = { a: { tier: 2 }, b: { tier: 1 }, c: { tier: 3 }, d: { tier: 1 }, e: {} };
const ids = ["a", "b", "c", "d", "e"];

test("tiers have a name and a tip; a missing or unknown tier counts as 1", () => {
  for (const t of [1, 2, 3, 4]) { assert.ok(TIERS[t].name); assert.ok(TIERS[t].tip); }
  assert.equal(tierOf({}), 1); assert.equal(tierOf({ tier: 9 }), 1); assert.equal(tierOf({ tier: 3 }), 3);
});
test("scenarios are listed by tier, keeping course order within a tier", () => assert.deepEqual(byTier(ids, mods), ["b", "d", "e", "a", "c"]));
test("suggests the first scenario you have not tried, lowest tier first", () => {
  assert.deepEqual(suggestNext(ids, mods, {}), { id: "b", why: "not tried yet" });
  assert.equal(suggestNext(ids, mods, { b: { stars: 3 }, d: { stars: 2 } }).id, "e");
});
test("when all are tried, suggests the first one that went roughly, else nothing", () => {
  const all = { a: { stars: 3 }, b: { stars: 3 }, c: { stars: 1 }, d: { stars: 2 }, e: { stars: 3 } };
  assert.deepEqual(suggestNext(ids, mods, all), { id: "c", why: "it went roughly last time" });
  assert.equal(suggestNext(ids, mods, { ...all, c: { stars: 2 } }), null);
});
