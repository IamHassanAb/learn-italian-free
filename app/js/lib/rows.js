// Turns the local study state into database rows and back, and merges pulled rows into local state.
// Pure functions (no network, no clock unless passed in), unit-tested. See DATABASE-PLAN.md.
//
// Local state is unchanged in shape. Next to it the store keeps state.sync = {dirty, cursors}:
//   dirty[kind][key] = ISO time of the last local change that has not been uploaded yet
// A row is uploaded only while it is dirty, so devices send changes, not the whole state.
//
// Rule that keeps merging independent of clocks: when this device pulls a row and its own copy wins, the row stays
// dirty with a time later than the pulled row, so the database (which ignores older edits) accepts the upload.

export const KINDS = ["prefs", "cards", "daily", "gaps", "ratings", "drills"];
export const TABLE = { prefs: "italiano_profiles", cards: "italiano_card_states", daily: "italiano_daily", gaps: "italiano_log_entries", ratings: "italiano_scenario_ratings", drills: "italiano_drill_stats" };
export const PREF_KEYS = ["newPerDay", "direction", "decks"];     // study preferences that follow the learner; everything else in settings stays on the device
const EPOCH = "1970-01-01T00:00:00.000Z";
const PREFS_KEY = "prefs";

export const emptySync = () => ({ dirty: { prefs: {}, cards: {}, daily: {}, gaps: {}, ratings: {}, drills: {} }, cursors: {} });
const clone = (x) => JSON.parse(JSON.stringify(x));
const later = (a, b) => (a >= b ? a : b);
const after = (iso) => new Date(Date.parse(iso) + 1).toISOString();        // one millisecond later than a pulled row
const dayStart = (d) => (d ? `${d}T00:00:00.000Z` : EPOCH);

// ---------------------------------------------------------------- state -> rows
export function rowFor(kind, key, state, at) {
  const cu = { client_updated_at: at };
  if (kind === "cards") { const c = state.cards[key]; return c && { card_id: key, box: c.box || 0, due: c.due, reps: c.reps || 0, lapses: c.lapses || 0, last_reviewed: c.last || null, ...cu }; }
  if (kind === "daily") {
    const d = state.daily[key]; if (!d) return null;
    return { day: key, blocks: Object.keys(d.blocks || {}).filter((b) => d.blocks[b]), reviewed: d.reviewed || 0, new_seen: d.newSeen || 0, drills: d.drills || 0, retells: d.retells || 0, ...cu };
  }
  if (kind === "gaps") {
    const g = state.gaps.find((x) => x.id === key);
    if (!g) {                                    // deleted here: send a marker, without the text
      return (state.gapsDeleted || []).includes(key) ? { id: key, italian: "-", english: "-", deleted_at: at, source: "manual", ...cu } : null;
    }
    return { id: g.id, italian: g.it, english: g.en, situation: g.ctx || null, kind: g.kind || null, note: g.note || null, grammar_tag: g.tag || null, source: g.src === "translate" ? "translate" : "manual", provider: g.provider || null, checked: !!g.checked, created_on: g.created, deleted_at: null, own_sentences: g.mine || [], ...cu };
  }
  if (kind === "ratings") { const r = state.ratings[key]; return r && { scenario_id: key, stars: r.stars, rated_on: r.last || null, ...cu }; }
  if (kind === "drills") { const d = state.drills[key]; return d && { kind: key, sessions: d.sessions || 0, correct: d.correct || 0, total: d.total || 0, ...cu }; }
  if (kind === "prefs") {
    const prefs = {}; for (const k of PREF_KEYS) if (state.settings[k] !== undefined) prefs[k] = state.settings[k];
    return { prefs, ...cu };
  }
  return null;
}

// Rows to upload: {table: [row, ...]} for everything marked dirty, plus the snapshot of what was sent (to clear afterwards).
export function collectDirty(state) {
  const rows = {}, sent = {};
  for (const kind of KINDS) {
    const list = [];
    for (const [key, at] of Object.entries(state.sync.dirty[kind] || {})) {
      const row = rowFor(kind, kind === "prefs" ? PREFS_KEY : key, state, at);
      if (row) { list.push(row); (sent[kind] ||= {})[key] = at; }
    }
    if (list.length) rows[TABLE[kind]] = list;
  }
  return { rows, sent };
}

