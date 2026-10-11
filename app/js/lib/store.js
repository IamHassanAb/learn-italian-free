import { localDate, addDays } from "./util.js";
const KEY = "italiano-ogni-giorno:v1";
const DEFAULTS = () => ({ v: 1, settings: { newPerDay: 10, direction: "en-it", theme: "auto", rate: 0.9, decks: null }, cards: {}, daily: {}, gaps: [], gapsDeleted: [], ratings: {}, drills: {} });

// storage: anything with getItem/setItem (localStorage, or a stub in tests). Keeps working in memory if it throws.
export function createStore(storage) {
  let state;
  const listeners = new Set();
  const read = () => { try { const raw = storage && storage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const persist = () => { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } };
  // Every change is saved and announced (the cloud sync listens to schedule an upload).
  const write = () => { const ok = persist(); listeners.forEach((fn) => { try { fn(); } catch { /* a listener must never break saving */ } }); return ok; };
  const fill = (o) => { const s = Object.assign(DEFAULTS(), o || {}); s.settings = Object.assign(DEFAULTS().settings, s.settings); return s; };
  state = fill(read());
  const day = (d) => (state.daily[d] ||= { blocks: {}, reviewed: 0, newSeen: 0, drills: 0, retells: 0 });
  const isActive = (d) => !!d && (Object.values(d.blocks || {}).some(Boolean) || d.reviewed >= 5 || d.drills > 0 || d.retells > 0);
  return {
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setting(k, v) { state.settings[k] = v; persist(); },          // settings are per device: never synced
    card: (id) => state.cards[id],
    setCard(id, s) { state.cards[id] = s; write(); },
    day,
    markBlock(d, id, on) { day(d).blocks[id] = !!on; write(); },
    addReviewed(d, n, newN) { const x = day(d); x.reviewed += n; x.newSeen += newN; write(); },
    addRetell(d) { const x = day(d); x.retells = (x.retells || 0) + 1; write(); },
    addDrill(d, kind, correct, total) {
      day(d).drills += 1; const k = (state.drills[kind] ||= { sessions: 0, correct: 0, total: 0 });
      k.sessions += 1; k.correct += correct; k.total += total; write();
    },
    // A day counts when any block is ticked, 5+ cards were reviewed, a drill was done or a story was retold.
    streak(today = localDate()) {
      let d = isActive(state.daily[today]) ? today : addDays(today, -1), n = 0;
      while (isActive(state.daily[d])) { n++; d = addDays(d, -1); }
      return n;
    },
    addGap(g) { const e = { id: "gap." + Date.now().toString(36), created: localDate(), ...g }; state.gaps.unshift(e); write(); return e; },
    removeGap(id) { state.gaps = state.gaps.filter(g => g.id !== id); delete state.cards[id]; state.gapsDeleted = [...(state.gapsDeleted || []), id].slice(-500); write(); },
    setRating(id, stars) { state.ratings[id] = { stars, last: localDate() }; write(); },
    exportJSON() { return JSON.stringify(state, null, 1); },
    importJSON(text) {
      let o; try { o = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
      if (!o || o.v !== 1 || typeof o.cards !== "object" || typeof o.settings !== "object") return { ok: false, error: "That file is not an Italiano ogni giorno backup." };
      state = fill(o); write(); return { ok: true };
    },
    // Used by the sync: swap in a merged copy but keep this device's own settings. Does not trigger an upload.
    replaceShared(next) { state = fill({ ...next, settings: state.settings }); persist(); },
    reset() { state = DEFAULTS(); write(); },
    persistent() { try { storage.setItem(KEY + ":t", "1"); storage.removeItem(KEY + ":t"); return true; } catch { return false; } },
  };
}
