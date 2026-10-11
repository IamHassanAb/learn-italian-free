import { h, inline, speakBtn, mount } from "../ui.js";
import { localDate, hashStr } from "../lib/util.js";
import { buildQueue, rate, previewDays } from "../lib/srs.js";

const label = (d) => (d === 0 ? "now" : d === 1 ? "1 day" : `${d} days`);

export function reviewView(ctx) {
  const { store } = ctx, root = h("div", { class: "stack" });
  const today = localDate();
  let session = null;

  const decks = () => ctx.decks();
  const enabled = () => { const d = store.state.settings.decks; return new Set(d ? d : decks().map(x => x.id)); };

  function setup() {
    const day = store.day(today);
    const q = buildQueue(ctx.cards(), store.state.cards, today, { newLimit: store.state.settings.newPerDay, newSeenToday: day.newSeen, decks: enabled() });
    const chips = decks().map(d => h("button", { class: "chip", type: "button", "aria-pressed": String(enabled().has(d.id)), onClick: () => {
      const e = enabled(); e.has(d.id) ? e.delete(d.id) : e.add(d.id); store.setting("decks", [...e]); setup(); } }, `${d.title} · ${d.count}`));
    mount(root, 
      h("div", null, h("p", { class: "eyebrow" }, "Review"), h("h1", null, "Flashcards")),
      h("div", { class: "grid stats" },
        h("div", { class: "card stat" }, h("b", null, String(q.due.length)), h("span", { class: "muted small" }, "due now")),
        h("div", { class: "card stat" }, h("b", null, String(q.fresh.length)), h("span", { class: "muted small" }, `new today (max ${store.state.settings.newPerDay})`))),
      h("section", { class: "card stack" }, h("div", { class: "row between" }, h("h2", null, "Decks"),
        h("div", { class: "row" }, h("button", { class: "btn ghost small", type: "button", onClick: () => { store.setting("decks", decks().map(x => x.id)); setup(); } }, "All"),
          h("button", { class: "btn ghost small", type: "button", onClick: () => { store.setting("decks", []); setup(); } }, "None"))),
        h("p", { class: "muted small" }, "Tap to include or leave out. New cards are taken in course order."), h("div", { class: "row" }, chips)),
      q.queue.length
        ? h("button", { class: "btn warm", type: "button", onClick: () => start(q.queue) }, `Start · ${q.queue.length} card${q.queue.length === 1 ? "" : "s"}`)
        : h("div", { class: "card" }, h("p", null, "Nothing due. Come back tomorrow, add a gap, or raise the new-card limit in Settings.")),
      h("p", { class: "muted small" }, "Say the Italian out loud before you reveal it."));
  }

  function front(card) {
    const dir = store.state.settings.direction;
    const itFirst = dir === "it-en" || (dir === "mixed" && hashStr(card.id + today) % 2 === 0);
    return itFirst;
  }

  function start(queue) { session = { queue: queue.slice(), total: queue.length, done: 0, grades: { again: 0, good: 0, easy: 0 }, revealed: false }; show(); }

  function show() {
    if (!session.queue.length) return finish();
    const card = session.queue[0], itFirst = front(card), st = store.card(card.id), isNew = !st;
    const pct = Math.round((session.done / session.total) * 100);
    const prompt = itFirst ? card.it : card.en, answer = itFirst ? card.en : card.it;
    const reveal = () => {
      session.revealed = true; show();
      if (!itFirst && store.state.settings.autoSpeak !== false) ctx.speech.speak(card.it, store.state.settings.rate);
    };
    const grade = (g) => {
      store.setCard(card.id, rate(st, g, today)); store.addReviewed(today, 1, isNew ? 1 : 0);
      session.grades[g]++; session.queue.shift(); session.revealed = false;
      if (g === "again") session.queue.push(card); else session.done++;
      show();
    };
    document.onkeydown = (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (!session.revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
      else if (session.revealed) { if (e.key === "1") grade("again"); if (e.key === "2") grade("good"); if (e.key === "3") grade("easy"); }
    };
    mount(root, 
      h("div", { class: "row between" }, h("p", { class: "eyebrow" }, `${card.deckTitle}${isNew ? " · new" : ""}`), h("button", { class: "btn ghost small", type: "button", onClick: () => { document.onkeydown = null; session = null; setup(); } }, "End")),
      h("div", { class: "progress", role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${pct}%` })),
      h("section", { class: "card stack", "aria-live": "polite" },
        h("p", { class: "muted small" }, itFirst ? "What does this mean?" : "Say it in Italian"),
        h("div", { class: "row" }, h("div", { class: "flash" }, inline(prompt)), itFirst ? speakBtn(ctx, card.it) : null),
        session.revealed ? [
          h("hr"),
          h("div", { class: "row" }, h("div", { class: "flash answer" }, inline(answer)), itFirst ? null : speakBtn(ctx, card.it)),
          card.example ? h("p", { class: "muted" }, "e.g. ", inline(card.example)) : null] : null),
      session.revealed
        ? h("div", { class: "grid" },
            h("button", { class: "btn", type: "button", onClick: () => grade("again") }, "Again", h("span", { class: "kbd" }, "1")),
            h("button", { class: "btn primary", type: "button", onClick: () => grade("good") }, `Good · ${label(previewDays(st, "good"))}`, h("span", { class: "kbd" }, "2")),
            h("button", { class: "btn warm", type: "button", onClick: () => grade("easy") }, `Easy · ${label(previewDays(st, "easy"))}`, h("span", { class: "kbd" }, "3")))
        : h("button", { class: "btn primary", type: "button", onClick: reveal }, "Show answer ", h("span", { class: "kbd" }, "space")));
  }

  function finish() {
    document.onkeydown = null;
    const g = session.grades; const n = g.again + g.good + g.easy;
    mount(root, 
      h("div", null, h("p", { class: "eyebrow" }, "Done"), h("h1", null, "Bravo!")),
      h("section", { class: "card" }, h("p", null, `${session.total} card${session.total === 1 ? "" : "s"} reviewed (${n} answers).`),
        h("p", { class: "muted" }, `Again ${g.again} · Good ${g.good} · Easy ${g.easy}`)),
      h("div", { class: "row" }, h("a", { class: "btn primary", href: "#/today" }, "Back to Today"), h("a", { class: "btn", href: "#/drills" }, "Try a drill")));
    session = null;
  }

  setup();
  root.cleanup = () => { document.onkeydown = null; };
  return root;
}
