import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig, makeSetupPayload, parseSetupPayload, loadDeviceConfig, saveDeviceConfig, clearDeviceConfig } from "../js/lib/syncconfig.js";

const jwt = (role) => "h." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".s";
const URL_OK = "https://abcdefghij.supabase.co", KEY_OK = "sb_publishable_AbCdEf123456_xyz";
const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };

test("accepts a publishable key and normalises the address", () => {
  const r = validateConfig(" " + URL_OK + "/ ", " " + KEY_OK + " "); assert.equal(r.ok, true);
  assert.deepEqual(r.config, { supabaseUrl: URL_OK, supabaseKey: KEY_OK });
  assert.equal(validateConfig("http://localhost:54321", KEY_OK).ok, true);
  assert.equal(validateConfig(URL_OK, jwt("anon")).ok, true);          // legacy anon key still works
});
test("secret and service_role keys are always refused", () => {
  for (const k of ["sb_secret_abcdefghijkl", jwt("service_role")]) { const r = validateConfig(URL_OK, k); assert.equal(r.ok, false); assert.match(r.error, /SECRET/); }
});
test("bad addresses and random keys are refused", () => {
  assert.equal(validateConfig("not a url", KEY_OK).ok, false); assert.equal(validateConfig("http://evil.example.com", KEY_OK).ok, false);
  assert.equal(validateConfig(URL_OK, "hunter2").ok, false); assert.equal(validateConfig(URL_OK, "").ok, false);
});
test("setup link round trips and rejects junk", () => {
  const p = makeSetupPayload({ supabaseUrl: URL_OK, supabaseKey: KEY_OK }); assert.match(p, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(parseSetupPayload(p).config, { supabaseUrl: URL_OK, supabaseKey: KEY_OK });
  assert.equal(parseSetupPayload("%%%").ok, false); assert.equal(parseSetupPayload(makeSetupPayload({ supabaseUrl: URL_OK, supabaseKey: "sb_secret_abcdefghijkl" })).ok, false);
});
test("device storage: save, load, clear, and tolerate tampering or blocked storage", () => {
  const s = mem(); assert.equal(loadDeviceConfig(s), null);
  saveDeviceConfig(s, { supabaseUrl: URL_OK, supabaseKey: KEY_OK }); assert.equal(loadDeviceConfig(s).supabaseKey, KEY_OK);
  s.setItem("italiano-ogni-giorno:sync-config", JSON.stringify({ supabaseUrl: URL_OK, supabaseKey: "sb_secret_abcdefghijkl" })); assert.equal(loadDeviceConfig(s), null);
  clearDeviceConfig(s); assert.equal(loadDeviceConfig(s), null);
  const blocked = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  assert.equal(loadDeviceConfig(blocked), null); assert.equal(saveDeviceConfig(blocked, { supabaseUrl: URL_OK, supabaseKey: KEY_OK }), false); clearDeviceConfig(blocked);
});
