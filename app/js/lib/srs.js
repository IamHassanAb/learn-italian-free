import { addDays } from "./util.js";
// Simple Leitner boxes. A card's state is {box, due, reps, lapses, last}; a card with no state is new.
export const LADDER = [0, 1, 3, 7, 14, 30, 60, 120];
export function rate(state, grade, today) {
  const s = { box: 0, due: today, reps: 0, lapses: 0, ...(state || {}) };
  s.reps += 1; s.last = today;
  if (grade === "again") { s.box = 0; s.lapses += 1; s.due = today; }
  else { s.box = Math.min(s.box + (grade === "easy" ? 2 : 1), LADDER.length - 1); s.due = addDays(today, LADDER[s.box]); }
  return s;
}
export function previewDays(state, grade) {
  if (grade === "again") return 0;
  const b = Math.min((state ? state.box : 0) + (grade === "easy" ? 2 : 1), LADDER.length - 1);
  return LADDER[b];
}
export const isDue = (state, today) => !!state && state.due <= today;
// cards: [{id, deck}], states: {id: state}. Due cards first (oldest due first), then new cards up to newLimit.
export function buildQueue(cards, states, today, { newLimit = 10, newSeenToday = 0, decks = null } = {}) {
  const pool = decks ? cards.filter(c => decks.has(c.deck)) : cards;
  const due = pool.filter(c => isDue(states[c.id], today)).sort((a, b) => states[a.id].due.localeCompare(states[b.id].due) || states[a.id].box - states[b.id].box);
  const fresh = pool.filter(c => !states[c.id]).slice(0, Math.max(0, newLimit - newSeenToday));
  return { due, fresh, queue: [...due, ...fresh] };
}
