import { h, inline, renderModule } from "../ui.js";
import { localDate } from "../lib/util.js";
import { buildQueue } from "../lib/srs.js";

export function todayView(ctx) {
  const { content, store } = ctx, today = localDate(), day = store.day(today);
  const q = buildQueue(ctx.cards(), store.state.cards, today, { newLimit: store.state.settings.newPerDay, newSeenToday: day.newSeen });
  const streak = store.streak(today);
  const doneCount = content.today.filter(b => day.blocks[b.id]).length;

  const blocks = content.today.map((b) => {
    const links = (b.resources || []).map(id => ctx.resources[id]).filter(Boolean);
    const node = h("section", { class: "card block" + (day.blocks[b.id] ? " done" : "") },
      h("div", { class: "row between" }, h("h2", null, b.title), h("span", { class: "chip static" }, `${b.minutes} min`)),
      h("p", null, b.text),
      links.length ? h("ul", { class: "linklist" }, links.map(r => h("li", null, h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.title), r.level ? h("span", { class: "muted small" }, `  ${r.level}`) : null))) : null,
      b.actions ? h("div", { class: "row" },
        b.actions.includes("retell") ? h("a", { class: "btn warm", href: "#/retell" }, "Retell it") : null,
        b.actions.includes("review") ? h("a", { class: "btn warm", href: "#/review" }, q.queue.length ? `Review ${q.queue.length} card${q.queue.length === 1 ? "" : "s"}` : "No cards due") : null,
        b.actions.includes("drills") ? h("a", { class: "btn", href: "#/drills" }, "Quick drills") : null,
        b.actions.includes("scenarios") ? h("a", { class: "btn", href: "#/scenarios" }, "Play a scenario") : null) : null,
      h("label", { class: "check" }, h("input", { type: "checkbox", id: "blk-" + b.id, checked: !!day.blocks[b.id], onChange: (e) => { store.markBlock(today, b.id, e.target.checked); ctx.refresh(); } }), "Done today"));
    return node;
  });

  const rhythm = content.modules["step5-rhythm"];
  return h("div", { class: "stack" },
    h("div", null, h("p", { class: "eyebrow" }, "Oggi"), h("h1", null, ctx.greeting()), h("p", { class: "muted" }, "30 minutes: read, speak, listen. Grammar only when you get stuck.")),
    h("div", { class: "grid stats" },
      h("div", { class: "card stat" }, h("b", null, String(streak)), h("span", { class: "muted small" }, "day streak")),
      h("div", { class: "card stat" }, h("b", null, `${doneCount}/${content.today.length}`), h("span", { class: "muted small" }, "blocks done today")),
      h("div", { class: "card stat" }, h("b", null, String(q.due.length)), h("span", { class: "muted small" }, `due · ${q.fresh.length} new`))),
    blocks,
    h("a", { class: "btn", href: "#/gaps" }, "Log a word or mistake you hit"),
    rhythm ? h("section", { class: "card flat" }, h("h2", null, rhythm.title), renderModule(ctx, rhythm)) : null);
}
