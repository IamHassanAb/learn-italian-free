// "Write your own sentence": after you have met a logged line a couple of times, write a sentence of your own with it.
// Writing needs time and thought, so it is its own short session, not part of fast flashcard review. Pure functions, unit-tested.
import { norm } from "./util.js";

export const MIN_REPS = 2;          // a line is ready after you have reviewed it this many times
export const SESSION_SIZE = 5;      // a short session
export const MAX_LEN = 300;

// Lines ready for a sentence of your own: reviewed enough, and nothing written yet. Corrected lines first, then the most reviewed.
export function readyForOwn(gaps, states, limit = SESSION_SIZE) {
  return gaps
    .filter((g) => !(g.mine && g.mine.length) && ((states[g.id] || {}).reps || 0) >= MIN_REPS)
    .sort((a, b) => (b.kind === "corrected") - (a.kind === "corrected") || ((states[b.id] || {}).reps || 0) - ((states[a.id] || {}).reps || 0) || String(a.created).localeCompare(String(b.created)))
    .slice(0, limit);
}

// Tidy what was typed: one line, single spaces, not too long. null when there is nothing worth saving.
export function cleanSentence(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  return /\p{L}{2,}/u.test(t) && t.split(" ").length >= 2 ? t : null;
}

// Did the sentence use the line? A short line must appear as typed (accents and case forgiven); a long line needs one of its main words.
export function usesChunk(sentence, chunk) {
  const s = ` ${norm(sentence)} `, c = norm(chunk);
  if (!c) return true;
  const words = c.split(" ").filter(Boolean);
  if (words.length <= 3) return s.includes(` ${c} `) || words.every((w) => w.length < 4 || s.includes(w.replace(/'$/, "").slice(0, Math.max(4, w.length - 2))));
  return words.some((w) => w.length >= 5 && s.includes(w.slice(0, w.length - 1)));
}