// ---------------------------------------------------------------- rows -> state
// Compare ignoring key order, so two equal records are never mistaken for different ones.
const canon = (x) => (Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// The database returns times like 2026-10-19T10:00:00+00:00; the app uses ISO strings with milliseconds and Z. Make them comparable.
const iso = (t) => new Date(t).toISOString();
const normalise = (remote) => Object.fromEntries(Object.entries(remote).map(([k, rows]) => [k, (rows || []).map((r) => ({ ...r, client_updated_at: iso(r.client_updated_at), ...(r.deleted_at ? { deleted_at: iso(r.deleted_at) } : {}) }))]));

const fromRow = {
  cards: (r) => ({ box: r.box, due: r.due, reps: r.reps, lapses: r.lapses, last: r.last_reviewed || undefined }),
  daily: (r) => ({ blocks: Object.fromEntries((r.blocks || []).map((b) => [b, true])), reviewed: r.reviewed, newSeen: r.new_seen, drills: r.drills, retells: r.retells }),
  ratings: (r) => ({ stars: r.stars, last: r.rated_on || undefined }),
  drills: (r) => ({ sessions: r.sessions, correct: r.correct, total: r.total }),
  gaps: (r) => {
    const g = { id: r.id, it: r.italian, en: r.english, created: r.created_on, updated: r.client_updated_at, src: r.source, checked: !!r.checked };
    if (Array.isArray(r.own_sentences) && r.own_sentences.length) g.mine = r.own_sentences;
    if (r.situation) g.ctx = r.situation; if (r.kind) g.kind = r.kind; if (r.note) g.note = r.note; if (r.grammar_tag) g.tag = r.grammar_tag; if (r.provider) g.provider = r.provider;
    return g;
  },
};
const tidy = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };

// Same rule the app always used: the more recently reviewed card wins; on the same day, the one reviewed more times.
const newerCard = (a, b) => {
  const la = a.last || "", lb = b.last || "";
  if (la !== lb) return la > lb ? a : b;
  return (b.reps || 0) > (a.reps || 0) ? b : a;
};

