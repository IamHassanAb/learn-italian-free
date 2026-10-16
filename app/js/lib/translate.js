// Free, key-less translation for the browser. Two providers, tried in this order:
//  1. Chrome's built-in on-device Translator (desktop Chrome only; private, works offline after a one-time model download)
//  2. MyMemory (https://mymemory.translated.net): a free web API that allows browser requests. 5,000 characters a day without an email,
//     50,000 with one. Its answers come partly from a community translation memory and CAN be wrong, so the app marks every result unchecked.
// Pure where possible and unit-tested with fake fetch / fake Translator.
const enc = new TextEncoder();
export const MAX_BYTES = 450;           // MyMemory accepts about 500 bytes per request
export const DAILY_LIMIT = { anonymous: 5000, withEmail: 50000 };

export function decodeEntities(s) {
  return String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function splitText(text, max = MAX_BYTES) {
  const t = String(text).replace(/\s+/g, " ").trim();
  if (!t) return [];
  const size = (x) => enc.encode(x).length;
  if (size(t) <= max) return [t];
  const out = []; let cur = "";
  for (const s of (t.match(/[^.!?…]+[.!?…]*\s*/g) || [t])) {
    if (size((cur + s).trim()) <= max) { cur += s; continue; }
    if (cur.trim()) out.push(cur.trim());
    cur = s;
    if (size(cur.trim()) > max) {                      // one very long sentence: split on words
      let line = "";
      for (const w of cur.trim().split(" ")) { if (line && size(line + " " + w) > max) { out.push(line); line = w; } else line = line ? line + " " + w : w; }
      cur = line;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const IT = new Set("il lo la le gli un una di da con su per tra fra che chi non è sono ho hai ha abbiamo mi ti ci vi si dove quando quanto grazie prego buongiorno buonasera vorrei posso può del della dei delle al alla nel nella più molto bene anche ma se sto sta ancora già perché cosa questo questa".split(" "));
const EN = new Set("the is are am was were i you he she it we they and to of in that this with for on my your do does did not can could would how what where when please thank thanks hello have has will me want need".split(" "));
export function guessLang(text) {
  const words = String(text).toLowerCase().match(/[a-zàèéìòù']+/g) || [];
  let it = (String(text).match(/[àèéìòù]/gi) || []).length * 2, en = 0;
  for (const w of words) { if (IT.has(w)) it++; if (EN.has(w)) en++; }
  return it > en ? "it" : en > it ? "en" : null;
}

function dedupe(alts, best) {
  const seen = new Set([best.trim().toLowerCase()]), out = [];
  for (const a of alts.sort((x, y) => y.match - x.match)) { const k = a.text.trim().toLowerCase(); if (a.text.trim() && !seen.has(k)) { seen.add(k); out.push(a); } }
  return out.slice(0, 3);
}

async function myMemory({ fetchImpl, text, from, to, email }) {
  const parts = splitText(text); const done = []; let alternatives = [];
  for (const part of parts) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=${encodeURIComponent(from + "|" + to)}` + (email ? `&de=${encodeURIComponent(email)}` : "");
    const res = await fetchImpl(url);
    if (!res.ok) throw Object.assign(new Error(`Translation service error (${res.status}).`), { code: "api", status: res.status });
    const j = await res.json();
    const t = decodeEntities((j.responseData && j.responseData.translatedText) || "");
    if (Number(j.responseStatus) !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) {
      const quota = /ALL AVAILABLE FREE TRANSLATIONS|WARNING/i.test(t) || Number(j.responseStatus) === 429;
      throw Object.assign(new Error(quota ? "The free daily translation limit is used up." : "The translation service could not translate that."), { code: quota ? "quota" : "api" });
    }
    done.push(t);
    if (parts.length === 1) alternatives = (j.matches || []).map((m) => ({ text: decodeEntities(m.translation || ""), match: Number(m.match) || 0, by: m["created-by"] || "" }));
  }
  const best = done.join(" ");
  return { text: best, alternatives: dedupe(alternatives, best), provider: "mymemory" };
}

async function chromeOnDevice({ win, cache, text, from, to }) {
  if (!win || !win.Translator) return null;
  const opts = { sourceLanguage: from, targetLanguage: to };
  // Only when the language model is already on this device. A model that still has to be downloaded would stall the typing.
  if ((await win.Translator.availability(opts)) !== "available") return null;
  const key = from + ">" + to; let tr = cache.get(key);
  if (!tr) { tr = await win.Translator.create(opts); cache.set(key, tr); }
  return { text: await tr.translate(text), alternatives: [], provider: "chrome" };
}

const withTimeout = (promise, ms) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("timeout")), ms); promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); }); });

export function createTranslator({ fetchImpl = (...a) => fetch(...a), win = null, storage = null, getSettings = () => ({}), today = () => new Date().toISOString().slice(0, 10), chromeTimeoutMs = 6000 } = {}) {
  const memo = new Map(), chromeCache = new Map();
  const qkey = () => "italiano-ogni-giorno:tq:" + today();
  const used = () => { try { return Number(storage && storage.getItem(qkey())) || 0; } catch { return 0; } };
  const addUsed = (n) => { try { if (storage) storage.setItem(qkey(), String(used() + n)); } catch { /* ignore */ } };
  return {
    usedToday: used,
    limit: () => (getSettings().translateEmail ? DAILY_LIMIT.withEmail : DAILY_LIMIT.anonymous),
    chromeSupported: () => !!(win && win.Translator),
    async translate(text, from, to) {
      const clean = String(text).replace(/\s+/g, " ").trim();
      if (!clean) return { text: "", alternatives: [], provider: null };
      const key = `${from}>${to}:${clean}`; if (memo.has(key)) return memo.get(key);
      const s = getSettings(); let result = null;
      if ((s.translateProvider || "auto") === "auto") { try { result = await withTimeout(chromeOnDevice({ win, cache: chromeCache, text: clean, from, to }), chromeTimeoutMs); } catch { result = null; } }
      if (!result) { result = await myMemory({ fetchImpl, text: clean, from, to, email: (s.translateEmail || "").trim() }); addUsed(clean.length); }
      if (memo.size > 50) memo.clear();
      memo.set(key, result); return result;
    },
  };
}

export const googleTranslateLink = (text, from, to) => `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;
