// Pure helpers (no DOM) so they can be unit-tested with node.
export function norm(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[’‘`´]/g, "'")
    .replace(/[.,;:!?¿¡"“”()]/g, " ").replace(/\s+/g, " ").trim();
}
export function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return localDate(d); }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
export function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }
// Text to read aloud: drop markup, turn separators into pauses.
export function speakable(s) {
  return String(s).replace(/\[\[res:[^|\]]+\|([^\]]*)\]\]/g, "$1").replace(/\*+/g, "")
    .replace(/\s+[\/·]\s+/g, ", ").replace(/…/g, "").replace(/\s+/g, " ").trim();
}
