import { h, inline, mount } from "../ui.js";
import { toast } from "../ui.js";

// Gaps log: a word, phrase or mistake you hit while listening or speaking. Each entry becomes a flashcard.
export function gapsView(ctx) {
  const root = h("div", { class: "stack" });
  const grammar = ctx.content.modules["step3-grammar"];
  const topics = grammar ? grammar.parts.filter(p => p.type === "lookup-row") : [];

  function paint() {
    const it = h("input", { type: "text", id: "gap-it", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
    const en = h("input", { type: "text", id: "gap-en", autocomplete: "off" });
    const tag = h("select", { id: "gap-tag" }, h("option", { value: "" }, "None"), topics.map(t => h("option", { value: t.id }, t.when)));
    const add = () => {
      if (!it.value.trim() || !en.value.trim()) { toast("Add the Italian and what it means."); return; }
      ctx.store.addGap({ it: it.value.trim(), en: en.value.trim(), tag: tag.value || null });
      toast("Added. It is now a flashcard."); paint();
    };
    const gaps = ctx.store.state.gaps;
    mount(root, 
      h("div", null, h("p", { class: "eyebrow" }, "Gaps"), h("h1", null, "Gaps log"), h("p", { class: "muted" }, "Something blocked you while listening or speaking? Write it down. Each entry joins your flashcards, so you study only what you actually need.")),
      h("form", { class: "card stack", onSubmit: (e) => { e.preventDefault(); add(); } },
        h("div", { class: "field" }, h("label", { for: "gap-it" }, "Italian (the word, phrase or corrected sentence)"), it),
        h("div", { class: "field" }, h("label", { for: "gap-en" }, "What it means, or what went wrong"), en),
        topics.length ? h("div", { class: "field" }, h("label", { for: "gap-tag" }, "Grammar topic (optional)"), tag) : null,
        h("button", { class: "btn warm", type: "submit" }, "Add to flashcards")),
      gaps.length ? h("section", { class: "stack" }, h("h2", null, `Your gaps (${gaps.length})`), gaps.map(g => {
        const t = topics.find(x => x.id === g.tag);
        return h("div", { class: "card stack" }, h("div", { class: "row between" }, h("strong", null, g.it), h("button", { class: "btn ghost small", type: "button", "aria-label": `Delete ${g.it}`, onClick: () => { ctx.store.removeGap(g.id); paint(); } }, "Delete")),
          h("div", { class: "muted" }, g.en), h("div", { class: "muted small" }, g.created),
          t ? h("details", null, h("summary", null, `Grammar: ${t.when}`), h("p", null, inline(t.answer))) : null);
      })) : h("p", { class: "muted" }, "No gaps yet. That is fine; they will come."));
  }
  paint();
  return root;
}
