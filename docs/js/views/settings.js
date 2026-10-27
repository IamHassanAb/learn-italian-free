import { installCard } from "./installcard.js";
import { h, toast, mount } from "../ui.js";
import { localDate } from "../lib/util.js";
import { validateConfig, saveDeviceConfig, clearDeviceConfig, makeSetupPayload } from "../lib/syncconfig.js";

export function settingsView(ctx) {
  const { store } = ctx, s = store.state.settings, root = h("div", { class: "stack" });
  let confirmReset = false;
  const off = ctx.sync && ctx.sync.enabled ? ctx.sync.onStatus(() => paint()) : null;

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

  function syncCard() {
    const copyLink = () => {
      const link = `${location.origin}${location.pathname}#/setup/${makeSetupPayload(ctx.syncConfig)}`;
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast("Setup link copied. Open it on your other device."))
        .catch(() => { const box = h("input", { type: "text", readonly: true, value: link, "aria-label": "Setup link" }); document.getElementById("setup-link-slot").replaceChildren(box); box.focus(); box.select(); });
    };
    if (!ctx.sync.enabled) {
      const url = h("input", { type: "text", id: "sync-url", placeholder: "https://your-project.supabase.co", autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
      const key = h("input", { type: "password", id: "sync-key", placeholder: "sb_publishable_…", autocomplete: "off" });
      const msg = h("p", { class: "muted small", role: "status" });
      const save = () => { const r = validateConfig(url.value, key.value); if (!r.ok) { msg.textContent = r.error; return; } saveDeviceConfig(ctx.storage, r.config); location.hash = "#/settings"; location.reload(); };
      return h("details", null, h("summary", null, "Sync across devices (optional)"),
        h("form", { class: "stack", onSubmit: (e) => { e.preventDefault(); save(); } },
          h("p", { class: "muted small" }, "Needs your own free Supabase project (see the README). The address and key are stored only on this device, never in the website or the repository."),
          h("div", { class: "field" }, h("label", { for: "sync-url" }, "Project address"), url),
          h("div", { class: "field" }, h("label", { for: "sync-key" }, "Publishable key (never the secret key)"), key),
          h("button", { class: "btn warm", type: "submit" }, "Save on this device"), msg));
    }
    const info = ctx.sync.info(), when = info.lastSync ? new Date(info.lastSync).toLocaleString() : "not yet";
    const forget = ctx.syncSource === "device" ? h("button", { class: "btn ghost", type: "button", onClick: () => { ctx.sync.signOut().then(() => { clearDeviceConfig(ctx.storage); location.reload(); }); } }, "Remove sync setup from this device") : null;
    if (!info.signedIn) {
      const email = h("input", { type: "email", id: "sync-email", autocomplete: "username", autocapitalize: "none", spellcheck: "false" });
      const pw = h("input", { type: "password", id: "sync-pw", autocomplete: "current-password" });
      const msg = h("p", { class: "muted small", role: "status" });
      const go = () => { msg.textContent = "Signing in…"; ctx.sync.signIn(email.value, pw.value).then((r) => { toast(r && r.ok ? "Signed in and synced." : "Signed in."); }).catch((e) => { msg.textContent = e.message; }); };
      return h("section", { class: "card stack" }, h("h2", null, "Sync across devices"),
        h("p", { class: "muted small" }, "Sign in with the account you created in your Supabase project to keep your progress the same on every device."),
        h("form", { class: "stack", onSubmit: (e) => { e.preventDefault(); go(); } },
          h("div", { class: "field" }, h("label", { for: "sync-email" }, "Email"), email),
          h("div", { class: "field" }, h("label", { for: "sync-pw" }, "Password"), pw),
          h("button", { class: "btn warm", type: "submit" }, "Sign in")), msg, forget);
    }
    const busy = info.status === "syncing";
    return h("section", { class: "card stack" }, h("h2", null, "Sync across devices"),
      h("p", { class: "muted small" }, `Signed in as ${info.email}. Last synced: ${when}.`),
      info.status === "error" || info.status === "offline" || info.status === "upgrade" ? h("p", { class: "bad small", role: "status" }, info.error) : null,
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", disabled: busy, onClick: () => ctx.sync.syncNow().then((r) => { if (r.ok) toast("Synced."); }) }, busy ? "Syncing…" : "Sync now"),
        h("button", { class: "btn ghost", type: "button", onClick: () => ctx.sync.signOut().then(() => toast("Signed out. Progress stays on this device.")) }, "Sign out")),
      h("div", { class: "stack" }, h("button", { class: "btn", type: "button", onClick: copyLink }, "Copy setup link for another device"), h("div", { id: "setup-link-slot" }),
        h("p", { class: "muted small" }, "The link carries your project address and publishable key, never your password. Send it only to yourself.")),
      h("p", { class: "muted small" }, "Voice, theme, hand and translator settings stay on each device. New cards per day, direction and chosen decks follow you."), forget);
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
        select("set-theme", "Theme", s.theme, [["auto", "Match my device"], ["light", "Light (cream)"], ["dark", "Dark (dusk)"]], v => { store.setting("theme", v); ctx.applyTheme(); }),
        select("set-hand", "Which hand holds your phone?", s.hand || "right", [["right", "Right hand (main buttons on the right)"], ["left", "Left hand (main buttons on the left)"], ["center", "Centred"]], v => { store.setting("hand", v); ctx.applyTheme(); })),
      h("section", { class: "card stack" }, h("h2", null, "Translation"),
        select("set-tprov", "Translator", s.translateProvider || "auto", [["auto", "Automatic (on-device if your browser has it, otherwise MyMemory)"], ["mymemory", "MyMemory only"]], v => store.setting("translateProvider", v)),
        h("p", { class: "muted small" }, ctx.translator.chromeSupported() ? "This browser has an on-device translator (private, works offline)." : "This browser has no on-device translator (desktop Chrome does), so MyMemory is used."),
        h("div", { class: "field" }, h("label", { for: "set-temail" }, "Your email (optional)"),
          h("input", { type: "email", id: "set-temail", value: s.translateEmail || "", autocomplete: "email", autocapitalize: "none", spellcheck: "false", onChange: (e) => store.setting("translateEmail", e.target.value.trim()) })),
        h("p", { class: "muted small" }, "MyMemory allows 5,000 characters a day, or 50,000 if it has an email. The email is stored only on this device and sent to MyMemory with each translation.")),
      installCard(ctx),
      syncCard(),
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
  root.cleanup = () => { if (off) off(); };
  return root;
}
