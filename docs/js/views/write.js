import { h, mount, toast, speakBtn } from "../ui.js";
import { readyForOwn, cleanSentence, usesChunk, SESSION_SIZE, MIN_REPS } from "../lib/own.js";

// A short, calm session: for each line you have met a few times, write a sentence of your own with it.
// Writing your own sentences is one of the best ways to make a word yours, but it takes time, so it is not part of fast review.
export function writeView(ctx, params) {
  const { store } = ctx, root = h("div", { class: "stack" });
  const one = params && params[0] ? store.state.gaps.find((g) => g.id === decodeURIComponent(params[0])) : null;
  const queue = one ? [one] : readyForOwn(store.state.gaps, store.state.cards, SESSION_SIZE);
  let i = 0, saved = 0, warn = null;

  function paint() {
    if (!queue.length) {
      return mount(root, h("div", null, h("p", { class: "eyebrow" }, "Write"), h("h1", null, "Your own sentences")),
        h("section", { class: "card stack" }, h("p", null, `Nothing is ready yet. A line becomes ready after you have reviewed it ${MIN_REPS} times, so the words are familiar before you use them.`),
          h("div", { class: "row" }, h("a", { class: "btn primary", href: "#/review" }, "Review flashcards"), h("a", { class: "btn", href: "#/gaps" }, "Open the conversation log"))));
    }
    if (i >= queue.length) {
      return mount(root, h("div", null, h("p", { class: "eyebrow" }, "Done"), h("h1", null, "Bravo!")),
        h("section", { class: "card stack" }, h("p", null, saved ? `${saved} sentence${saved === 1 ? "" : "s"} saved. They show up under the line in your log, and on the flashcard when you review it.` : "No sentences saved this time."),
          h("p", { class: "muted small" }, "Say each one out loud. When a local has checked a sentence, tick it in the log (A local confirmed it)."),
          h("div", { class: "row" }, h("a", { class: "btn primary", href: "#/gaps" }, "Open the log"), h("a", { class: "btn", href: "#/review" }, "Back to Review"))));
    }
    const g = queue[i];
    const input = h("textarea", { id: "own-text", rows: 3, placeholder: "Write a sentence about your own life…", autocapitalize: "sentences", spellcheck: "false", "aria-label": "Your sentence" });
    const attempt = (force = false) => {
      const t = cleanSentence(input.value);
      if (!t) { toast("Write a sentence of at least two words."); return; }
      if (!force && !usesChunk(t, g.it)) { warn = t; paint(); return; }
      store.addOwnSentence(g.id, t); saved++; warn = null; i++; toast("Saved."); paint();
    };
    mount(root,
      h("div", { class: "row between" }, h("p", { class: "eyebrow" }, `Write · ${i + 1} of ${queue.length}`), h("a", { class: "btn ghost small", href: "#/gaps" }, "Stop")),
      h("div", { class: "progress", role: "progressbar", "aria-valuenow": Math.round((i / queue.length) * 100), "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${Math.round((i / queue.length) * 100)}%` })),
      h("section", { class: "card stack" },
        h("p", { class: "muted small" }, "Use this in a sentence about you:"),
        h("div", { class: "row" }, h("div", { class: "flash" }, g.it), speakBtn(ctx, g.it)),
        h("p", { class: "muted" }, g.en),
        g.note ? h("p", { class: "small" }, g.note) : null,
        h("div", { class: "field" }, h("label", { for: "own-text" }, "Your sentence"), input),
        h("p", { class: "muted small" }, "Short and simple is fine. Make it true: where you live, what you did today, who you talk to."),
        warn ? h("div", { class: "stack" }, h("p", { class: "bad small", role: "alert" }, "That does not seem to use the line above. Save it anyway?"),
          h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: () => attempt(true) }, "Save anyway"), h("button", { class: "btn ghost", type: "button", onClick: () => { warn = null; paint(); } }, "Let me change it"))) : null,
        h("div", { class: "row" }, h("button", { class: "btn warm", type: "button", onClick: () => attempt(false) }, "Save"), h("button", { class: "btn ghost", type: "button", onClick: () => { warn = null; i++; paint(); } }, "Skip"))));
    const box = root.querySelector("#own-text"); if (warn) box.value = warn; box.focus();
  }
  paint();
  return root;
}
