// Drills for topic vocabulary (colours, and later family, professions...). Pure functions, unit-tested.
// A topic is a module with a `drills` list; its words come from its `vocab` parts. Each question has the shape the other drills use
// ({kind, prompt, hint, answers, show, speak}) plus optional {choices, swatch, why, card}.
import { pick, shuffle } from "./util.js";

// "il" + "padre" -> "il padre"; "l'" + "amico" -> "l'amico"
export const withArticle = (item) => (item.art ? `${item.art}${item.art.endsWith("'") ? "" : " "}${item.it}` : item.it);

export function topicWords(module) {
  const out = [];
  for (const p of module.parts || []) if (p.type === "vocab") for (const it of p.items) out.push({ ...it, card: `${p.id}.${it.id}` });
  return out;
}

const FORM_ASK = { f: "feminine", mp: "masculine plural", fp: "feminine plural" };
const GENDER_TARGETS = ["f", "mp", "fp"];
let voiceAvailable = true;
export const setVoiceAvailable = (v) => { voiceAvailable = !!v; };

// Distinct wrong choices from the same topic; the right one is placed at a random position.
function choicesFor(correct, pool, textOf, rnd, n = 4) {
  // wrong choices come from the same group when there are enough (a sentence among sentences, not among single words)
  const near = pool.filter((x) => x !== correct && correct.group && x.group === correct.group);
  const want = textOf(correct), seen = new Set([want]), wrong = [];
  for (const w of shuffle(near.length >= n - 1 && new Set(near.map(textOf)).size >= n - 1 ? near : pool, rnd)) { const t = textOf(w); if (!seen.has(t)) { seen.add(t); wrong.push(t); if (wrong.length === n - 1) break; } }
  return shuffle([want, ...wrong], rnd);
}

const base = (w, extra) => ({ card: w.card, why: w.example || null, ...extra });

export function pickQuestion(words, rnd = Math.random, dir = null) {
  const w = pick(words, rnd), d = dir || (rnd() < 0.5 ? "it-en" : "en-it");
  if (d === "it-en") return base(w, { kind: "topic-pick", prompt: withArticle(w), hint: "What does it mean?", choices: choicesFor(w, words, (x) => x.en, rnd), answers: [w.en], show: w.en, speak: withArticle(w) });
  return base(w, { kind: "topic-pick", prompt: w.en, hint: "Pick the Italian", choices: choicesFor(w, words, withArticle, rnd), answers: [withArticle(w), w.it], show: withArticle(w), speak: withArticle(w) });
}

export function typeQuestion(words, rnd = Math.random) {
  const w = pick(words, rnd);
  return base(w, { kind: "topic-type", prompt: w.en, hint: "Write it in Italian", answers: [withArticle(w), w.it, ...(w.accept || [])], show: withArticle(w), speak: withArticle(w) });
}

export function listenQuestion(words, rnd = Math.random) {
  const w = pick(words, rnd);
  return base(w, { kind: "topic-listen", prompt: "Listen, then pick the meaning.", choices: choicesFor(w, words, (x) => x.en, rnd), answers: [w.en], show: `${withArticle(w)} = ${w.en}`, speak: withArticle(w) });
}

export function swatchQuestion(words, rnd = Math.random) {
  const sw = words.filter((x) => x.swatch), w = pick(sw, rnd);
  return base(w, { kind: "topic-swatch", prompt: "Which colour is this?", swatch: w.swatch, choices: choicesFor(w, sw, (x) => x.it, rnd), answers: [w.it], show: w.it, speak: w.it });
}

export function genderQuestion(words, rnd = Math.random) {
  const fw = words.filter((x) => x.forms && GENDER_TARGETS.some((t) => x.forms[t] && x.forms[t] !== x.forms.m));
  const w = pick(fw, rnd), ts = GENDER_TARGETS.filter((t) => w.forms[t] && w.forms[t] !== w.forms.m), t = pick(ts, rnd);
  const given = withArticle({ ...w, it: w.forms.m });
  return base(w, { kind: "topic-gender", prompt: `${given}`, hint: `Give the ${FORM_ASK[t]} form (just the word)`, answers: [w.forms[t], ...((w.accept_forms && w.accept_forms[t]) || [])], show: w.forms[t], speak: w.forms[t] });
}

// Which question kinds a mode can produce for this topic's words.
function kindsFor(mode, drills, words) {
  const ok = { pick: drills.includes("pick"), type: drills.includes("type"), listen: drills.includes("listen") && voiceAvailable, swatch: drills.includes("swatch") && words.filter((x) => x.swatch).length >= 4,
    gender: drills.includes("gender") && words.filter((x) => x.forms).length >= 3 };
  if (mode === "mixed") return Object.keys(ok).filter((k) => ok[k]);
  return ok[mode] ? [mode] : [];
}

export function topicQuestion(module, mode = "mixed", rnd = Math.random) {
  const words = topicWords(module), kinds = kindsFor(mode, module.drills || [], words);
  if (!kinds.length) throw new Error(`No ${mode} questions for ${module.id}`);
  const k = pick(kinds, rnd);
  return { pick: pickQuestion, type: typeQuestion, listen: listenQuestion, swatch: swatchQuestion, gender: genderQuestion }[k](words, rnd);
}

// One drill per module that lists drills. id: topic-<module id>
export const topicDrillId = (moduleId) => `topic-${moduleId}`;
export function buildTopicDrills(content) {
  const defs = {};
  for (const id of content.order) {
    const m = content.modules[id];
    if (!m.drills || !m.drills.length) continue;
    const modes = ["mixed", ...m.drills];
    defs[topicDrillId(id)] = {
      title: m.title, group: "Vocabulary topics", topic: true, blurb: `${topicWords(m).length} words.`, options: modes, defaultOption: "mixed",
      optionNeedsVoice: ["listen"], needsVoice: false,
      make: (opt, rnd) => topicQuestion(m, opt, rnd),
    };
  }
  return defs;
}
