import { h, mount, inline, speakBtn } from "../ui.js";
import { buildCourseIndex, logRows, search, hasFilters, SOURCES, KINDS, LOG_KIND, LOG_STATUS } from "../lib/search.js";

const SITUATIONS = ["café", "shop", "home", "university", "transport", "health", "friends", "other"];
const PAGE = 30;
const LK = Object.fromEntries(LOG_KIND);
let courseIndex = null, courseFor = null;       // built once per app session

// Search everything, and narrow it by where it comes from, word or phrase, topic, and (for your log) situation, kind and status.
// Chips in one group are alternatives (any of them); different groups all have to match.
export function searchView(ctx, params) {
  const root = h("div", { class: "stack" });
  if (courseFor !== ctx.content) { courseIndex = buildCourseIndex(ctx.content); courseFor = ctx.content; }
  const index = courseIndex.concat(logRows(ctx.store.state.gaps));
  const f = { src: new Set(), kind: new Set(), deck: new Set(), sit: new Set(), logKind: new Set(), status: new Set() };
  const decks = new Map(); for (const r of courseIndex) if (r.kind !== "grammar") decks.set(r.deck, r.topic);
  let shown = PAGE, timer = null;

  const input = h("input", { type: "search", id: "q", placeholder: "Search phrases, words, grammar, your log…", autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "search", "aria-label": "Search" });
  const filterBox = h("details", { class: "filters" });
  const out = h("div", { class: "stack", "aria-live": "polite" });

  const toggle = (set, v) => { set.has(v) ? set.delete(v) : set.add(v); shown = PAGE; paintFilters(); paint(); };
  const chips = (set, opts) => h("div", { class: "row" }, opts.map(([v, label]) => h("button", { class: "chip", type: "button", "aria-pressed": String(set.has(v)), onClick: () => toggle(set, v) }, label)));
  const count = () => Object.values(f).reduce((n, s) => n + s.size, 0);

  function paintFilters() {
    const logOn = !f.src.size || f.src.has("log");
    const topicPick = h("select", { id: "f-topic", "aria-label": "Add a topic", onChange: (e) => { if (e.target.value) { f.deck.add(e.target.value); shown = PAGE; paintFilters(); paint(); } } },
      h("option", { value: "" }, "Add a topic…"), [...decks].filter(([id]) => !f.deck.has(id)).map(([id, t]) => h("option", { value: id }, t)));
    const open = filterBox.open;
    mount(filterBox,
      h("summary", null, count() ? `Filters · ${count()} on` : "Filters"),
      h("div", { class: "stack" },
        h("div", { class: "field" }, h("label", null, "Where from"), chips(f.src, SOURCES)),
        h("div", { class: "field" }, h("label", null, "Word or phrase"), chips(f.kind, KINDS)),
        h("div", { class: "field" }, h("label", { for: "f-topic" }, "Topic"), topicPick,
          f.deck.size ? h("div", { class: "row" }, [...f.deck].map((id) => h("button", { class: "chip", type: "button", "aria-pressed": "true", onClick: () => toggle(f.deck, id) }, `${decks.get(id)} ✕`))) : null),
        logOn ? [
          h("div", { class: "field" }, h("label", null, "My log: situation"), chips(f.sit, SITUATIONS.map((s) => [s, s]))),
          h("div", { class: "field" }, h("label", null, "My log: what was it"), chips(f.logKind, LOG_KIND)),
          h("div", { class: "field" }, h("label", null, "My log: status"), chips(f.status, LOG_STATUS))] : null,
        count() ? h("button", { class: "btn ghost", type: "button", onClick: () => { Object.values(f).forEach((s) => s.clear()); shown = PAGE; paintFilters(); paint(); } }, "Clear filters") : null));
    filterBox.open = open;
  }

  function card(r) {
    if (r.kind === "grammar") return h("section", { class: "card stack" }, h("span", { class: "chip static" }, "Grammar"), h("h3", null, r.en), h("p", null, inline(r.answer, ctx.resources)));
    return h("section", { class: "card stack" },
      h("span", { class: "eyebrow" }, r.src === "log" ? "My log" : r.topic),
      h("div", { class: "row" }, h("div", { class: "flash" }, inline(r.it)), speakBtn(ctx, r.it)),
      h("p", { class: "muted" }, inline(r.en)),
      r.note ? h("p", { class: "small" }, r.note) : null,
      r.src === "log" ? h("div", { class: "row" }, r.sit ? h("span", { class: "chip static" }, r.sit) : null, r.logKind ? h("span", { class: "chip static" }, LK[r.logKind]) : null,
        h("span", { class: "chip static" }, r.status === "unchecked" ? "Unchecked" : r.status === "checked" ? "Checked ✓" : "Typed by me")) : null);
  }

  function paint() {
    const q = input.value.trim();
    if (!q && !hasFilters(f)) return out.replaceChildren(h("p", { class: "muted" }, "Type at least two letters, or pick a filter to browse. For example: farmacia, pharmacy, \"dov'è\", ho bisogno."));
    const hits = search(index, q, f);
    if (!hits.length) return out.replaceChildren(h("p", null, q.length === 1 ? "Type at least two letters." : "Nothing found."), h("a", { class: "btn", href: "#/translate" }, "Translate it instead"));
    mount(out, h("p", { class: "muted small" }, `${hits.length} result${hits.length === 1 ? "" : "s"}${hits.length > shown ? `, showing ${shown}` : ""}`),
      hits.slice(0, shown).map(card),
      hits.length > shown ? h("button", { class: "btn", type: "button", onClick: () => { shown += PAGE; paint(); } }, `Show ${Math.min(PAGE, hits.length - shown)} more`) : null);
  }

  input.addEventListener("input", () => { shown = PAGE; clearTimeout(timer); timer = setTimeout(paint, 120); });
  if (params && params[0]) input.value = decodeURIComponent(params[0]);
  mount(root, h("div", null, h("p", { class: "eyebrow" }, "Search"), h("h1", null, "Quick search")), input, filterBox, out);
  paintFilters(); paint();
  root.cleanup = () => clearTimeout(timer);
  return root;
}
