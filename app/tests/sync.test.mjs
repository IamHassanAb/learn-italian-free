import test from "node:test";
import assert from "node:assert/strict";
import { mergeStates, shareable } from "../js/lib/merge.js";
import { createSync } from "../js/lib/sync.js";
import { createStore } from "../js/lib/store.js";
import { rate } from "../js/lib/srs.js";

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; }, m }; };

// A tiny in-memory Supabase: password sign-in, token refresh, and one RLS-protected progress row per user.
function fakeSupabase({ users = { "me@example.com": "secret" } } = {}) {
  const rows = {}; const log = []; let tokenN = 0; const tokens = {}; let failNext = null;
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
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
    if (u.pathname === "/rest/v1/italiano_progress") {
      const auth = (opts.headers.Authorization || "").replace("Bearer ", ""); const email = tokens[auth];
      if (!email) return json(401, { message: "JWT expired", code: "PGRST303" });
      const uid = "u-" + email;
      if (opts.method === "GET") return json(200, rows[uid] ? [rows[uid]] : []);
      if (opts.method === "POST") { for (const r of body) { if (r.user_id !== uid) return json(403, { message: "RLS violation" }); rows[uid] = { data: r.data, updated_at: "now" }; } return json(201, {}); }
    }
    return json(404, { message: "not found" });
  };
  return { fetchImpl, rows, log, expireAll: () => { for (const k of Object.keys(tokens)) delete tokens[k]; }, failNext: (f) => { failNext = f; } };
}
const device = (sb, t = { now: 1_000_000 }) => {
  const storage = mem(), store = createStore(storage);
  const sync = createSync({ config: { supabaseUrl: "https://x.supabase.co", supabaseKey: "sb_publishable_test" }, store, storage, fetchImpl: sb.fetchImpl, now: () => t.now, setTimer: (fn) => { sync._pending = fn; return 1; }, clearTimer: () => { sync._pending = null; } });
  return { store, sync, storage, t };
};

test("merge: newest review wins per card, nothing is lost", () => {
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
test("two devices: sign in, upload, download, merge", async () => {
  const sb = fakeSupabase(), A = device(sb), B = device(sb);
  A.store.setCard("phr.1", rate(undefined, "good", "2026-10-10")); A.store.markBlock("2026-10-10", "read", true);
  const r = await A.sync.signIn("me@example.com", "secret"); assert.equal(r.ok, true);
  assert.ok(sb.rows["u-me@example.com"].data.cards["phr.1"]);
  assert.equal("settings" in sb.rows["u-me@example.com"].data, false);       // settings never leave the device
  await B.sync.signIn("me@example.com", "secret");
  assert.equal(B.store.card("phr.1").box, 1); assert.equal(B.store.day("2026-10-10").blocks.read, true);
  B.store.setCard("phr.1", rate(B.store.card("phr.1"), "easy", "2026-10-11")); await B.sync.syncNow();
  await A.sync.syncNow(); assert.equal(A.store.card("phr.1").last, "2026-10-11");
});
test("a change schedules an upload (debounced)", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  A.store.setCard("c", rate(undefined, "good", "2026-10-10")); assert.equal(typeof A.sync._pending, "function");
  await A.sync._pending(); assert.ok(sb.rows["u-me@example.com"].data.cards.c);
  A.store.setting("newPerDay", 20); // settings do not schedule anything
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
});
test("sign out clears the session and stops syncing", async () => {
  const sb = fakeSupabase(), A = device(sb); await A.sync.signIn("me@example.com", "secret");
  await A.sync.signOut(); assert.equal(A.sync.info().signedIn, false); assert.deepEqual(await A.sync.syncNow(), { ok: false, reason: "signed-out" });
});
