import { h, toast, mount } from "../ui.js";
import { localDate } from "../lib/util.js";

export function settingsView(ctx) {
  const { store } = ctx, s = store.state.settings, root = h("div", { class: "stack" });
  let confirmReset = false;

  function select(id, label, value, options, onChange) {
    return h("div", { class: "field" }, h("label", { for: id }, label), h("select", { id, onChange: (e) => onChange(e.target.value) }, options.map(([v, t]) => h("option", { value: v, selected: String(v) === String(value) }, t))));
  }
  function backup() {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `italiano-ogni-giorno-${localDate()}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function restore(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { const r = store.importJSON(t); if (r.ok) { ctx.applyTheme(); toast("Progress restored."); paint(); } else toast(r.error); });
  }
  function paint() {
    const voice = ctx.speech.available();
    mount(root, 
      h("div", null, h("p", { class: "eyebrow" }, "Settings"), h("h1", null, "Settings")),
      h("section", { class: "card stack" }, h("h2", null, "Study"),
        select("set-new", "New cards per day", s.newPerDay, [5, 10, 15, 20, 30].map(n => [n, String(n)]), v => store.setting("newPerDay", +v)),
        select("set-dir", "Flashcard direction", s.direction, [["en-it", "English → Italian (say it)"], ["it-en", "Italian → English"], ["mixed", "Mixed"]], v => store.setting("direction", v)),
        h("label", { class: "check" }, h("input", { type: "checkbox", id: "set-auto", checked: s.autoSpeak !== false, onChange: (e) => store.setting("autoSpeak", e.target.checked) }), "Play the Italian when I reveal a card")),
      h("section", { class: "card stack" }, h("h2", null, "Voice"),
        voice ? [h("p", { class: "muted small" }, "An Italian voice is available on this device."),
          h("div", { class: "field" }, h("label", { for: "set-rate" }, `Speed: ${s.rate}`), h("input", { type: "range", id: "set-rate", min: "0.6", max: "1.1", step: "0.05", value: s.rate, onInput: (e) => { store.setting("rate", +e.target.value); e.target.previousSibling.textContent = `Speed: ${e.target.value}`; } })),
          h("button", { class: "btn", type: "button", onClick: () => ctx.speech.speak("Buongiorno! Sto imparando l'italiano.", s.rate) }, "Test voice")]
        : h("p", { class: "muted" }, "No Italian voice was found. Audio buttons are hidden. You can usually add one in your device's language or speech settings.")),
      h("section", { class: "card stack" }, h("h2", null, "Appearance"),
        select("set-theme", "Theme", s.theme, [["auto", "Match my device"], ["light", "Light (cream)"], ["dark", "Dark (dusk)"]], v => { store.setting("theme", v); ctx.applyTheme(); })),
      h("section", { class: "card stack" }, h("h2", null, "Your progress"),
        h("p", { class: "muted small" }, store.persistent() ? "Progress is saved in this browser on this device only. Back it up to move it to another device." : "This browser is blocking storage, so progress will be lost when you close the tab."),
        h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: backup }, "Download backup"),
          h("label", { class: "btn", for: "restore-file" }, "Restore from file", h("input", { type: "file", id: "restore-file", accept: "application/json,.json", hidden: true, onChange: restore }))),
        confirmReset
          ? h("div", { class: "row" }, h("span", { class: "bad" }, "Erase all progress?"), h("button", { class: "btn danger", type: "button", onClick: () => { store.reset(); ctx.applyTheme(); confirmReset = false; toast("Progress erased."); paint(); } }, "Yes, erase"), h("button", { class: "btn", type: "button", onClick: () => { confirmReset = false; paint(); } }, "Cancel"))
          : h("button", { class: "btn ghost", type: "button", onClick: () => { confirmReset = true; paint(); } }, "Erase my progress…")),
      h("section", { class: "card flat" }, h("h2", null, "About"),
        h("p", { class: "muted small" }, "Free and open. Study content: CC BY-SA 4.0. Code: MIT. Content version ", ctx.content.version, ". Links go to other people's free resources and are checked on the dates in the repository."),
        h("p", { class: "muted small" }, "A study aid, not a textbook. If something is wrong, please report it. Bureaucracy information is general: check official sources.")));
  }
  paint();
  return root;
}
