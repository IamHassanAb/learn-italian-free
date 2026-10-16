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

const TABS = [["today", "Today"], ["review", "Review"], ["drills", "Drills"], ["scenarios", "Role-play"], ["more", "More"]];
const ROUTES = { today: todayView, review: reviewView, drills: drillsView, scenarios: scenariosView, library: libraryView, gaps: gapsView, settings: settingsView, retell: retellView, setup: setupView, more: moreView };
const TAB_OF = { library: "more", gaps: "more", settings: "more", setup: "more", retell: "today" };

let storage = null;
try { storage = window.localStorage; } catch { /* blocked: the store falls back to memory */ }
const store = createStore(storage);
const speech = createSpeech(window);
const app = document.getElementById("app");
let current = null, ctx = null;

function applyTheme() {
  const t = store.state.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

function moreView(c) {
  return h("div", { class: "stack" }, h("div", null, h("p", { class: "eyebrow" }, "More"), h("h1", null, "More")),
    h("div", { class: "grid" },
      h("a", { class: "card block", href: "#/library", style: "text-decoration:none;color:inherit" }, h("h2", null, "Library"), h("p", { class: "muted small" }, "Cognates, grammar lookup, basics and the printable PDFs.")),
      h("a", { class: "card block", href: "#/gaps", style: "text-decoration:none;color:inherit" }, h("h2", null, "Gaps log"), h("p", { class: "muted small" }, "Words and mistakes you hit. They become flashcards.")),
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
    content, store, speech, sync, syncConfig: syncInfo.config, syncSource: syncInfo.source, storage, resources: content.resources, cards, decks, applyTheme,
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
  nav.replaceChildren(...TABS.map(([id, label]) => h("a", { href: `#/${id}`, "aria-current": id === active ? "page" : null }, label)));
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
