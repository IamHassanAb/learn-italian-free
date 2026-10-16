// Where the sync connection (project address + publishable key) lives: in THIS device's own storage, never in the repo or the website.
// Pure functions, unit-tested. The key is a public-by-design "publishable" key; secret and service_role keys are always refused.
const KEY = "italiano-ogni-giorno:sync-config";

const b64u = {
  enc: (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)),
};

function jwtRole(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try { return JSON.parse(b64u.dec(parts[1])).role || null; } catch { return null; }
}

export function validateConfig(url, key) {
  let u;
  try { u = new URL(String(url || "").trim()); } catch { return { ok: false, error: "That is not a valid project address. It looks like https://abcdefgh.supabase.co" }; }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return { ok: false, error: "The project address must start with https://" };
  const k = String(key || "").trim();
  if (/^sb_secret_/i.test(k) || jwtRole(k) === "service_role") return { ok: false, error: "That is a SECRET key. Never put it in this app. Use the publishable key (it starts with sb_publishable_)." };
  if (!/^sb_publishable_[A-Za-z0-9_-]{8,}$/.test(k) && jwtRole(k) !== "anon") return { ok: false, error: "Paste the publishable key (it starts with sb_publishable_)." };
  return { ok: true, config: { supabaseUrl: u.origin, supabaseKey: k } };
}

export function loadDeviceConfig(storage) {
  try { const o = JSON.parse(storage.getItem(KEY) || "null"); const r = o && validateConfig(o.supabaseUrl, o.supabaseKey); return r && r.ok ? r.config : null; } catch { return null; }
}
export function saveDeviceConfig(storage, config) { try { storage.setItem(KEY, JSON.stringify(config)); return true; } catch { return false; } }
export function clearDeviceConfig(storage) { try { storage.removeItem(KEY); } catch { /* ignore */ } }

// A one-line setup link for your other devices. It carries the project address and the publishable key (never a password).
export function makeSetupPayload(config) { return b64u.enc(JSON.stringify({ u: config.supabaseUrl, k: config.supabaseKey })); }
export function parseSetupPayload(payload) {
  try { const o = JSON.parse(b64u.dec(String(payload))); return validateConfig(o.u, o.k); } catch { return { ok: false, error: "This setup link is not valid." }; }
}
