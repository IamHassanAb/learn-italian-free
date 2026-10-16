import { createStore } from "./lib/store.js";
import { createSpeech } from "./lib/speech.js";
import { createSync } from "./lib/sync.js";
import { loadDeviceConfig } from "./lib/syncconfig.js";
import { longDate } from "./lib/calendar.js";
import { h, toast } from "./ui.js";
import { todayView } from "./views/today.js";
import { reviewView } from "./views/review.js";
import { drillsView } from "./views/drills.js";
import { scenariosView } from "./views/scenarios.js";
import { libraryView } from "./views/library.js";
import { gapsView } from "./views/gaps.js";
import { settingsView } from "./views/settings.js";
import { retellView } from "./views/retell.js";
import { setupView } from "./views/setup.js";
import { searchView } from "./views/search.js";
import { translateView } from "./views/translate.js";
import { createTranslator } from "./lib/translate.js";

const TABS = [["today", "Today"], ["review", "Review"], ["translate", "Translate"], ["scenarios", "Role-play"], ["more", "More"]];
const ROUTES = { today: todayView, review: reviewView, drills: drillsView, scenarios: scenariosView, library: libraryView, gaps: gapsView, settings: settingsView, retell: retellView, setup: setupView, translate: translateView, search: searchView, more: moreView };
// Small line icons (24x24 paths) so each tab is recognisable at a glance.
const ICONS = {
  today: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  review: "M4 7h13a2 2 0 012 2v9a2 2 0 01-2 2H4zM7 4h13a2 2 0 012 2v9",
  translate: "M3 5h8M7 3v2M5 9c1 3 3 5 6 6M10 5c-1 5-3 8-7 10M13 21l4-10 4 10M14.5 18h5",
  scenarios: "M4 5h16a1 1 0 011 1v9a1 1 0 01-1 1H10l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const TAB_OF = { library: "more", gaps: "more", settings: "more", setup: "more", search: "more", drills: "more", retell: "today" };

let storage = null;
try { storage = window.localStorage; } catch { /* blocked: the store falls back to memory */ }
const store = createStore(storage);
const speech = createSpeech(window);
const app = document.getElementById("app");
let current = null, ctx = null;

function applyTheme() {
  const t = store.state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  document.body.dataset.hand = store.state.settings.hand || "right";
}

function moreView(c) {
  return h("div", { class: "stack" }, h("div", null, h("p", { class: "eyebrow" }, "More"), h("h1", null, "More")),
    h("div", { class: "grid" },
      h("a", { class: "card block", href: "#/search", style: "text-decoration:none;color:inherit" }, h("h2", null, "Quick search"), h("p", { class: "muted small" }, "Find any phrase, word or grammar row, in English or Italian.")),
      h("a", { class: "card block", href: "#/library", style: "text-decoration:none;color:inherit" }, h("h2", null, "Library"), h("p", { class: "muted small" }, "Cognates, grammar lookup, basics and the printable PDFs.")),
      h("a", { class: "card block", href: "#/drills", style: "text-decoration:none;color:inherit" }, h("h2", null, "Drills"), h("p", { class: "muted small" }, "Numbers, time, days, months and dates. Ten questions each.")),
      h("a", { class: "card block", href: "#/gaps", style: "text-decoration:none;color:inherit" }, h("h2", null, "Conversation log"), h("p", { class: "muted small" }, "Lines from real conversations, with corrections. They become flashcards.")),
      h("a", { class: "card block", href: "#/settings", style: "text-decoration:none;color:inherit" }, h("h2", null, "Settings"), h("p", { class: "muted small" }, "New cards, voice, theme, backup."))));
}

function buildCtx(content, sync, syncInfo) {
  const cardCache = { content };
  const buildCards = () => {
    const list = [];
    for (const id of content.order) {
      const m = content.modules[id];
      for (const p of m.parts) if (p.type === "vocab" || p.type === "phrases")
        for (const it of p.items) list.push({ id: `${p.id}.${it.id}`, deck: id, deckTitle: m.title, it: it.it, en: it.en, example: it.example });
    }
    return list;
  };
  const base = buildCards();
  const cards = () => base.concat(store.state.gaps.map(g => ({ id: g.id, deck: "gaps", deckTitle: "Your gaps", it: g.it, en: g.en })));
  const decks = () => {
    const map = new Map();
    for (const c of cards()) { const d = map.get(c.deck) || { id: c.deck, title: c.deckTitle, count: 0 }; d.count++; map.set(c.deck, d); }
    return [...map.values()];
  };
  const hour = () => new Date().getHours();
  return {
    content, store, speech, sync, translator: createTranslator({ win: window, storage, getSettings: () => store.state.settings }), syncConfig: syncInfo.config, syncSource: syncInfo.source, storage, resources: content.resources, cards, decks, applyTheme,
    greeting: () => (hour() < 5 ? "Buonanotte" : hour() < 17 ? "Buongiorno" : "Buonasera"),
    refresh: () => render(),
  };
}

function parseHash() {
  const [name, ...params] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: ROUTES[name] ? name : "today", params };
}

