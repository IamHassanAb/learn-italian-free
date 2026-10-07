import { h, speakBtn, mount } from "../ui.js";
import { localDate } from "../lib/util.js";
import { DRILLS, makeSession, check } from "../lib/drills.js";

export function drillsView(ctx, params) {
  const root = h("div", { class: "stack" });
  const today = localDate();
  const opts = {};   // chosen option per drill

  function menu() {
    mount(root, 
      h("div", null, h("p", { class: "eyebrow" }, "Drills"), h("h1", null, "Quick practice"), h("p", { class: "muted" }, "Ten questions each. Generated fresh every time.")),
      Object.entries(DRILLS).map(([id, d]) => {
        const stats = ctx.store.state.drills[id], voiceOff = d.needsVoice && !ctx.speech.available();
        opts[id] ||= d.options[1] || d.options[0];
        return h("section", { class: "card stack" },
          h("div", null, h("h2", null, d.title), h("p", { class: "muted small" }, d.blurb, stats ? `  Best so far: ${stats.correct}/${stats.total} over ${stats.sessions} session${stats.sessions === 1 ? "" : "s"}.` : "")),
          d.options.length > 1 ? h("div", { class: "row", role: "group", "aria-label": "Range" }, d.options.map(o => h("button", { class: "chip", type: "button", "aria-pressed": String(opts[id] === o), onClick: (e) => { opts[id] = o; [...e.target.parentNode.children].forEach(c => c.setAttribute("aria-pressed", String(c === e.target))); } }, o))) : null,
          voiceOff ? h("p", { class: "muted small" }, "No Italian voice found on this device, so this drill is unavailable here.") : h("button", { class: "btn warm", type: "button", onClick: () => run(id, opts[id]) }, "Start"));
      }));
  }

  function run(id, opt) {
    const qs = makeSession(id, opt, 10); let i = 0, correct = 0, answered = false;
    const mistakes = [];
    function step() {
      const q = qs[i]; answered = false;
      const input = h("input", { type: "text", id: "ans", autocomplete: "off", autocapitalize: "none", spellcheck: "false", "aria-label": "Your answer" });
      const result = h("div", { "aria-live": "polite" });
      const next = h("button", { class: "btn primary", type: "button", hidden: true, onClick: () => { i++; i < qs.length ? step() : done(); } }, i === qs.length - 1 ? "See score" : "Next");
      const submit = (giveUp) => {
        if (answered) return; answered = true;
        const ok = !giveUp && check(q, input.value);
        if (ok) correct++; else mistakes.push(q);
        result.replaceChildren(h("p", { class: ok ? "ok" : "bad" }, ok ? "Esatto!" : giveUp ? "Answer:" : "Not quite."), h("div", { class: "row" }, h("span", { class: "flash answer" }, q.show), speakBtn(ctx, q.speak)));
        if (ok && q.show && input.value.trim() && input.value.trim() !== q.show && /[àèéìòù]/.test(q.show)) result.append(h("p", { class: "muted small" }, "Note the accent in the written form."));
        next.hidden = false; check_btn.hidden = true; skip.hidden = true; input.disabled = true; next.focus();
        if (ctx.speech.available() && q.speak && !q.kind.endsWith("listen")) ctx.speech.speak(q.speak, ctx.store.state.settings.rate);
      };
      const check_btn = h("button", { class: "btn primary", type: "button", onClick: () => submit(false) }, "Check");
      const skip = h("button", { class: "btn ghost", type: "button", onClick: () => submit(true) }, "Show answer");
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(false); } });
      const isListen = q.kind.endsWith("listen");
      mount(root, 
        h("div", { class: "row between" }, h("p", { class: "eyebrow" }, `${DRILLS[id].title} · ${i + 1}/${qs.length}`), h("button", { class: "btn ghost small", type: "button", onClick: menu }, "End")),
        h("div", { class: "progress" }, h("i", { style: `width:${(i / qs.length) * 100}%` })),
        h("section", { class: "card stack" },
          isListen ? h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: () => ctx.speech.speak(q.speak, ctx.store.state.settings.rate) }, "▶ Play"), h("span", { class: "muted small" }, q.prompt))
                   : h("div", null, h("div", { class: "flash" }, q.prompt), q.hint ? h("p", { class: "muted small" }, q.hint) : null),
          h("div", { class: "field" }, h("label", { for: "ans" }, "Your answer"), input),
          h("div", { class: "row" }, check_btn, skip), result, next));
      input.focus();
      if (isListen) setTimeout(() => ctx.speech.speak(q.speak, ctx.store.state.settings.rate), 150);
    }
    function done() {
      ctx.store.addDrill(today, id, correct, qs.length);
      mount(root, 
        h("div", null, h("p", { class: "eyebrow" }, DRILLS[id].title), h("h1", null, `${correct} / ${qs.length}`)),
        mistakes.length ? h("section", { class: "card" }, h("h2", null, "Worth another look"), h("ul", null, mistakes.map(q => h("li", null, `${q.prompt} → ${q.show}`)))) : h("p", { class: "ok" }, "Perfect round."),
        h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => run(id, opt) }, "Again"), h("button", { class: "btn", type: "button", onClick: menu }, "All drills")));
    }
    step();
  }

  menu();
  return root;
}
