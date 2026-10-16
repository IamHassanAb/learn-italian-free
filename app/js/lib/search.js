// Quick search across phrases, vocabulary, grammar lookups and your conversation log. Accent- and case-insensitive.
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

export function buildIndex(cards, content, gaps = []) {
  const rows = cards.map((c) => ({ kind: "card", id: c.id, title: c.deckTitle, it: c.it, en: c.en, hay: norm(`${c.it} ${c.en} ${c.example || ""}`), tag: c.deck === "gaps" ? "your log" : c.deckTitle }));
  const g = content.modules["step3-grammar"];
  if (g) for (const p of g.parts) if (p.type === "lookup-row") rows.push({ kind: "grammar", id: p.id, title: g.title, it: null, en: p.when, answer: p.answer, hay: norm(`${p.when} ${p.answer}`), tag: "grammar" });
  return rows;
}

// Every word typed must appear (as a prefix of a word counts). Phrases that start with the query rank first.
export function search(index, query, limit = 40) {
  const q = norm(query); if (q.length < 2) return [];
  const words = q.split(" ");
  const scored = [];
  for (const r of index) {
    let score = 0;
    for (const w of words) {
      const i = r.hay.indexOf(w); if (i < 0) { score = -1; break; }
      score += i === 0 || r.hay[i - 1] === " " ? 2 : 1;
    }
    if (score < 0) continue;
    if (norm(r.it || "").startsWith(q) || norm(r.en || "").startsWith(q)) score += 3;
    scored.push([score, r]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}
