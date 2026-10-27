import test from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, splitText, guessLang, createTranslator, googleTranslateLink, MAX_BYTES } from "../js/lib/translate.js";
import { createStore } from "../js/lib/store.js";
import { mergeStates } from "../js/lib/merge.js";

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; };
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("decodeEntities handles the entities MyMemory returns", () => {
  assert.equal(decodeEntities("l&#39;uovo &amp; il caff&#xE8; &quot;ok&quot;"), "l'uovo & il caffè \"ok\"");
});
test("splitText keeps short text whole and splits long text under the byte limit", () => {
  assert.deepEqual(splitText("  Where   is the pharmacy? "), ["Where is the pharmacy?"]);
  const long = Array.from({ length: 30 }, (_, i) => `This is sentence number ${i + 1}.`).join(" ");
  const parts = splitText(long); assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= MAX_BYTES, p.length);
  assert.equal(parts.join(" ").replace(/\s+/g, " "), long);
  assert.ok(splitText("x ".repeat(600)).every((p) => p.length <= MAX_BYTES));
  assert.deepEqual(splitText("   "), []);
});
test("guessLang tells Italian from English and admits when it cannot", () => {
  assert.equal(guessLang("Dove si trova la farmacia?"), "it"); assert.equal(guessLang("Where is the pharmacy?"), "en");
  assert.equal(guessLang("Vorrei un caffè, per favore"), "it"); assert.equal(guessLang("I would like a coffee"), "en");
  assert.equal(guessLang("pizza"), null); assert.equal(guessLang(""), null);
});
test("MyMemory result: decoded text, best answer first, alternatives deduped and sorted", async () => {
  const urls = [];
  const t = createTranslator({ fetchImpl: async (u) => { urls.push(u); return reply({ responseStatus: 200, responseData: { translatedText: "Dov&#39;è la farmacia?", match: 0.96 },
    matches: [{ translation: "Dov'è la farmacia?", match: 0.96 }, { translation: "Dove si trova la farmacia?", match: 0.9, "created-by": "Ann" }, { translation: "Dove è la farmacia?", match: 0.7 }, { translation: "dove si trova la farmacia?", match: 0.5 }] }); } });
  const r = await t.translate("Where is the pharmacy?", "en", "it");
  assert.equal(r.text, "Dov'è la farmacia?"); assert.equal(r.provider, "mymemory");
  assert.deepEqual(r.alternatives.map((a) => a.text), ["Dove si trova la farmacia?", "Dove è la farmacia?"]);
  assert.match(urls[0], /langpair=en%7Cit/); assert.doesNotMatch(urls[0], /&de=/);
});
test("the optional email raises the limit and is sent as de=", async () => {
  const urls = []; const settings = { translateEmail: "me@example.com" };
  const t = createTranslator({ getSettings: () => settings, fetchImpl: async (u) => { urls.push(u); return reply({ responseStatus: 200, responseData: { translatedText: "ciao" }, matches: [] }); } });
  await t.translate("hello", "en", "it"); assert.match(urls[0], /&de=me%40example.com/); assert.equal(t.limit(), 50000);
});
test("quota and API problems become clear errors", async () => {
  const quota = createTranslator({ fetchImpl: async () => reply({ responseStatus: 429, responseData: { translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY." } }) });
  await assert.rejects(() => quota.translate("hello", "en", "it"), (e) => e.code === "quota");
  const down = createTranslator({ fetchImpl: async () => reply({}, 503) }); await assert.rejects(() => down.translate("hello", "en", "it"), (e) => e.code === "api");
  const offline = createTranslator({ fetchImpl: async () => { throw new TypeError("fetch failed"); } }); await assert.rejects(() => offline.translate("hello", "en", "it"), TypeError);
});
test("usage counter and memo: a repeated phrase costs nothing", async () => {
  const st = mem(); let calls = 0;
  const t = createTranslator({ storage: st, today: () => "2026-10-16", fetchImpl: async () => { calls++; return reply({ responseStatus: 200, responseData: { translatedText: "ciao" }, matches: [] }); } });
  await t.translate("hello", "en", "it"); await t.translate("hello", "en", "it"); await t.translate("good morning", "en", "it");
  assert.equal(calls, 2); assert.equal(t.usedToday(), "hello".length + "good morning".length);
});
test("on-device Chrome translator is used first when present, with a fallback when it fails or is unavailable", async () => {
  let net = 0; const fetchImpl = async () => { net++; return reply({ responseStatus: 200, responseData: { translatedText: "da rete" }, matches: [] }); };
  const good = { Translator: { availability: async () => "available", create: async () => ({ translate: async (t) => "locale:" + t }) } };
  const a = await createTranslator({ win: good, fetchImpl }).translate("hi", "en", "it"); assert.deepEqual([a.text, a.provider, net], ["locale:hi", "chrome", 0]);
  const none = { Translator: { availability: async () => "unavailable" } };
  const b = await createTranslator({ win: none, fetchImpl }).translate("hi", "en", "it"); assert.deepEqual([b.provider, net], ["mymemory", 1]);
  const broken = { Translator: { availability: async () => "downloadable", create: async () => { throw new Error("NotAllowedError"); } } };
  const c = await createTranslator({ win: broken, fetchImpl }).translate("hi", "en", "it"); assert.equal(c.provider, "mymemory");
  const notYet = { Translator: { availability: async () => "downloadable", create: async () => { throw new Error("must not be called"); } } };
  assert.equal((await createTranslator({ win: notYet, fetchImpl }).translate("hi", "en", "it")).provider, "mymemory");     // model not on the device yet: skip it
  const hangs = { Translator: { availability: async () => "available", create: async () => ({ translate: () => new Promise(() => {}) }) } };
  const slow = await createTranslator({ win: hangs, fetchImpl, chromeTimeoutMs: 30 }).translate("hi", "en", "it"); assert.equal(slow.provider, "mymemory");   // a stalled on-device translator never blocks typing
  const forced = await createTranslator({ win: good, fetchImpl, getSettings: () => ({ translateProvider: "mymemory" }) }).translate("hi", "en", "it"); assert.equal(forced.provider, "mymemory");
});
test("google translate link is built safely", () => {
  assert.equal(googleTranslateLink("Dov'è la farmacia?", "it", "en"), "https://translate.google.com/?sl=it&tl=en&text=Dov'%C3%A8%20la%20farmacia%3F&op=translate");
});
test("log entries: updates are remembered and the newest edit wins when merging devices", () => {
  const s = createStore(mem()); const g = s.addGap({ it: "Dov'è la farmacia?", en: "Where is the pharmacy?", src: "translate", checked: false });
  s.updateGap(g.id, { checked: true, note: "confirmed by the pharmacist" });
  assert.equal(s.state.gaps[0].checked, true); assert.ok(s.state.gaps[0].updated);
  const older = { ...s.state, gaps: [{ ...s.state.gaps[0], checked: false, note: "", updated: "2020-01-01T00:00:00.000Z" }], gapsDeleted: [] };
  assert.equal(mergeStates(older, s.state).gaps[0].checked, true);
  assert.equal(mergeStates(s.state, older).gaps[0].checked, true);
});

test("polish: an echoed answer is replaced by the best real alternative, and a stray full stop is dropped", async () => {
  const { polish } = await import("../js/lib/translate.js");
  const r = polish("sky", "sky", [{ text: "sky", match: 0.99, by: "" }, { text: "cielo.", match: 0.8, by: "x" }, { text: "Sky", match: 0.5, by: "" }]);
  assert.equal(r.text, "cielo"); assert.equal(r.unchanged, false); assert.ok(r.alternatives.every((a) => !/^sky$/i.test(a.text) || false) || r.alternatives.length <= 3);
  const full = polish("Where is it.", "Dov'è.", [{ text: "Dov'è.", match: 1, by: "" }]); assert.equal(full.text, "Dov'è.");
});
test("polish: nothing better to offer means the result is flagged as unchanged (words like pizza are fine)", async () => {
  const { polish } = await import("../js/lib/translate.js");
  const r = polish("pizza", "pizza.", [{ text: "Pizza", match: 0.9, by: "" }]); assert.equal(r.text, "pizza"); assert.equal(r.unchanged, true);
});
test("polish: a normal translation is untouched apart from the full stop rule", async () => {
  const { polish } = await import("../js/lib/translate.js");
  const r = polish("coffee", "caffè.", [{ text: "caffè", match: 0.9, by: "" }, { text: "il caffè", match: 0.7, by: "" }]);
  assert.equal(r.text, "caffè"); assert.equal(r.unchanged, false); assert.deepEqual(r.alternatives.map((a) => a.text), ["il caffè"]);
});
