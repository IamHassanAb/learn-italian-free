import { numberToItalian as w } from "./numbers.js";
// Spoken time. everyday: 12-hour style with quarto/mezza/meno. official: 24-hour (timetables), no quarto/mezza.
function hourPhrase(h) { const h12 = h % 12 || 12; return h12 === 1 ? "È l'una" : `Sono le ${w(h12)}`; }
export function everyday(h, m) {
  if (m === 0) return h === 0 ? "È mezzanotte" : h === 12 ? "È mezzogiorno" : hourPhrase(h);
  if (h === 0 || h === 12) return null;
  if (m <= 30) return `${hourPhrase(h)} ${m === 15 ? "e un quarto" : m === 30 ? "e mezza" : "e " + w(m)}`;
  const next = (h + 1) % 24;
  if (next === 0 || next === 12) return null;
  return `${hourPhrase(next)} ${m === 45 ? "meno un quarto" : "meno " + w(60 - m)}`;
}
export function official(h, m) {
  if (m === 0 && h === 0) return "È mezzanotte";
  if (m === 0 && h === 12) return "È mezzogiorno";
  if (h === 0) return null;
  const base = h === 1 ? "È l'una" : `Sono le ${w(h)}`;
  return m === 0 ? base : `${base} e ${w(m)}`;
}
export function acceptable(h, m) {
  const set = new Set();
  for (const s of [everyday(h, m), official(h, m)]) if (s) { set.add(s); set.add(s.replace(/ e mezza$/, " e mezzo")); }
  return [...set];
}
export const digital = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
