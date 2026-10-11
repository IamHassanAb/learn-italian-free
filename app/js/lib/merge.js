// Merge two copies of the study state (this device and the cloud copy) without losing either side's work.
// Pure functions, unit-tested. Device settings are never merged: they stay local.
const newer = (a, b) => {
  if (!a) return b; if (!b) return a;
  const la = a.last || "", lb = b.last || "";
  if (la !== lb) return la > lb ? a : b;
  return (b.reps || 0) > (a.reps || 0) ? b : a;
};

export function mergeStates(local, remote) {
  if (!remote) return local;
  const out = { ...local };

  out.cards = { ...(local.cards || {}) };
  for (const [id, st] of Object.entries(remote.cards || {})) out.cards[id] = newer(out.cards[id], st);

  out.daily = {};
  const dates = new Set([...Object.keys(local.daily || {}), ...Object.keys(remote.daily || {})]);
  for (const d of dates) {
    const a = (local.daily || {})[d] || {}, b = (remote.daily || {})[d] || {};
    const blocks = { ...(a.blocks || {}) };
    for (const [k, v] of Object.entries(b.blocks || {})) blocks[k] = !!(blocks[k] || v);
    out.daily[d] = {
      blocks, reviewed: Math.max(a.reviewed || 0, b.reviewed || 0), newSeen: Math.max(a.newSeen || 0, b.newSeen || 0),
      drills: Math.max(a.drills || 0, b.drills || 0), retells: Math.max(a.retells || 0, b.retells || 0),
    };
  }

  const deleted = new Set([...(local.gapsDeleted || []), ...(remote.gapsDeleted || [])]);
  const byId = new Map();
  for (const g of [...(remote.gaps || []), ...(local.gaps || [])]) if (!deleted.has(g.id)) byId.set(g.id, g);
  out.gaps = [...byId.values()].sort((x, y) => (y.created || "").localeCompare(x.created || "") || y.id.localeCompare(x.id));
  out.gapsDeleted = [...deleted].slice(-500);
  for (const id of deleted) delete out.cards[id];

  out.ratings = { ...(local.ratings || {}) };
  for (const [id, r] of Object.entries(remote.ratings || {})) {
    const mine = out.ratings[id];
    if (!mine || (r.last || "") > (mine.last || "")) out.ratings[id] = r;
  }

  out.drills = { ...(local.drills || {}) };
  for (const [k, v] of Object.entries(remote.drills || {})) if (!out.drills[k] || v.sessions > out.drills[k].sessions) out.drills[k] = v;
  return out;
}

// What goes to the cloud: everything except this device's settings.
export function shareable(state) { const { settings, ...rest } = state; return rest; }
