import { h, renderModule } from "../ui.js";

export function libraryView(ctx, params) {
  const { content } = ctx;
  if (params[0]) {
    const m = content.modules[params[0]];
    if (!m) return h("div", { class: "stack" }, h("p", null, "That page does not exist."), h("a", { class: "btn", href: "#/library" }, "Library"));
    return h("div", { class: "stack" }, h("a", { class: "btn ghost small", href: "#/library" }, "← Library"), h("div", null, h("p", { class: "eyebrow" }, `${m.level} · ${m.skill}`), h("h1", null, m.title)), renderModule(ctx, m));
  }
  const stepTitle = (n) => (n === 0 ? "Start here" : (content.steps.find(s => s.number === n) || {}).title || `Step ${n}`);
  const groups = new Map();
  const PB = "phrases";   // the 200-phrase book is shown as its own group
  content.order.forEach(id => { const m = content.modules[id]; if (id.startsWith("scenario-") || id === "basics-howto") return; const key = id.startsWith("pb-") ? PB : m.step; (groups.get(key) || groups.set(key, []).get(key)).push(m); });
  return h("div", { class: "stack" },
    h("div", null, h("p", { class: "eyebrow" }, "Library"), h("h1", null, "Everything, in one place"), h("p", { class: "muted" }, "The same content as the PDFs, readable here. Scenarios live under Role-play.")),
    [...groups.entries()].sort((a, b) => (a[0] === PB ? 99 : a[0]) - (b[0] === PB ? 99 : b[0])).map(([step, mods]) => h("section", { class: "card" }, h("h2", null, step === PB ? "200 essential phrases" : step === 0 ? "Start here" : `Step ${step}: ${stepTitle(step)}`),
      h("ul", { class: "linklist" }, mods.map(m => h("li", null, h("a", { href: `#/library/${m.id}` }, m.title)))))),
    h("section", { class: "card" }, h("h2", null, "Printable PDFs"), h("p", { class: "muted small" }, "Open or print these offline."),
      h("ul", { class: "linklist" }, content.pdfs.map(p => h("li", null, h("a", { href: `pdf/${p.file}`, target: "_blank", rel: "noopener" }, p.title), h("span", { class: "muted small" }, `  ${p.subtitle}`))))));
}
