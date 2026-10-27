import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates, shareable } from "../js/lib/merge.js";
import { createSync } from "../js/lib/sync.js";
import { createStore } from "../js/lib/store.js";
import { rate } from "../js/lib/srs.js";

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; }, m }; };

// A tiny in-memory Supabase: password sign-in, token refresh, and the six row tables. Like the real database it ignores an upload
// whose client_updated_at is older than the stored row, stamps updated_at itself, and keeps each user's rows apart.
const TABLES = { italiano_profiles: ["user_id"], italiano_card_states: ["user_id", "card_id"], italiano_daily: ["user_id", "day"], italiano_log_entries: ["user_id", "id"], italiano_scenario_ratings: ["user_id", "scenario_id"], italiano_drill_stats: ["user_id", "kind"] };
function fakeSupabase({ users = { "me@example.com": "secret" }, legacy = null, schema = true } = {}) {
  const tables = Object.fromEntries(Object.keys(TABLES).map((t) => [t, new Map()])); const log = []; let tokenN = 0, tick = 0; const tokens = {}; let failNext = null;
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const stamp = () => new Date(Date.UTC(2026, 9, 19, 12, 0, 0) + ++tick * 1000).toISOString().replace("Z", "+00:00");
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : undefined; log.push(`${opts.method} ${u.pathname}${u.search}`);
    if (failNext) { const f = failNext; failNext = null; if (f === "network") throw new TypeError("fetch failed"); return json(f, { message: "boom" }); }
    if (!opts.headers.apikey) return json(401, { message: "No API key found" });
    if (u.pathname === "/auth/v1/token") {
      const g = u.searchParams.get("grant_type");
      if (g === "password") { if (users[body.email] !== body.password) return json(400, { error_description: "Invalid login credentials" });
        const t = "t" + ++tokenN; tokens[t] = body.email; return json(200, { access_token: t, refresh_token: "r" + tokenN, expires_in: 3600, user: { id: "u-" + body.email, email: body.email } }); }
      if (g === "refresh_token") { const t = "t" + ++tokenN; tokens[t] = "me@example.com"; return json(200, { access_token: t, refresh_token: "r" + tokenN, expires_in: 3600, user: { id: "u-me@example.com", email: "me@example.com" } }); }
    }
    if (u.pathname === "/auth/v1/logout") return json(204, {});
    if (u.pathname.startsWith("/rest/v1/")) {
      const auth = (opts.headers.Authorization || "").replace("Bearer ", ""); const email = tokens[auth];
      if (!email) return json(401, { message: "JWT expired", code: "PGRST303" });
      const uid = "u-" + email, name = u.pathname.slice("/rest/v1/".length);
      if (name === "rpc/italiano_schema_version") return schema ? json(200, schema === true ? 3 : schema) : json(404, { code: "PGRST202", message: "Could not find the function" });
      if (name === "italiano_progress") return legacy ? json(200, [{ data: legacy }]) : json(404, { code: "PGRST205", message: "no table" });
      const t = tables[name]; if (!t) return json(404, { code: "PGRST205", message: "no table" });
      if (opts.method === "GET") {
        const gte = u.searchParams.get("updated_at"); const from = gte ? gte.replace(/^gte\./, "") : null; const range = (opts.headers.Range || "0-999").split("-").map(Number);
        const mine = [...t.values()].filter((r) => r.user_id === uid && (!from || r.updated_at >= new Date(from).toISOString().replace("Z", "+00:00"))).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
        return json(206, mine.slice(range[0], range[1] + 1));
      }
      if (opts.method === "POST") {
        for (const r of body) {
          if (r.user_id !== uid) return json(403, { message: "RLS violation" });
          const key = TABLES[name].map((c) => r[c]).join("|"), old = t.get(key);
          if (old && new Date(r.client_updated_at) < new Date(old.client_updated_at)) continue;       // the trigger skips older edits
          t.set(key, { ...(old || {}), ...r, updated_at: stamp() });
        }
        return json(201, null);
      }
    }
    return json(404, { message: "not found" });
  };
  const all = (name, uid = "u-me@example.com") => [...tables[name].values()].filter((r) => r.user_id === uid);
  return { fetchImpl, tables, all, log, expireAll: () => { for (const k of Object.keys(tokens)) delete tokens[k]; }, failNext: (f) => { failNext = f; } };
}
const device = (sb, t = { now: 1_000_000 }) => {
  const storage = mem(), store = createStore(storage);
  const sync = createSync({ config: { supabaseUrl: "https://x.supabase.co", supabaseKey: "sb_publishable_test" }, store, storage, fetchImpl: sb.fetchImpl, now: () => t.now, setTimer: (fn) => { sync._pending = fn; return 1; }, clearTimer: () => { sync._pending = null; } });
  return { store, sync, storage, t };
};

