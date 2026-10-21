import { h, inline, parseLine, speakBtn, renderPart, mount } from "../ui.js";
import { TIERS, tierOf, byTier, suggestNext } from "../lib/tiers.js";

const RATINGS = [["Rough", 1], ["OK", 2], ["Smooth", 3]];

export function scenariosView(ctx, params) {
  const ids = ctx.content.order.filter(id => id.startsWith("scenario-"));
  return params[0] ? player(ctx, params[0]) : list(ctx, ids);
}

function list(ctx, ids) {
  const mods = ctx.content.modules, ratings = ctx.store.state.ratings, next = suggestNext(ids, mods, ratings);
  const card = (id) => {
    const m = mods[id], r = ratings[id], t = tierOf(m);
    return h("a", { class: "card block", href: `#/scenarios/${id}`, style: "text-decoration:none;color:inherit" },
      h("h2", null, m.title), h("p", { class: "muted small" }, m.setting || ""),
      h("div", { class: "row" }, h("span", { class: "chip static" }, `with ${m.persona || "someone"}`), h("span", { class: "chip static" }, m.register === "tu" ? "tu" : "Lei"), r ? h("span", { class: "chip static" }, RATINGS.find(x => x[1] === r.stars)[0]) : null));
  };
  const groups = [1, 2, 3, 4].map((t) => [t, byTier(ids, mods).filter((id) => tierOf(mods[id]) === t)]).filter(([, g]) => g.length);
  return h("div", { class: "stack" },
    h("div", null, h("p", { class: "eyebrow" }, "Role-play"), h("h1", null, "Scenarios"), h("p", { class: "muted" }, "Real situations. Play your side out loud, then hide the other side and do it from memory. Start at tier 1 and work up.")),
    next ? h("a", { class: "card block", href: `#/scenarios/${next.id}`, style: "text-decoration:none;color:inherit;border-color:hsl(var(--sage))" },
      h("p", { class: "eyebrow" }, `Suggested next · ${next.why}`), h("h2", null, mods[next.id].title), h("p", { class: "muted small" }, `Tier ${tierOf(mods[next.id])} · ${TIERS[tierOf(mods[next.id])].name}`)) : null,
    groups.map(([t, g]) => h("section", { class: "stack" }, h("h2", null, `Tier ${t} · ${TIERS[t].name}`), h("p", { class: "muted small" }, TIERS[t].tip), h("div", { class: "grid" }, g.map(card)))));
}

function player(ctx, id) {
  const m = ctx.content.modules[id];
  if (!m) return h("div", { class: "stack" }, h("p", null, "That scenario does not exist."), h("a", { class: "btn", href: "#/scenarios" }, "All scenarios"));
  let hide = "none";   // none | them | me
  const root = h("div", { class: "stack" });
  const part = (t) => m.parts.find(p => p.type === t);
  const goal = m.parts.find(p => p.type === "text");

  function paint() {
    const dlg = part("dialogue"), vocab = part("vocab"), role = part("bullets"), r = ctx.store.state.ratings[id];
    const lines = dlg.lines.map((raw, idx) => {
      const x = parseLine(raw), me = x.who === "Tu", hidden = (hide === "them" && !me) || (hide === "me" && me);
      const row = h("div", { class: "line" + (me ? " me" : "") + (hidden ? " hidden" : "") },
        h("span", { class: "who" }, x.who || ""),
        h("span", { class: "txt", tabindex: hidden ? 0 : null, role: hidden ? "button" : null, onClick: hidden ? () => row.replaceWith(shown(x, me)) : null, onKeydown: hidden ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.replaceWith(shown(x, me)); } } : null },
          hidden ? "(tap to reveal)" : [x.aside ? h("span", { class: "aside" }, x.aside + " ") : null, inline(x.text)]),
        hidden ? null : speakBtn(ctx, x.text));
      return row;
    });
    function shown(x, me) { return h("div", { class: "line" + (me ? " me" : "") }, h("span", { class: "who" }, x.who || ""), h("span", { class: "txt" }, [x.aside ? h("span", { class: "aside" }, x.aside + " ") : null, inline(x.text)]), speakBtn(ctx, x.text)); }
    const mode = (v, text) => h("button", { class: "chip", type: "button", "aria-pressed": String(hide === v), onClick: () => { hide = v; paint(); } }, text);
    mount(root, 
      h("a", { class: "btn ghost small", href: "#/scenarios" }, "← All scenarios"),
      h("div", null, h("p", { class: "eyebrow" }, `with ${m.persona} · ${m.register === "tu" ? "use tu" : "use Lei"}`), h("h1", null, m.title), goal ? h("p", { class: "muted" }, inline(goal.text)) : null,
        h("p", { class: "small" }, h("span", { class: "chip static" }, `Tier ${tierOf(m)} · ${TIERS[tierOf(m)].name}`), " ", TIERS[tierOf(m)].tip)),
      vocab ? h("details", null, h("summary", null, "Vocabulary"), renderPart(ctx, vocab)) : null,
      h("section", { class: "card" }, h("div", { class: "row between" }, h("h2", null, "Dialogue"), h("div", { class: "row", role: "group", "aria-label": "Hide lines" }, mode("none", "Show all"), mode("them", "Hide theirs"), mode("me", "Hide mine"))), h("div", null, lines)),
      role ? h("section", { class: "card flat" }, h("h2", null, "Your turn"), h("p", { class: "muted small" }, "Change the details and say it again."), renderPart(ctx, { ...role, title: null })) : null,
      h("section", { class: "card" }, h("h2", null, "How did it go?"), h("div", { class: "row" }, RATINGS.map(([t, v]) => h("button", { class: "btn" + (r && r.stars === v ? " primary" : ""), type: "button", onClick: () => { ctx.store.setRating(id, v); paint(); } }, t)))));
  }
  paint();
  return root;
}
