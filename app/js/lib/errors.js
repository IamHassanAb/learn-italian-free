// Repeated mistakes: group the conversation log by grammar topic, so you can see which rule keeps tripping you.
// A logged line counts as a mistake when you tagged it with a grammar topic or marked it "a local corrected me".
// Pure functions, unit-tested.
export const FLAG_AT = 3;                 // a topic with this many entries or more "keeps coming up"
export const NO_TOPIC = "none";           // corrections that have no grammar topic yet

export const isMistake = (g) => !!g.tag || g.kind === "corrected";

// topics: the grammar lookup rows [{id, when, answer}]. Returns [{tag, title, answer, count, last, flagged, entries}], most entries first.
export function errorTopics(gaps, topics = []) {
  const byTag = new Map();
  for (const g of gaps) {
    if (!isMistake(g)) continue;
    const key = g.tag && topics.some((t) => t.id === g.tag) ? g.tag : NO_TOPIC;
    (byTag.get(key) || byTag.set(key, []).get(key)).push(g);
  }
  const out = [];
  for (const [tag, entries] of byTag) {
    const t = topics.find((x) => x.id === tag);
    entries.sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")) || String(b.id).localeCompare(String(a.id)));
    out.push({ tag, title: t ? t.when : "Corrected, no grammar topic yet", answer: t ? t.answer : null, count: entries.length, last: entries[0].created || "", flagged: tag !== NO_TOPIC && entries.length >= FLAG_AT, entries });
  }
  return out.sort((a, b) => b.count - a.count || b.last.localeCompare(a.last) || a.title.localeCompare(b.title));
}
