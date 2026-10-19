// Runs supabase/schema.sql (and the migrations) against a real Postgres running in WebAssembly (PGlite),
// with a small stand-in for Supabase's auth schema, and checks security and the sync rules.
// Needs Node 18+ and:  npm i @electric-sql/pglite     then:  node tools/sql-check.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = (f) => readFileSync(join(root, f), "utf8");
export const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";

// What Supabase provides before our SQL runs: roles, auth.users and auth.uid().
export const SUPABASE_STANDIN = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;   -- like an old Supabase project: grants must be removed by our SQL
  insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');
`;

export async function freshDb() { const db = new PGlite(); await db.exec(SUPABASE_STANDIN); return db; }
export async function asUser(db, uid, fn) {         // run as a signed-in user (or anonymous when uid is null)
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid || ""}', false);`);
  try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}
const rejects = async (p, re) => { try { await p; } catch (e) { assert.match(String(e.message), re); return; } assert.fail("expected an error matching " + re); };

if (process.argv[1] && process.argv[1].endsWith("sql-check.mjs")) {
  let n = 0; const ok = (m) => console.log("  ok  " + m), step = async (m, f) => { await f(); n++; ok(m); };
  const db = await freshDb();

  await step("schema.sql runs, and runs a second time without errors", async () => { await db.exec(sql("supabase/schema.sql")); await db.exec(sql("supabase/schema.sql")); });
  await step("schema version is 2", async () => assert.equal((await asUser(db, A, () => db.query("select public.italiano_schema_version() v"))).rows[0].v, 2));
  await step("anonymous users can read and write nothing", async () => {
    for (const t of ["italiano_profiles", "italiano_card_states", "italiano_daily", "italiano_log_entries", "italiano_scenario_ratings", "italiano_drill_stats"])
      await asUser(db, null, async () => rejects(db.query(`select * from public.${t}`), /permission denied/));
  });
  await step("RLS is on for every table", async () => {
    const r = await db.query("select count(*)::int n from pg_tables where schemaname='public' and tablename like 'italiano\\_%' and not rowsecurity"); assert.equal(r.rows[0].n, 0);
  });

  const put = (uid, t, cols, vals) => asUser(db, uid, () => db.query(`insert into public.${t} (user_id, ${cols}) values ('${uid}', ${vals}) on conflict do nothing`));
  await put(A, "italiano_card_states", "card_id, due, client_updated_at", "'p1.a', '2026-10-20', '2026-10-19T10:00:00Z'");
  await put(A, "italiano_log_entries", "id, italian, english, client_updated_at", "'gap.1', 'Ciao', 'Hello', '2026-10-19T10:00:00Z'");
  await put(B, "italiano_log_entries", "id, italian, english, client_updated_at", "'gap.1', 'Buongiorno', 'Good morning', '2026-10-19T10:00:00Z'");

  await step("a user sees only their own rows, even when two users share an id", async () => {
    const a = await asUser(db, A, () => db.query("select italian from public.italiano_log_entries")), b = await asUser(db, B, () => db.query("select italian from public.italiano_log_entries"));
    assert.deepEqual(a.rows.map((r) => r.italian), ["Ciao"]); assert.deepEqual(b.rows.map((r) => r.italian), ["Buongiorno"]);
    assert.equal((await asUser(db, B, () => db.query("select * from public.italiano_card_states"))).rows.length, 0);
  });
  await step("a user cannot write a row for someone else", async () => {
    await asUser(db, A, () => rejects(db.query(`insert into public.italiano_card_states (user_id, card_id, due) values ('${B}', 'x', '2026-10-20')`), /row-level security/));
  });
  await step("a user cannot change or delete someone else's row", async () => {
    const u = await asUser(db, B, () => db.query("update public.italiano_log_entries set italian='hacked' where user_id = '" + A + "' returning 1")); assert.equal(u.rows.length, 0);
    await asUser(db, B, () => db.query("update public.italiano_log_entries set deleted_at = now() where user_id = '" + A + "'"));
    await asUser(db, B, () => db.query("delete from public.italiano_log_entries where user_id = '" + A + "'"));
    const a = await asUser(db, A, () => db.query("select italian, deleted_at from public.italiano_log_entries")); assert.deepEqual(a.rows.map((r) => [r.italian, r.deleted_at]), [["Ciao", null]]);
  });
  await step("a user cannot hand a row to someone else by changing user_id", async () => {
    await asUser(db, A, () => rejects(db.query(`update public.italiano_log_entries set user_id = '${B}', id = 'moved'`), /row-level security/));
  });
  await step("an older edit never overwrites a newer one; a newer edit does; the same edit twice is harmless", async () => {
    const up = (when, it) => asUser(db, A, () => db.query(`insert into public.italiano_log_entries (user_id, id, italian, english, client_updated_at) values ('${A}', 'gap.1', '${it}', 'Hello', '${when}')
      on conflict (user_id, id) do update set italian = excluded.italian, english = excluded.english, client_updated_at = excluded.client_updated_at`));
    const read = async () => (await asUser(db, A, () => db.query("select italian from public.italiano_log_entries where id='gap.1'"))).rows[0].italian;
    await up("2026-10-19T09:00:00Z", "OLD"); assert.equal(await read(), "Ciao");
    await up("2026-10-19T11:00:00Z", "Salve"); assert.equal(await read(), "Salve");
    await up("2026-10-19T11:00:00Z", "Salve"); assert.equal(await read(), "Salve");
    await up("2026-10-19T10:30:00Z", "STALE"); assert.equal(await read(), "Salve");
  });
  await step("the server stamps updated_at, so a device can ask for 'changes since'", async () => {
    const r = await asUser(db, A, () => db.query("select updated_at > now() - interval '1 minute' fresh from public.italiano_log_entries where id='gap.1'")); assert.equal(r.rows[0].fresh, true);
  });
  await step("bad values are refused", async () => {
    await asUser(db, A, async () => {
      await rejects(db.query(`insert into public.italiano_card_states (user_id, card_id, due, box) values ('${A}', 'z', '2026-10-20', 9)`), /check constraint/);
      await rejects(db.query(`insert into public.italiano_log_entries (user_id, id, italian, english, kind) values ('${A}', 'k', 'a', 'b', 'shouted')`), /check constraint/);
      await rejects(db.query(`insert into public.italiano_scenario_ratings (user_id, scenario_id, stars) values ('${A}', 's', 5)`), /check constraint/);
      await rejects(db.query(`insert into public.italiano_log_entries (user_id, id, italian, english) values ('${A}', 'e', '', 'b')`), /check constraint/);
    });
  });
  await step("only delete markers can be hard-deleted, and purge only touches your own rows older than a year", async () => {
    await asUser(db, A, () => rejects(db.query("delete from public.italiano_log_entries where id='gap.1'"), /./).catch(() => {}));
    assert.equal((await asUser(db, A, () => db.query("select count(*)::int n from public.italiano_log_entries where id='gap.1'"))).rows[0].n, 1);
    await db.exec(`insert into public.italiano_log_entries (user_id, id, italian, english, deleted_at) values ('${A}', 'old', 'x', 'y', now() - interval '400 days'), ('${B}', 'oldb', 'x', 'y', now() - interval '400 days'), ('${A}', 'new', 'x', 'y', now() - interval '10 days')`);
    const purged = (await asUser(db, A, () => db.query("select public.italiano_purge_deleted() n"))).rows[0].n; assert.equal(purged, 1);
    const left = (await db.query("select id from public.italiano_log_entries where id in ('old','oldb','new') order by id")).rows.map((r) => r.id); assert.deepEqual(left, ["new", "oldb"]);
  });
  await step("the app's own rows fit the tables: store -> rows -> Postgres -> rows -> a second store, nothing lost", async () => {
    await db.exec("delete from public.italiano_card_states; delete from public.italiano_log_entries;");        // start this check from empty tables
    const { createStore } = await import(pathToFileURL(join(root, "app/js/lib/store.js")).href);
    const { collectDirty, applyRows, TABLE } = await import(pathToFileURL(join(root, "app/js/lib/rows.js")).href);
    const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
    const one = createStore(mem());
    one.setCard("pb-banking.p146", { box: 3, due: "2026-11-01", reps: 5, lapses: 1, last: "2026-10-19" });
    one.markBlock("2026-10-19", "read", true); one.markBlock("2026-10-19", "speak", true); one.addReviewed("2026-10-19", 7, 2); one.addDrill("2026-10-19", "numbers", 8, 10); one.setRating("scenario-bar", 3);
    const g = one.addGap({ it: "Dov'è la farmacia?", en: "Where is the pharmacy?", ctx: "health", kind: "corrected", note: "I said 'Dove la farmacia'", tag: "step3-grammar.x", src: "translate", provider: "mymemory", checked: true });
    const gone = one.addGap({ it: "da cancellare", en: "to delete", src: "manual" }); one.removeGap(gone.id);
    one.setting("newPerDay", 15); one.setting("decks", ["pb-banking"]);
    const { rows } = collectDirty(one.state);
    for (const [table, list] of Object.entries(rows)) for (const r of list) {
      const cols = ["user_id", ...Object.keys(r)], vals = [A, ...Object.values(r).map((v) => (v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v))];
      await asUser(db, A, () => db.query(`insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => "$" + (i + 1)).join(", ")}) on conflict do nothing`, vals));
    }
    const pulled = {};
    for (const [kind, table] of Object.entries(TABLE)) {
      const r = await asUser(db, A, () => db.query(`select * from public.${table} where user_id = '${A}' order by updated_at`));
      pulled[kind] = r.rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? (["due", "last_reviewed", "day", "created_on", "rated_on"].includes(k) ? v.toISOString().slice(0, 10) : v.toISOString()) : v])));
    }
    const two = createStore(mem()); const { state } = applyRows(two.state, pulled);
    assert.deepEqual(state.cards, one.state.cards); assert.deepEqual(state.ratings, one.state.ratings); assert.deepEqual(state.drills, one.state.drills);
    assert.deepEqual(state.daily, one.state.daily);
    assert.deepEqual(state.gaps.map((x) => ({ ...x, updated: undefined })), one.state.gaps.map((x) => ({ ...x, updated: undefined })));
    assert.equal(state.settings.newPerDay, 15); assert.deepEqual(state.settings.decks, ["pb-banking"]);
    assert.equal(state.gaps.some((x) => x.id === gone.id), false); assert.ok(state.gapsDeleted.includes(gone.id));
  });
  await step("deleting a user removes all their data", async () => {
    await db.exec(`delete from auth.users where id = '${B}'`);
    assert.equal((await db.query(`select count(*)::int n from public.italiano_log_entries where user_id = '${B}'`)).rows[0].n, 0);
  });
  console.log(`\n${n} checks passed`);
  await db.close();
}
