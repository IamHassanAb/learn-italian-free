import { localDate, addDays } from "./util.js";
const KEY = "italiano-ogni-giorno:v1";
const DEFAULTS = () => ({ v: 1, settings: { newPerDay: 10, direction: "en-it", theme: "auto", rate: 0.9, decks: null }, cards: {}, daily: {}, gaps: [], ratings: {}, drills: {} });

// storage: anything with getItem/setItem (localStorage, or a stub in tests). Keeps working in memory if it throws.
export function createStore(storage) {
  let state;
  const read = () => { try { const raw = storage && storage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const write = () => { try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } };
  state = Object.assign(DEFAULTS(), read() || {});
  state.settings = Object.assign(DEFAULTS().settings, state.settings);
  const day = (d) => (state.daily[d] ||= { blocks: {}, reviewed: 0, newSeen: 0, drills: 0 });
  const isActive = (d) => !!d && (Object.values(d.blocks || {}).some(Boolean) || d.reviewed >= 5 || d.drills > 0);
  return {
    get state() { return state; },
    setting(k, v) { state.settings[k] = v; write(); },
    card: (id) => state.cards[id],
    setCard(id, s) { state.cards[id] = s; write(); },
    day,
    markBlock(d, id, on) { day(d).blocks[id] = !!on; write(); },
    addReviewed(d, n, newN) { const x = day(d); x.reviewed += n; x.newSeen += newN; write(); },
    addDrill(d, kind, correct, total) {
      day(d).drills += 1; const k = (state.drills[kind] ||= { sessions: 0, correct: 0, total: 0 });
      k.sessions += 1; k.correct += correct; k.total += total; write();
    },
    // A day counts when any block is ticked, 5+ cards were reviewed, or a drill was done.
    streak(today = localDate()) {
      let d = isActive(state.daily[today]) ? today : addDays(today, -1), n = 0;
      while (isActive(state.daily[d])) { n++; d = addDays(d, -1); }
      return n;
    },
    addGap(g) { const e = { id: "gap." + Date.now().toString(36), created: localDate(), ...g }; state.gaps.unshift(e); write(); return e; },
    removeGap(id) { state.gaps = state.gaps.filter(g => g.id !== id); delete state.cards[id]; write(); },
    setRating(id, stars) { state.ratings[id] = { stars, last: localDate() }; write(); },
    exportJSON() { return JSON.stringify(state, null, 1); },
    importJSON(text) {
      let o; try { o = JSON.parse(text); } catch { return { ok: false, error: "That file is not valid JSON." }; }
      if (!o || o.v !== 1 || typeof o.cards !== "object" || typeof o.settings !== "object") return { ok: false, error: "That file is not an Italiano ogni giorno backup." };
      state = Object.assign(DEFAULTS(), o); state.settings = Object.assign(DEFAULTS().settings, o.settings); write(); return { ok: true };
    },
    reset() { state = DEFAULTS(); write(); },
    persistent() { try { storage.setItem(KEY + ":t", "1"); storage.removeItem(KEY + ":t"); return true; } catch { return false; } },
  };
}
