import { withArticle } from "./vocabdrills.js";
// Quick search across phrases, vocabulary, grammar lookups and your conversation log. Accent- and case-insensitive.
// Method: every entry is flattened once into a lowercase, accent-free string ("hay"). A query matches when every word typed
// appears in it (the start of a word ranks higher). Filters are plain field checks. This is a scan of an in-memory list,
// which stays instant for tens of thousands of entries; the screen only draws the first page of results.
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export const SOURCES = [["phrasebook", "Phrasebook"], ["scenario", "Role-play"], ["basics", "Basics"], ["grammar", "Grammar"], ["log", "My log"]];
export const KINDS = [["word", "Words"], ["phrase", "Phrases"]];
export const LOG_KIND = [["wanted", "I wanted to say"], ["heard", "They said"], ["corrected", "Corrected by a local"]];
export const LOG_STATUS = [["unchecked", "Unchecked"], ["checked", "Checked"], ["typed", "Typed by me"]];

const srcOf = (id) => (id.startsWith("pb-") ? "phrasebook" : id.startsWith("scenario-") ? "scenario" : "basics");

// Course entries never change while the app is open, so build them once and add the log on top each time.
export function buildCourseIndex(content) {
  const rows = [];
  for (const id of content.order) {
    const m = content.modules[id], src = srcOf(id);
    for (const p of m.parts) {
      if (p.type === "vocab" || p.type === "phrases") for (const it of p.items)
        rows.push({ src, kind: p.type === "vocab" ? "word" : "phrase", id: `${p.id}.${it.id}`, deck: id, topic: m.title, it: withArticle(it), en: it.en, hay: norm(`${withArticle(it)} ${it.it} ${Object.values(it.forms || {}).join(" ")} ${it.en} ${it.example || ""} ${m.title}`) });
      else if (p.type === "lookup-row")
        rows.push({ src: "grammar", kind: "grammar", id: p.id, deck: id, topic: m.title, it: null, en: p.when, answer: p.answer, hay: norm(`${p.when} ${p.answer}`) });
    }
  }
  return rows;
}

export function logRows(gaps) {
  return gaps.map((g) => ({
    src: "log", kind: "log", id: g.id, deck: "gaps", topic: "My log", it: g.it, en: g.en, note: g.note || null, sit: g.ctx || "", logKind: g.kind || "", tag: g.tag || "", created: g.created || "",
    status: g.src === "translate" ? (g.checked ? "checked" : "unchecked") : "typed",
    hay: norm(`${g.it} ${g.en} ${g.note || ""} ${g.ctx || ""}`),
  }));
}

export const buildIndex = (content, gaps = []) => buildCourseIndex(content).concat(logRows(gaps));

const pass = (set, v) => !set || !set.size || set.has(v);
export function matchesFilters(r, f = {}) {
  if (!pass(f.src, r.src)) return false;
  if (f.kind && f.kind.size && !f.kind.has(r.kind)) return false;   // grammar rows and log entries are neither word nor phrase
  if (!pass(f.deck, r.deck)) return false;
  if (f.sit && f.sit.size && !(r.src === "log" && f.sit.has(r.sit))) return false;
  if (f.logKind && f.logKind.size && !(r.src === "log" && f.logKind.has(r.logKind))) return false;
  if (f.status && f.status.size && !(r.src === "log" && f.status.has(r.status))) return false;
  return true;
}
export const hasFilters = (f = {}) => Object.values(f).some((s) => s && s.size);

// With words typed: best matches first. With only filters: browse (newest log entries first, course entries in order).
export function search(index, query, filters = {}) {
  const q = norm(query), words = q ? q.split(" ") : [];
  if (words.length && q.length < 2) return [];
  if (!words.length && !hasFilters(filters)) return [];
  const scored = [];
  for (const r of index) {
    if (!matchesFilters(r, filters)) continue;
    let score = 0;
    for (const w of words) {
      const i = r.hay.indexOf(w); if (i < 0) { score = -1; break; }
      score += i === 0 || r.hay[i - 1] === " " ? 2 : 1;
    }
    if (score < 0) continue;
    if (words.length && (norm(r.it || "").startsWith(q) || norm(r.en || "").startsWith(q))) score += 3;
    scored.push([score, r]);
  }
  if (words.length) scored.sort((a, b) => b[0] - a[0]);
  else scored.sort((a, b) => (a[1].src === "log" && b[1].src === "log" ? String(b[1].created).localeCompare(String(a[1].created)) : 0));
  return scored.map((x) => x[1]);
}
