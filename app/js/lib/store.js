import { localDate, addDays } from "./util.js";
import { emptySync, markAllDirty, clearSent, hasDirty, PREF_KEYS } from "./rows.js";
const KEY = "italiano-ogni-giorno:v1";
const DEFAULTS = () => ({ v: 1, settings: { newPerDay: 10, direction: "en-it", theme: "auto", rate: 0.9, decks: null, translateProvider: "auto", translateEmail: "", translateDir: "auto", hand: "right", cloze: "sometimes" }, cards: {}, daily: {}, gaps: [], gapsDeleted: [], ratings: {}, drills: {}, sync: emptySync() });

// storage: anything with getItem/setItem (localStorage, or a stub in tests). Keeps working in memory if it throws.
export function createStore(storage) {
  let state;
  const listeners = new Set();
  const read = () => { try { const raw = storage && storage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const persist = () => { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } };
  // Every change is saved and announced (the cloud sync listens to schedule an upload).
  const write = () => { const ok = persist(); listeners.forEach((fn) => { try { fn(); } catch { /* a listener must never break saving */ } }); return ok; };
  const fill = (o) => {
    const s = Object.assign(DEFAULTS(), o || {}); s.settings = Object.assign(DEFAULTS().settings, s.settings);
    s.sync = { dirty: Object.assign(emptySync().dirty, s.sync && s.sync.dirty), cursors: (s.sync && s.sync.cursors) || {} };
    return s;
  };
  const saved = read();
  state = fill(saved);
  // Data from before row-level sync existed has no change marks: treat all of it as not yet uploaded.
  if (saved && !saved.sync) state = markAllDirty(state);
  // Remember that something changed and when, so the next sync uploads just that row.
  const touch = (kind, key) => { state.sync.dirty[kind][key] = new Date().toISOString(); };
  const day = (d) => (state.daily[d] ||= { blocks: {}, reviewed: 0, newSeen: 0, drills: 0, retells: 0 });
  const isActive = (d) => !!d && (Object.values(d.blocks || {}).some(Boolean) || d.reviewed >= 5 || d.drills > 0 || d.retells > 0);
  return {
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // Settings are per device and never synced, except the few study preferences that follow the learner.
    setting(k, v) { state.settings[k] = v; if (PREF_KEYS.includes(k)) { touch("prefs", "prefs"); write(); } else persist(); },
    card: (id) => state.cards[id],
    setCard(id, s) { state.cards[id] = s; touch("cards", id); write(); },
    day,
    markBlock(d, id, on) { day(d).blocks[id] = !!on; touch("daily", d); write(); },
    addReviewed(d, n, newN) { const x = day(d); x.reviewed += n; x.newSeen += newN; touch("daily", d); write(); },
    addRetell(d) { const x = day(d); x.retells = (x.retells || 0) + 1; touch("daily", d); write(); },
    addDrill(d, kind, correct, total) {
      day(d).drills += 1; const k = (state.drills[kind] ||= { sessions: 0, correct: 0, total: 0 });
      k.sessions += 1; k.correct += correct; k.total += total; touch("daily", d); touch("drills", kind); write();
    },
    // A day counts when any block is ticked, 5+ cards were reviewed, a drill was done or a story was retold.
    streak(today = localDate()) {
      let d = isActive(state.daily[today]) ? today : addDays(today, -1), n = 0;
      while (isActive(state.daily[d])) { n++; d = addDays(d, -1); }
      return n;
    },
    addGap(g) { const e = { id: "gap." + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), created: localDate(), updated: new Date().toISOString(), ...g }; state.gaps.unshift(e); touch("gaps", e.id); write(); return e; },
    updateGap(id, patch) { const g = state.gaps.find((x) => x.id === id); if (!g) return null; Object.assign(g, patch, { updated: new Date().toISOString() }); touch("gaps", id); write(); return g; },
    removeGap(id) { state.gaps = state.gaps.filter(g => g.id !== id); delete state.cards[id]; state.gapsDeleted = [...(state.gapsDeleted || []), id].slice(-500); delete state.sync.dirty.cards[id]; touch("gaps", id); write(); },
    // Sentences you wrote with a logged line: [{id, text, at, checked}]. "checked" means a local or a source confirmed it.
    addOwnSentence(gapId, text) {
      const g = state.gaps.find((x) => x.id === gapId); if (!g) return null;
      const e = { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, at: new Date().toISOString(), checked: false };
      this.updateGap(gapId, { mine: [...(g.mine || []), e].slice(-5) }); return e;
    },
    setOwnChecked(gapId, sid, checked) { const g = state.gaps.find((x) => x.id === gapId); if (g && g.mine) this.updateGap(gapId, { mine: g.mine.map((s) => (s.id === sid ? { ...s, checked: !!checked } : s)) }); },
    removeOwnSentence(gapId, sid) { const g = state.gaps.find((x) => x.id === gapId); if (g && g.mine) { const mine = g.mine.filter((s) => s.id !== sid); this.updateGap(gapId, { mine }); if (!mine.length) { delete g.mine; write(); } } },
    setRating(id, stars) { state.ratings[id] = { stars, last: localDate() }; touch("ratings", id); write(); },
    exportJSON() { const { sync, ...rest } = state; return JSON.stringify(rest, null, 1); },     // a backup holds your data, not this device's upload bookkeeping
    importJSON(text) {
      let o; try { o = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
      if (!o || o.v !== 1 || typeof o.cards !== "object" || typeof o.settings !== "object") return { ok: false, error: "That file is not an Italiano ogni giorno backup." };
      state = markAllDirty(fill({ ...o, sync: undefined })); state.settings = Object.assign(DEFAULTS().settings, o.settings); write(); return { ok: true };
    },
    // Used by the sync: swap in a merged copy but keep this device's own settings. Does not trigger an upload.
    replaceShared(next) { state = fill({ ...next, settings: next.settings || state.settings }); persist(); },
    // Row-level sync helpers
    markAllDirty() { state = markAllDirty(state); write(); },
    markSent(sent) { clearSent(state, sent); persist(); },
    setCursors(c) { state.sync.cursors = { ...state.sync.cursors, ...c }; persist(); },
    hasDirty: () => hasDirty(state),
    reset() { state = DEFAULTS(); write(); },
    persistent() { try { storage.setItem(KEY + ":t", "1"); storage.removeItem(KEY + ":t"); return true; } catch { return false; } },
  };
}