// remote: {kind: [row, ...]} as pulled. Returns {state, changed} where changed says whether anything local was altered.
export function applyRows(state0, pulled) {
  const remote = normalise(pulled), state = clone(state0); state.sync ||= emptySync();
  const dirty = state.sync.dirty; let changed = false;
  const keep = (kind, key, remoteAt) => { dirty[kind][key] = later(dirty[kind][key] || EPOCH, after(remoteAt)); };   // local copy wins: upload it later than what we saw
  const take = (kind, key) => { delete dirty[kind][key]; };

  for (const r of remote.cards || []) {
    const mine = state.cards[r.card_id], theirs = tidy(fromRow.cards(r));
    if (!mine) { state.cards[r.card_id] = theirs; changed = true; take("cards", r.card_id); continue; }
    const win = newerCard(mine, theirs);
    if (win === theirs && !same(mine, theirs)) { state.cards[r.card_id] = theirs; changed = true; take("cards", r.card_id); }
    else if (!same(mine, theirs)) keep("cards", r.card_id, r.client_updated_at);
    else take("cards", r.card_id);
  }

  for (const r of remote.daily || []) {
    const a = state.daily[r.day] || { blocks: {}, reviewed: 0, newSeen: 0, drills: 0, retells: 0 }, b = fromRow.daily(r);
    const blocks = { ...a.blocks }; for (const [k, v] of Object.entries(b.blocks)) blocks[k] = !!(blocks[k] || v);
    const m = { blocks, reviewed: Math.max(a.reviewed || 0, b.reviewed), newSeen: Math.max(a.newSeen || 0, b.newSeen), drills: Math.max(a.drills || 0, b.drills), retells: Math.max(a.retells || 0, b.retells) };
    if (!same(m, a)) { state.daily[r.day] = m; changed = true; }
    if (same(m, b)) take("daily", r.day); else keep("daily", r.day, r.client_updated_at);
  }

  for (const r of remote.ratings || []) {
    const mine = state.ratings[r.scenario_id], theirs = tidy(fromRow.ratings(r));
    const localWins = mine && (dirty.ratings[r.scenario_id] ? (mine.last || "") >= (theirs.last || "") : false);
    if (!mine || !localWins) { if (!same(mine, theirs)) { state.ratings[r.scenario_id] = theirs; changed = true; } take("ratings", r.scenario_id); }
    else if (!same(mine, theirs)) keep("ratings", r.scenario_id, r.client_updated_at); else take("ratings", r.scenario_id);
  }

  for (const r of remote.drills || []) {
    const a = state.drills[r.kind], b = fromRow.drills(r);
    const m = !a ? b : { sessions: Math.max(a.sessions, b.sessions), correct: Math.max(a.correct, b.correct), total: Math.max(a.total, b.total) };
    if (!same(m, a)) { state.drills[r.kind] = m; changed = true; }
    if (same(m, b)) take("drills", r.kind); else keep("drills", r.kind, r.client_updated_at);
  }

  const deleted = new Set(state.gapsDeleted || []);
  for (const r of remote.gaps || []) {
    const i = state.gaps.findIndex((g) => g.id === r.id), mine = i >= 0 ? state.gaps[i] : null;
    const localAt = dirty.gaps[r.id] || (mine && mine.updated) || EPOCH;
    const remoteWins = r.client_updated_at > localAt || (!dirty.gaps[r.id] && r.client_updated_at >= localAt);
    if (r.deleted_at) {                                            // deleted elsewhere
      if (mine && remoteWins) { state.gaps.splice(i, 1); delete state.cards[r.id]; delete dirty.cards[r.id]; changed = true; }
      if (!mine || remoteWins) { deleted.add(r.id); take("gaps", r.id); }
      else keep("gaps", r.id, r.client_updated_at);                // edited here after it was deleted: keep it and upload it again
    } else if (deleted.has(r.id) && !mine) {                       // deleted here: whichever came later wins
      if (r.client_updated_at > (dirty.gaps[r.id] || EPOCH)) { deleted.delete(r.id); state.gaps.unshift(tidy(fromRow.gaps(r))); take("gaps", r.id); changed = true; }
      else keep("gaps", r.id, r.client_updated_at);
    } else if (!mine) { state.gaps.push(tidy(fromRow.gaps(r))); take("gaps", r.id); changed = true; }
    else if (remoteWins) { const g = tidy(fromRow.gaps(r)); if (!same(g, mine)) { state.gaps[i] = g; changed = true; } take("gaps", r.id); }
    else keep("gaps", r.id, r.client_updated_at);
  }
  state.gaps.sort((x, y) => (y.created || "").localeCompare(x.created || "") || y.id.localeCompare(x.id));
  state.gapsDeleted = [...deleted].slice(-500);

  for (const r of remote.prefs || []) {
    const p = r.prefs || {}, at = dirty.prefs[PREFS_KEY];
    if (at && at > r.client_updated_at) { keep("prefs", PREFS_KEY, r.client_updated_at); continue; }
    for (const k of PREF_KEYS) if (p[k] !== undefined && !same(state.settings[k], p[k])) { state.settings[k] = p[k]; changed = true; }
    take("prefs", PREFS_KEY);
  }
  return { state, changed };
}

// Mark everything this device has as needing upload, using each item's own best-known time so that newer cloud copies still win.
// Used on the first sync of a device that already has data, and when moving to a different project.
export function markAllDirty(state) {
  const s = clone(state); s.sync ||= emptySync(); const d = s.sync.dirty;
  for (const [id, c] of Object.entries(s.cards)) d.cards[id] = dayStart(c.last);
  for (const day of Object.keys(s.daily)) d.daily[day] = dayStart(day);
  for (const g of s.gaps) d.gaps[g.id] = g.updated || dayStart(g.created);
  for (const [id, r] of Object.entries(s.ratings)) d.ratings[id] = dayStart(r.last);
  for (const k of Object.keys(s.drills)) d.drills[k] = EPOCH;
  d.prefs[PREFS_KEY] = EPOCH;
  s.sync.cursors = {};
  return s;
}

// Remove from dirty only what was actually uploaded (anything changed again while uploading stays dirty).
export function clearSent(state, sent) {
  for (const [kind, keys] of Object.entries(sent)) for (const [key, at] of Object.entries(keys)) if (state.sync.dirty[kind][key] === at) delete state.sync.dirty[kind][key];
}

export const hasDirty = (state) => !!state.sync && KINDS.some((k) => Object.keys(state.sync.dirty[k] || {}).length);
