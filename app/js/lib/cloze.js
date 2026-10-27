// Fill-in-the-blank cards from your own logged sentences (the "sentence mining" idea: learn a word inside a real sentence).
// One content word is hidden; which one changes from day to day, so over time every word of the line is practised.
// Pure functions, unit-tested.
import { hashStr } from "./util.js";

// Small words that carry no meaning of their own: never hidden.
const SMALL = new Set(("il lo la le gli i un uno una un' di a da in con su per tra fra e ed o ma che non mi ti ci vi si ne è sono ho hai ha siamo siete hanno sei mio mia tuo tua suo sua quel questo questa quello cosa come dove quando perché anche più molto poco " +
  "del della dello dei degli delle al alla allo ai agli alle dal dalla dallo dai dagli dalle nel nella nello nei negli nelle sul sulla sullo sui sugli sulle col poi già ancora").split(" "));

const LETTERS = /\p{L}+/gu;

// A sentence is worth a blank when it has at least three words and at least one word that is not a small word.
export function makeCloze(text, seed = 0) {
  const s = String(text || "");
  const tokens = [...s.matchAll(LETTERS)].map((m) => ({ word: m[0], start: m.index, end: m.index + m[0].length }));
  if (tokens.length < 3) return null;
  const candidates = tokens.filter((t) => t.word.length >= 4 && !SMALL.has(t.word.toLowerCase()));
  if (!candidates.length) return null;
  const t = candidates[hashStr(String(seed)) % candidates.length];
  return { before: s.slice(0, t.start), answer: t.word, after: s.slice(t.end), candidates: candidates.length };
}

// settings.cloze: "off" | "sometimes" (about half the cards) | "always"
export function useCloze(mode, text, seed) {
  if (mode === "off") return null;
  if (mode !== "always" && hashStr(`${seed}:pick`) % 2 !== 0) return null;
  return makeCloze(text, seed);
}
