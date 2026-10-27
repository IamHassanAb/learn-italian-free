// Optional cross-device sync through your own Supabase project (plain fetch, no library).
// Needs the project address and the PUBLISHABLE key (set in Settings, kept on this device) and supabase/schema.sql run once in that project.
// Sync works row by row: pull what changed in the cloud since last time, merge it in, then upload only the rows changed here.
// See DATABASE-PLAN.md. The old single-JSON table (italiano_progress) is read once, if present, and copied into the new tables.
import { mergeStates } from "./merge.js";
import { KINDS, TABLE, applyRows, collectDirty, markAllDirty } from "./rows.js";

const SESSION_KEY = "italiano-ogni-giorno:sync";
const LEGACY_TABLE = "italiano_progress";
const CONFLICT = { prefs: "user_id", cards: "user_id,card_id", daily: "user_id,day", gaps: "user_id,id", ratings: "user_id,scenario_id", drills: "user_id,kind" };
const PAGE = 1000, BATCH = 200, OVERLAP_MS = 10_000;
const MIN_SCHEMA = 3;                    // 3 added own_sentences on log lines
const UPGRADE_MSG = "This Supabase project needs the newest tables. Open the SQL editor, run supabase/schema.sql from the repository (it is safe to run again), then sync again.";

export function createSync({ config, store, storage, fetchImpl = (...a) => fetch(...a), now = () => Date.now(), debounceMs = 4000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const url = ((config && config.supabaseUrl) || "").replace(/\/+$/, "");
  const key = (config && config.supabaseKey) || "";
  const enabled = !!(url && key);
  let session = null, status = "idle", error = "", timer = null, running = false, again = false;
  const listeners = new Set();

  const loadSession = () => { try { const raw = storage && storage.getItem(SESSION_KEY); session = raw ? JSON.parse(raw) : null; } catch { session = null; } };
  const saveSession = () => { try { session ? storage.setItem(SESSION_KEY, JSON.stringify(session)) : storage.removeItem(SESSION_KEY); } catch { /* storage blocked: stay signed in for this tab only */ } };
  const emit = (s, e = "") => { status = s; error = e; listeners.forEach((fn) => { try { fn(api.info()); } catch { /* ignore */ } }); };
  if (enabled) loadSession();

  const headers = (token) => ({ apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) });

  async function authCall(grant, body) {
    const res = await fetchImpl(`${url}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(j.error_description || j.msg || j.message || `Sign-in failed (${res.status})`); e.status = res.status; throw e; }
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: now() + (j.expires_in || 3600) * 1000, user_id: j.user && j.user.id, email: (j.user && j.user.email) || (session && session.email) || "", lastSync: session && session.lastSync };
  }

  async function token() {
    if (!session) return null;
    if (session.expires_at - 60000 > now()) return session.access_token;
    try { session = await authCall("refresh_token", { refresh_token: session.refresh_token }); saveSession(); return session.access_token; }
    catch (e) { if (e.status && e.status < 500) { session = null; saveSession(); } throw e; }
  }

  async function rest(method, path, body, extra = {}) {
    const t = await token(); if (!t) throw Object.assign(new Error("Signed out"), { status: 401 });
    const res = await fetchImpl(`${url}/rest/v1/${path}`, { method, headers: { ...headers(t), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw Object.assign(new Error(j.message || `Sync failed (${res.status})`), { status: res.status, code: j.code }); }
    return method === "GET" || path.startsWith("rpc/") ? res.json() : null;
  }

  const SELECT = (kind, cursor) => `${TABLE[kind]}?select=*&order=updated_at.asc${cursor ? `&updated_at=gte.${encodeURIComponent(new Date(Date.parse(cursor) - OVERLAP_MS).toISOString())}` : ""}`;

  async function pull(cursors) {
    const got = {}, next = {};
    for (const kind of KINDS) {
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const page = await rest("GET", SELECT(kind, cursors[TABLE[kind]]), undefined, { Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" });
        rows.push(...page); if (page.length < PAGE) break;
      }
      got[kind] = rows;
      if (rows.length) next[TABLE[kind]] = rows[rows.length - 1].updated_at;
    }
    return { got, next };
  }

  async function push(rowsByTable) {
    for (const [table, rows] of Object.entries(rowsByTable)) {
      const kind = KINDS.find((k) => TABLE[k] === table);
      for (let i = 0; i < rows.length; i += BATCH)
        await rest("POST", `${table}?on_conflict=${CONFLICT[kind]}`, rows.slice(i, i + BATCH).map((r) => ({ ...r, user_id: session.user_id })), { Prefer: "resolution=merge-duplicates,return=minimal" });
    }
  }

  // The cloud has the new tables? (A project that only has the old table needs schema.sql first.)
  let schemaOk = false;
  async function checkSchema() {
    if (schemaOk) return;
    try { const v = await rest("POST", "rpc/italiano_schema_version", {}); if (Number(v) < MIN_SCHEMA) throw Object.assign(new Error(UPGRADE_MSG), { status: 404, upgrade: true }); schemaOk = true; }
    catch (e) { if (e.upgrade) throw e; if (e.status === 404 || e.code === "PGRST202") throw Object.assign(new Error(UPGRADE_MSG), { status: 404, upgrade: true }); throw e; }
  }

  // First time on this device for this project and user: copy the old single-JSON row across (if there is one) and send everything.
  // The same step makes "move to another project" work: a different address or user means start over from this device's data.
  async function firstSync() {
    const where = `${url}|${session.user_id}`;
    if (store.state.sync.cursors.where === where) return;
    let legacy = null;
    try { const rows = await rest("GET", `${LEGACY_TABLE}?select=data&limit=1`); legacy = rows[0] && rows[0].data && Object.keys(rows[0].data).length ? rows[0].data : null; }
    catch (e) { if (e.status !== 404) throw e; }          // no old table: nothing to copy
    if (legacy) store.replaceShared({ ...mergeStates(store.state, legacy), settings: store.state.settings, sync: store.state.sync });
    store.markAllDirty();
    store.setCursors({ where });
  }

  async function syncNow() {
    if (!enabled || !session) return { ok: false, reason: "signed-out" };
    if (running) { again = true; return { ok: true, queued: true }; }
    running = true; emit("syncing");
    try {
      await checkSchema();
      await firstSync();
      const { got, next } = await pull(store.state.sync.cursors);
      const { state, changed } = applyRows(store.state, got);
      store.replaceShared(state); store.setCursors(next);
      const { rows, sent } = collectDirty(store.state);
      await push(rows); store.markSent(sent);
      session.lastSync = now(); saveSession(); emit("idle");
      return { ok: true, pulled: changed, pushed: Object.values(rows).reduce((n, r) => n + r.length, 0) };
    } catch (e) {
      const offline = !e.status;     // fetch itself failed: no network
      emit(e.upgrade ? "upgrade" : offline ? "offline" : "error", offline ? "No connection. Will retry when you are online." : e.message);
      return { ok: false, reason: e.upgrade ? "upgrade" : offline ? "offline" : "error", message: e.message };
    } finally { running = false; if (again) { again = false; schedule(0); } }
  }

  function schedule(ms = debounceMs) {
    if (!enabled || !session) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; return syncNow(); }, ms);
  }
  if (enabled) store.onChange(() => schedule());

  const api = {
    enabled, listeners,
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    info: () => ({ enabled, signedIn: !!session, email: session ? session.email : "", status, error, lastSync: session ? session.lastSync || null : null }),
    async signIn(email, password) {
      if (!enabled) throw new Error("Sync is not configured.");
      session = await authCall("password", { email: String(email).trim(), password }); saveSession(); emit("idle");
      return syncNow();
    },
    async signOut() {
      if (session) { try { await fetchImpl(`${url}/auth/v1/logout`, { method: "POST", headers: headers(session.access_token) }); } catch { /* best effort */ } }
      session = null; saveSession(); if (timer) { clearTimer(timer); timer = null; } emit("idle");
    },
    syncNow, schedule,
  };
  return api;
}