test("merge (used to import the old single-JSON copy): newest review wins per card, nothing is lost", () => {
  const a = { cards: { x: { box: 3, last: "2026-10-10", reps: 4 }, only_a: { box: 1, last: "2026-10-01", reps: 1 } }, daily: { "2026-10-10": { blocks: { read: true }, reviewed: 3, newSeen: 2, drills: 0, retells: 0 } }, gaps: [{ id: "g1", created: "2026-10-01", it: "a" }], gapsDeleted: [], ratings: {}, drills: {} };
  const b = { cards: { x: { box: 1, last: "2026-10-11", reps: 5 }, only_b: { box: 2, last: "2026-10-02", reps: 2 } }, daily: { "2026-10-10": { blocks: { speak: true }, reviewed: 8, newSeen: 1, drills: 1, retells: 0 } }, gaps: [{ id: "g2", created: "2026-10-05", it: "b" }], gapsDeleted: [], ratings: { s: { stars: 3, last: "2026-10-09" } }, drills: { numbers: { sessions: 2, correct: 15, total: 20 } } };
  const m = mergeStates(a, b);
  assert.equal(m.cards.x.last, "2026-10-11"); assert.ok(m.cards.only_a && m.cards.only_b);
  assert.deepEqual(m.daily["2026-10-10"], { blocks: { read: true, speak: true }, reviewed: 8, newSeen: 2, drills: 1, retells: 0 });
  assert.deepEqual(m.gaps.map(g => g.id), ["g2", "g1"]); assert.equal(m.ratings.s.stars, 3); assert.equal(m.drills.numbers.sessions, 2);
  assert.equal(mergeStates(a, null), a);
});
test("merge: deleted gaps stay deleted and settings are untouched", () => {
  const a = { settings: { newPerDay: 5 }, cards: { g1: { box: 1, last: "2026-10-01" } }, gaps: [], gapsDeleted: ["g1"], daily: {}, ratings: {}, drills: {} };
  const b = { settings: { newPerDay: 99 }, cards: { g1: { box: 1, last: "2026-10-01" } }, gaps: [{ id: "g1", created: "2026-10-01" }], gapsDeleted: [], daily: {}, ratings: {}, drills: {} };
  const m = mergeStates(a, b); assert.equal(m.gaps.length, 0); assert.equal(m.cards.g1, undefined); assert.equal(m.settings.newPerDay, 5);
  assert.equal("settings" in shareable(m), false);
});