function renderTabs(active) {
  const nav = document.getElementById("tabs");
  nav.replaceChildren(...TABS.map(([id, label]) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", ICONS[id]); svg.append(path);
    return h("a", { href: `#/${id}`, "aria-current": id === active ? "page" : null }, svg, label);
  }));
}

function render() {
  if (!ctx) return;
  const { name, params } = parseHash();
  if (current && current.cleanup) current.cleanup();
  document.onkeydown = null;
  document.querySelector(".toast")?.remove();
  speech.stop && speech.stop();
  try { current = ROUTES[name](ctx, params); }
  catch (err) { console.error(err); current = h("div", { class: "stack" }, h("h1", null, "Something went wrong"), h("p", { class: "muted" }, String(err.message || err)), h("a", { class: "btn", href: "#/today" }, "Back to Today")); }
  app.replaceChildren(current);
  renderTabs(TAB_OF[name] || name);
  const first = app.querySelector("h1"); document.title = first ? `${first.textContent} · Italiano ogni giorno` : "Italiano ogni giorno";
}

// Keep this device and the cloud copy in step: on start, when the connection returns, and when the app comes back to the front.
let lastAuto = 0;
function startSync() {
  const sync = ctx.sync;
  if (!sync.enabled) return;
  const auto = () => { if (sync.info().signedIn && Date.now() - lastAuto > 30000) { lastAuto = Date.now(); sync.syncNow(); } };
  auto();
  window.addEventListener("online", () => { lastAuto = 0; auto(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") auto(); });
}

// Hide the bottom tab bar while a text field has focus, so the on-screen keyboard never covers what you are typing.
const TEXTY = "textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file])";
document.addEventListener("focusin", (e) => { if (e.target.matches && e.target.matches(TEXTY)) document.body.classList.add("typing"); });
document.addEventListener("focusout", () => { setTimeout(() => { if (!document.activeElement || !document.activeElement.matches(TEXTY)) document.body.classList.remove("typing"); }, 50); });

async function boot() {
  applyTheme();
  document.getElementById("today-date").textContent = longDate(new Date());
  try {
    const res = await fetch("data/content.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const content = await res.json();
    let config = {};
    try { const r = await fetch("config.json", { cache: "no-cache" }); if (r.ok) config = await r.json(); } catch { /* no sync config: the app works without it */ }
    // The connection lives in THIS device's storage (set in Settings or from a setup link), so no key is ever in the repo or the website.
    // A baked-in config.json is still honoured for people who host their own copy.
    const device = loadDeviceConfig(storage);
    const active = device || { supabaseUrl: config.supabaseUrl || "", supabaseKey: config.supabaseKey || "" };
    const source = device ? "device" : (active.supabaseUrl && active.supabaseKey ? "file" : "none");
    ctx = buildCtx(content, createSync({ config: active, store, storage }), { config: active, source });
  } catch (err) {
    app.replaceChildren(h("div", { class: "stack" }, h("h1", null, "Could not load the lessons"), h("p", { class: "muted" }, "Check your connection and reload. If you opened index.html directly from disk, serve the folder over http instead (for example: python -m http.server)."), h("p", { class: "muted small" }, String(err.message || err))));
    return;
  }
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  render();
  startSync();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
boot();
