import { h, mount, inline, speakBtn } from "../ui.js";
import { buildIndex, search } from "../lib/search.js";

// One search box over everything: type English or Italian, tap to hear it.
export function searchView(ctx, params) {
  const root = h("div", { class: "stack" });
  const index = buildIndex(ctx.cards(), ctx.content);
  const input = h("input", { type: "search", id: "q", placeholder: "Search phrases, words, grammar…", autocomplete: "off", autocapitalize: "none", spellcheck: "false", enterkeyhint: "search", "aria-label": "Search" });
  const out = h("div", { class: "stack", "aria-live": "polite" });
  function paint() {
    const hits = search(index, input.value);
    if (input.value.trim().length < 2) return out.replaceChildren(h("p", { class: "muted" }, "Type at least two letters. For example: farmacia, pharmacy, \"dov'è\", ho bisogno."));
    if (!hits.length) return out.replaceChildren(h("p", null, "Nothing found."), h("a", { class: "btn", href: "#/translate" }, "Translate it instead"));
    mount(out, h("p", { class: "muted small" }, `${hits.length}${hits.length === 40 ? "+" : ""} result${hits.length === 1 ? "" : "s"}`),
      hits.map((r) => r.kind === "grammar"
        ? h("section", { class: "card stack" }, h("span", { class: "chip static" }, "Grammar"), h("h3", null, r.en), h("p", null, inline(r.answer, ctx.resources)))
        : h("section", { class: "card stack" }, h("span", { class: "eyebrow" }, r.tag),
            h("div", { class: "row" }, h("div", { class: "flash" }, inline(r.it)), speakBtn(ctx, r.it)), h("p", { class: "muted" }, inline(r.en)))));
  }
  input.addEventListener("input", paint);
  if (params && params[0]) input.value = decodeURIComponent(params[0]);
  mount(root, h("div", null, h("p", { class: "eyebrow" }, "Search"), h("h1", null, "Quick search")), input, out);
  paint();
  return root;
}
