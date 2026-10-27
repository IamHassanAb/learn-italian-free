import { h, speakBtn, mount, toast } from "../ui.js";
import { localDate } from "../lib/util.js";
import { DRILLS, makeSession, check } from "../lib/drills.js";
import { setVoiceAvailable } from "../lib/vocabdrills.js";

export function drillsView(ctx, params) {
  const root = h("div", { class: "stack" });
  const today = localDate();
  const opts = {};   // chosen option per drill

  function menu() {
    setVoiceAvailable(ctx.speech.available());
    const card = ([id, d]) => {
      const stats = ctx.store.state.drills[id], voiceOff = d.needsVoice && !ctx.speech.available();
      const options = d.options.filter((o) => !(d.optionNeedsVoice || []).includes(o) || ctx.speech.available());
      opts[id] ||= d.defaultOption || options[1] || options[0];
      if (!options.includes(opts[id])) opts[id] = options[0];
      return h("section", { class: "card stack" },
        h("div", null, h("h2", null, d.title), h("p", { class: "muted small" }, d.blurb, stats ? `  Best so far: ${stats.correct}/${stats.total} over ${stats.sessions} session${stats.sessions === 1 ? "" : "s"}.` : "")),
        options.length > 1 ? h("div", { class: "row", role: "group", "aria-label": "Mode" }, options.map(o => h("button", { class: "chip", type: "button", "aria-pressed": String(opts[id] === o), onClick: (e) => { opts[id] = o; [...e.target.parentNode.children].forEach(c => c.setAttribute("aria-pressed", String(c === e.target))); } }, o))) : null,
        voiceOff ? h("p", { class: "muted small" }, "No Italian voice found on this device, so this drill is unavailable here.") : h("button", { class: "btn warm", type: "button", onClick: () => run(id, opts[id]) }, "Start"));
    };
    const groups = {};
    for (const e of Object.entries(DRILLS)) (groups[e[1].group || "Numbers and time"] ||= []).push(e);
    mount(root,
      h("div", null, h("p", { class: "eyebrow" }, "Drills"), h("h1", null, "Quick practice"), h("p", { class: "muted" }, "Ten questions each. Generated fresh every time.")),
      Object.entries(groups).map(([g, list]) => h("section", { class: "stack" }, h("h2", null, g), h("div", { class: g === "Vocabulary topics" ? "grid" : "stack" }, list.map(card)))));
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
        result.replaceChildren(h("p", { class: ok ? "ok" : "bad" }, ok ? "Esatto!" : giveUp ? "Answer:" : "Not quite."), h("div", { class: "row" }, h("span", { class: "flash answer" }, q.show), q.speak ? speakBtn(ctx, q.speak) : null), q.why ? h("p", { class: "muted small" }, q.why) : null);
        if (ok && q.show && input.value.trim() && input.value.trim() !== q.show && /[àèéìòù]/.test(q.show)) result.append(h("p", { class: "muted small" }, "Note the accent in the written form."));
        next.hidden = false; check_btn.hidden = true; skip.hidden = true; input.disabled = true; choiceRow.querySelectorAll("button").forEach((b) => { b.disabled = true; }); next.focus();
        if (ctx.speech.available() && q.speak && !q.kind.endsWith("listen")) ctx.speech.speak(q.speak, ctx.store.state.settings.rate);
      };
      const check_btn = h("button", { class: "btn primary", type: "button", onClick: () => submit(false) }, "Check");
      const skip = h("button", { class: "btn ghost", type: "button", onClick: () => submit(true) }, "Show answer");
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submit(false); } });
      const isListen = q.kind.endsWith("listen");
      // multiple-choice questions show big buttons instead of a text box
      const choiceRow = h("div", { class: "choices", role: "group", "aria-label": "Choose" }, (q.choices || []).map((c) => h("button", { class: "btn", type: "button", onClick: () => { input.value = c; submit(false); } }, c)));
      mount(root, 
        h("div", { class: "row between" }, h("p", { class: "eyebrow" }, `${DRILLS[id].title} · ${i + 1}/${qs.length}`), h("button", { class: "btn ghost small", type: "button", onClick: menu }, "End")),
        h("div", { class: "progress" }, h("i", { style: `width:${(i / qs.length) * 100}%` })),
        h("section", { class: "card stack" },
          isListen ? h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: () => ctx.speech.speak(q.speak, ctx.store.state.settings.rate) }, "▶ Play"), h("span", { class: "muted small" }, q.prompt))
                   : h("div", null, q.swatch ? h("div", { class: "swatch", style: `background:${q.swatch}`, role: "img", "aria-label": "A colour sample" }) : null, h("div", { class: "flash" }, q.prompt), q.hint ? h("p", { class: "muted small" }, q.hint) : null),
          q.choices ? choiceRow : [h("div", { class: "field" }, h("label", { for: "ans" }, "Your answer"), input), h("div", { class: "row" }, check_btn, skip)], result, next));
      if (!q.choices) input.focus();
      if (isListen) setTimeout(() => ctx.speech.speak(q.speak, ctx.store.state.settings.rate), 150);
    }
    // Missed words go back to the start of the flashcard ladder, due today.
    function requeue(list) {
      const ids = [...new Set(list.filter((q) => q.card).map((q) => q.card))];
      for (const id of ids) { const st = ctx.store.card(id) || { box: 0, reps: 0, lapses: 0 }; ctx.store.setCard(id, { ...st, box: 0, due: today, lapses: (st.lapses || 0) + (st.reps ? 1 : 0) }); }
      toast(`${ids.length} word${ids.length === 1 ? "" : "s"} due in Review today.`);
    }
    function done() {
      ctx.store.addDrill(today, id, correct, qs.length);
      mount(root, 
        h("div", null, h("p", { class: "eyebrow" }, DRILLS[id].title), h("h1", null, `${correct} / ${qs.length}`)),
        mistakes.length ? h("section", { class: "card stack" }, h("h2", null, "Worth another look"), h("ul", null, mistakes.map(q => h("li", null, `${q.prompt} → ${q.show}`))),
          mistakes.some((q) => q.card) ? h("button", { class: "btn", type: "button", onClick: (e) => { requeue(mistakes); e.target.disabled = true; } }, "Put the missed words in today's review") : null) : h("p", { class: "ok" }, "Perfect round."),
        h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => run(id, opt) }, "Again"), h("button", { class: "btn", type: "button", onClick: menu }, "All drills")));
    }
    step();
  }

  menu();
  return root;
}
