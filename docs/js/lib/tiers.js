// Scenario tiers: how much you have to handle on your own. Each scenario module has a tier; the list is shown in tier order
// and the app suggests what to practise next.
export const TIERS = {
  1: { name: "Follow the script", tip: "Read it aloud, then say your side from memory (use Hide mine)." },
  2: { name: "Handle surprises", tip: "Use the dialogue as a backbone, and change one detail each time: the price, the time, a name." },
  3: { name: "Improvise", tip: "Hide their lines and play it from the goal alone. Use Your turn for the details to ask about." },
  4: { name: "Open conversation", tip: "No script: have the conversation, and give your opinion." },
};
export const tierOf = (m) => (TIERS[m && m.tier] ? m.tier : 1);

// ids in course order, stably sorted by tier
export function byTier(ids, modules) {
  return ids.map((id, i) => [id, i]).sort((a, b) => tierOf(modules[a[0]]) - tierOf(modules[b[0]]) || a[1] - b[1]).map((x) => x[0]);
}

// ratings: {id: {stars 1 Rough, 2 OK, 3 Smooth}}. Suggest the first scenario (in tier order) you have not tried yet.
// If you have tried all of them, suggest the first one that went roughly. If everything is OK or Smooth, suggest nothing.
export function suggestNext(ids, modules, ratings = {}) {
  const ordered = byTier(ids, modules);
  const fresh = ordered.find((id) => !ratings[id]);
  if (fresh) return { id: fresh, why: "not tried yet" };
  const rough = ordered.find((id) => ratings[id].stars === 1);
  return rough ? { id: rough, why: "it went roughly last time" } : null;
}
