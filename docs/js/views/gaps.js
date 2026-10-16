import { h, inline, mount, toast, speakBtn } from "../ui.js";

const KIND = { wanted: "I wanted to say", heard: "They said", corrected: "Corrected by a local" };

// The conversation log: words, phrases and corrected sentences from real life (typed here or saved from Translate).
// Every entry is also a flashcard. Machine-translated entries stay "unchecked" until you confirm them.
export function gapsView(ctx) {
  const root = h("div", { class: "stack" });
  const grammar = ctx.content.modules["step3-grammar"];
  const topics = grammar ? grammar.parts.filter((p) => p.type === "lookup-row") : [];
  let filter = "all";

  function paint() {
    const it = h("input", { type: "text", id: "gap-it", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
    const en = h("input", { type: "text", id: "gap-en", autocomplete: "off" });
    const tag = h("select", { id: "gap-tag" }, h("option", { value: "" }, "None"), topics.map((t) => h("option", { value: t.id }, t.when)));
    const add = () => {
      if (!it.value.trim() || !en.value.trim()) { toast("Add the Italian and what it means."); return; }
      ctx.store.addGap({ it: it.value.trim(), en: en.value.trim(), tag: tag.value || null, src: "manual" });
      toast("Added. It is now a flashcard."); paint();
    };
    const all = ctx.store.state.gaps;
    const gaps = all.filter((g) => filter === "all" || (filter === "unchecked" ? g.src === "translate" && !g.checked : g.src !== "translate" || g.checked));
    const unchecked = all.filter((g) => g.src === "translate" && !g.checked).length;
    const chipBtn = (v, label) => h("button", { class: "chip", type: "button", "aria-pressed": String(filter === v), onClick: () => { filter = v; paint(); } }, label);

    mount(root,
      h("div", null, h("p", { class: "eyebrow" }, "Log"), h("h1", null, "Conversation log"),
        h("p", { class: "muted" }, "Words, phrases and corrections from real conversations. Each entry joins your flashcards, so you study what you actually need.")),
      h("a", { class: "btn warm", href: "#/translate" }, "Translate and log a line"),
      h("form", { class: "card stack", onSubmit: (e) => { e.preventDefault(); add(); } },
        h("h2", null, "Add by hand"),
        h("div", { class: "field" }, h("label", { for: "gap-it" }, "Italian (the word, phrase or corrected sentence)"), it),
        h("div", { class: "field" }, h("label", { for: "gap-en" }, "What it means, or what went wrong"), en),
        topics.length ? h("div", { class: "field" }, h("label", { for: "gap-tag" }, "Grammar topic (optional)"), tag) : null,
        h("button", { class: "btn", type: "submit" }, "Add to flashcards")),
      all.length ? h("div", { class: "row", role: "group", "aria-label": "Filter" }, chipBtn("all", `All (${all.length})`), chipBtn("unchecked", `Unchecked (${unchecked})`), chipBtn("checked", "Checked")) : null,
      gaps.length ? h("section", { class: "stack" }, gaps.map((g) => {
        const t = topics.find((x) => x.id === g.tag), machine = g.src === "translate";
        return h("div", { class: "card stack" },
          h("div", { class: "row between" }, h("strong", null, g.it), h("button", { class: "btn ghost small", type: "button", "aria-label": `Delete ${g.it}`, onClick: () => { ctx.store.removeGap(g.id); paint(); } }, "Delete")),
          h("div", { class: "muted" }, g.en),
          g.note ? h("div", { class: "small" }, g.note) : null,
          h("div", { class: "row" },
            g.ctx ? h("span", { class: "chip static" }, g.ctx) : null, g.kind ? h("span", { class: "chip static" }, KIND[g.kind] || g.kind) : null,
            machine ? h("span", { class: "chip static" }, g.checked ? "Checked ✓" : "Unchecked") : null, h("span", { class: "muted small" }, g.created)),
          h("div", { class: "row" },
            speakBtn(ctx, g.it),
            machine ? h("button", { class: "btn small", type: "button", onClick: () => { ctx.store.updateGap(g.id, { checked: !g.checked }); paint(); } }, g.checked ? "Mark unchecked" : "I checked this with a local or a source") : null),
          t ? h("details", null, h("summary", null, `Grammar: ${t.when}`), h("p", null, inline(t.answer))) : null);
      })) : h("p", { class: "muted" }, all.length ? "Nothing in this filter." : "Nothing logged yet. Try the Translate screen next time you are talking to someone."));
  }
  paint();
  return root;
}