test("sync is off without a config, and never calls the network", async () => {
  const storage = mem(), store = createStore(storage); let calls = 0;
  const s = createSync({ config: { supabaseUrl: "", supabaseKey: "" }, store, storage, fetchImpl: async () => { calls++; } });
  assert.equal(s.enabled, false); assert.deepEqual(await s.syncNow(), { ok: false, reason: "signed-out" }); assert.equal(calls, 0);
});
test("two devices: sign in, upload only what changed, download, merge", async () => {
  const sb = fakeSupabase(), A = device(sb), B = device(sb);
  A.store.setCard("phr.1", rate(undefined, "good", "2026-10-10")); A.store.markBlock("2026-10-10", "read", true);
  const r = await A.sync.signIn("me@example.com", "secret"); assert.equal(r.ok, true);
  assert.equal(sb.all("italiano_card_states").length, 1); assert.equal(sb.all("italiano_daily")[0].blocks[0], "read");
  assert.equal(A.store.hasDirty(), false);
  await B.sync.signIn("me@example.com", "secret");
  assert.equal(B.store.card("phr.1").box, 1); assert.equal(B.store.day("2026-10-10").blocks.read, true);
  B.store.setCard("phr.1", rate(B.store.card("phr.1"), "easy", "2026-10-11")); await B.sync.syncNow();
  await A.sync.syncNow(); assert.equal(A.store.card("phr.1").last, "2026-10-11");
});
test("an unchanged state uploads nothing", async () => {
  const sb = fakeSupabase(), A = device(sb); A.store.setCard("c", rate(undefined, "good", "2026-10-10")); await A.sync.signIn("me@example.com", "secret");
  sb.log.length = 0; const r = await A.sync.syncNow(); assert.equal(r.pushed, 0); assert.equal(sb.log.filter((l) => l.startsWith("POST /rest")).length, 0);
});
test("settings never leave the device, only the study preferences do", async () => {
  const sb = fakeSupabase(), A = device(sb); A.store.setting("rate", 0.6); A.store.setting("newPerDay", 17); await A.sync.signIn("me@example.com", "secret");
  const prof = sb.all("italiano_profiles")[0]; assert.equal(prof.prefs.newPerDay, 17); assert.equal("rate" in prof.prefs, false);
  const B = device(sb); await B.sync.signIn("me@example.com", "secret"); assert.equal(B.store.state.settings.newPerDay, 17); assert.equal(B.store.state.settings.rate, 0.9);
});
test("both devices edit at the same moment: neither loses work", async () => {
  const sb = fakeSupabase(), A = device(sb), B = device(sb); await A.sync.signIn("me@example.com", "secret"); await B.sync.signIn("me@example.com", "secret");
  A.store.addGap({ it: "uno", en: "one", src: "manual" }); B.store.addGap({ it: "due", en: "two", src: "manual" });
  A.store.markBlock("2026-10-19", "read", true); B.store.markBlock("2026-10-19", "speak", true);
  await Promise.all([A.sync.syncNow(), B.sync.syncNow()]); await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
  for (const d of [A, B]) { assert.deepEqual(d.store.state.gaps.map((g) => g.it).sort(), ["due", "uno"]); assert.deepEqual(d.store.day("2026-10-19").blocks, { read: true, speak: true }); }
});
test("an edit made while offline uploads later and the devices agree", async () => {
  const sb = fakeSupabase(), A = device(sb), B = device(sb); await A.sync.signIn("me@example.com", "secret");
  const g = A.store.addGap({ it: "ciao", en: "hi", src: "manual" }); await A.sync.syncNow(); await B.sync.signIn("me@example.com", "secret");
  sb.failNext("network"); A.store.updateGap(g.id, { note: "A offline" }); await A.sync.syncNow();       // offline: stays waiting
  assert.equal(A.store.hasDirty(), true);
  B.store.updateGap(g.id, { note: "B later" }); await B.sync.syncNow();
  await A.sync.syncNow(); await B.sync.syncNow(); await A.sync.syncNow();
  const note = (d) => d.store.state.gaps[0].note; assert.equal(note(A), note(B)); assert.equal(A.store.hasDirty(), false); assert.equal(B.store.hasDirty(), false);
});
test("a deleted log line stays deleted on every device", async () => {
  const sb = fakeSupabase(), A = device(sb), B = device(sb); await A.sync.signIn("me@example.com", "secret");
  const g = A.store.addGap({ it: "segreto", en: "secret", src: "manual" }); await A.sync.syncNow(); await B.sync.signIn("me@example.com", "secret");
  assert.equal(B.store.state.gaps.length, 1); A.store.removeGap(g.id); await A.sync.syncNow(); await B.sync.syncNow();
  assert.equal(B.store.state.gaps.length, 0); assert.equal(sb.all("italiano_log_entries")[0].italian, "-");           // the text is gone from the cloud too
  await A.sync.syncNow(); await B.sync.syncNow(); assert.equal(A.store.state.gaps.length + B.store.state.gaps.length, 0);
});
test("the old single-JSON copy is imported once, then left alone", async () => {
  const legacy = { v: 1, cards: { old1: { box: 2, due: "2026-10-12", reps: 2, lapses: 0, last: "2026-10-05" } }, daily: {}, gaps: [{ id: "gap.old", it: "vecchio", en: "old", created: "2026-10-01", updated: "2026-10-01T08:00:00.000Z", src: "manual" }], gapsDeleted: [], ratings: {}, drills: {} };
  const sb = fakeSupabase({ legacy }), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  assert.equal(sb.all("italiano_card_states")[0].card_id, "old1"); assert.equal(sb.all("italiano_log_entries")[0].italian, "vecchio");
  sb.log.length = 0; await A.sync.syncNow(); assert.equal(sb.log.some((l) => l.includes("italiano_progress")), false);
});
test("a project without the new tables says what to do, and keeps your data", async () => {
  const sb = fakeSupabase({ schema: false }), A = device(sb); A.store.addGap({ it: "x", en: "y", src: "manual" });
  const r = await A.sync.signIn("me@example.com", "secret"); assert.equal(r.reason, "upgrade"); assert.match(A.sync.info().error, /schema\.sql/); assert.equal(A.store.state.gaps.length, 1);
});
test("a project on the older table layout (version 2) is asked to run schema.sql again", async () => {
  const sb = fakeSupabase({ schema: 2 }), A = device(sb); A.store.addGap({ it: "x", en: "y", src: "manual" });
  const r = await A.sync.signIn("me@example.com", "secret"); assert.equal(r.reason, "upgrade"); assert.match(A.sync.info().error, /safe to run again/); assert.equal(A.store.state.gaps.length, 1);
});
test("moving to another project uploads everything there", async () => {
  const one = fakeSupabase(), A = device(one); A.store.setCard("c", rate(undefined, "good", "2026-10-10")); A.store.addGap({ it: "uno", en: "one", src: "manual" });
  await A.sync.signIn("me@example.com", "secret"); assert.equal(one.all("italiano_card_states").length, 1);
  const two = fakeSupabase(); const B = createSync({ config: { supabaseUrl: "https://other.supabase.co", supabaseKey: "sb_publishable_test" }, store: A.store, storage: A.storage, fetchImpl: two.fetchImpl, now: () => 1_000_000, setTimer: () => 1, clearTimer: () => {} });
  await B.signIn("me@example.com", "secret");
  assert.equal(two.all("italiano_card_states").length, 1); assert.equal(two.all("italiano_log_entries").length, 1);
});
test("a change schedules an upload (debounced)", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  A.store.setCard("c", rate(undefined, "good", "2026-10-10")); assert.equal(typeof A.sync._pending, "function");
  await A.sync._pending(); assert.equal(sb.all("italiano_card_states").some((r) => r.card_id === "c"), true);
  A.sync._pending = null; A.store.setting("rate", 0.7); assert.equal(A.sync._pending, null);          // device settings do not schedule anything
});
test("wrong password fails cleanly and stores nothing", async () => {
  const sb = fakeSupabase(), A = device(sb);
  await assert.rejects(() => A.sync.signIn("me@example.com", "nope"), /Invalid login/); assert.equal(A.sync.info().signedIn, false); assert.equal(A.storage.getItem("italiano-ogni-giorno:sync"), null);
});
test("expired token refreshes automatically", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  A.t.now += 2 * 3600 * 1000;                                  // two hours later
  A.store.markBlock("2026-10-11", "speak", true); const r = await A.sync.syncNow();
  assert.equal(r.ok, true); assert.ok(sb.log.some(l => l.includes("grant_type=refresh_token")));
});
test("offline and server errors are reported, progress stays local", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  A.store.markBlock("2026-10-11", "read", true); sb.failNext("network");
  assert.equal((await A.sync.syncNow()).reason, "offline"); assert.equal(A.sync.info().status, "offline");
  sb.failNext(500); assert.equal((await A.sync.syncNow()).reason, "error");
  assert.equal(A.store.day("2026-10-11").blocks.read, true); assert.equal((await A.sync.syncNow()).ok, true);
  assert.equal(sb.all("italiano_daily").some((r) => r.day === "2026-10-11"), true);
});
test("sign out clears the session and stops syncing", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  await A.sync.signOut(); assert.equal(A.sync.info().signedIn, false); assert.deepEqual(await A.sync.syncNow(), { ok: false, reason: "signed-out" });
});
