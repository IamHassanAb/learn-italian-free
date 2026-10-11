// Optional cross-device sync through the owner's own Supabase project (plain fetch, no library).
// Needs app/config.json {supabaseUrl, supabaseKey} (the PUBLISHABLE key, safe to publish) and supabase/italiano_progress.sql
// run once in that project. Sign-ups should be disabled; the owner's account is created in the Supabase dashboard.
import { mergeStates, shareable } from "./merge.js";

const SESSION_KEY = "italiano-ogni-giorno:sync";
const TABLE = "italiano_progress";

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
    return method === "GET" ? res.json() : null;
  }

  async function syncNow() {
    if (!enabled || !session) return { ok: false, reason: "signed-out" };
    if (running) { again = true; return { ok: true, queued: true }; }
    running = true; emit("syncing");
    try {
      const rows = await rest("GET", `${TABLE}?select=data,updated_at&limit=1`);
      const remote = rows[0] && rows[0].data && Object.keys(rows[0].data).length ? rows[0].data : null;
      const merged = mergeStates(store.state, remote);
      store.replaceShared(merged);
      await rest("POST", `${TABLE}?on_conflict=user_id`, [{ user_id: session.user_id, data: shareable(store.state) }], { Prefer: "resolution=merge-duplicates,return=minimal" });
      session.lastSync = now(); saveSession(); emit("idle");
      return { ok: true, pulled: !!remote };
    } catch (e) {
      const offline = !e.status;     // fetch itself failed: no network
      emit(offline ? "offline" : "error", offline ? "No connection. Will retry when you are online." : e.message);
      return { ok: false, reason: offline ? "offline" : "error", message: e.message };
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
