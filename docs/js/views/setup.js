import { h } from "../ui.js";
import { parseSetupPayload, saveDeviceConfig } from "../lib/syncconfig.js";

// Opened from a setup link (#/setup/<payload>). The address bar is cleaned straight away so the key is not left in history,
// and nothing is saved until you confirm: a link must never silently point the app at someone else's project.
export function setupView(ctx, params) {
  const payload = params[0];
  history.replaceState(null, "", location.pathname + location.search + "#/setup");
  const r = payload ? parseSetupPayload(payload) : { ok: false, error: "Open a setup link from another device to use this page." };
  if (!r.ok) return h("div", { class: "stack" }, h("h1", null, "Sync setup"), h("p", { class: "bad", role: "status" }, r.error), h("a", { class: "btn", href: "#/settings" }, "Settings"));
  const host = new URL(r.config.supabaseUrl).host;
  return h("div", { class: "stack" },
    h("div", null, h("p", { class: "eyebrow" }, "Sync setup"), h("h1", null, "Use this project for sync?")),
    h("section", { class: "card stack" },
      h("p", null, "This device will store and read your study progress in the project at:"),
      h("p", null, h("strong", null, host)),
      h("p", { class: "muted small" }, "Only continue if this is your own project and you made this link yourself. You will then sign in with your own email and password. If you did not expect this link, choose Cancel."),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onClick: () => { saveDeviceConfig(ctx.storage, r.config); location.hash = "#/settings"; location.reload(); } }, "Use this project"),
        h("a", { class: "btn", href: "#/settings" }, "Cancel"))));
}
