import { h, toast } from "../ui.js";
import { separateStorage } from "../lib/install.js";

// "Install this app": a banner for Today (dismissible) and a card for Settings (always there until installed).
// It repaints itself when the browser says the app can be installed, or once it has been installed.
export function installCard(ctx, { banner = false } = {}) {
  const box = h("div"), inst = ctx.install;
  const link = () => location.origin + location.pathname;
  const share = () => {
    const data = { title: "Italiano ogni giorno", text: "A free Italian study app", url: link() };
    if (navigator.share) return navigator.share(data).catch(() => {});
    return (navigator.clipboard ? navigator.clipboard.writeText(link()).then(() => toast("Link copied.")) : Promise.reject()).catch(() => toast("Could not copy the link."));
  };
  function paint() { draw(); box.hidden = !box.firstChild; }          // an empty box would still add a gap
  function draw() {
    if (box.dataset.painted && !box.isConnected) { off(); return; }          // the screen was replaced: stop listening
    box.dataset.painted = "1";
    const st = inst.state();
    if (st.kind === "none" || (banner && (st.kind === "installed" || inst.bannerDismissed()))) { box.replaceChildren(); return; }
    if (st.kind === "installed") { box.replaceChildren(h("section", { class: "card flat" }, h("h2", null, "App"), h("p", { class: "muted small" }, "Installed on this device. Open it from your home screen or app list."))); return; }
    const warn = separateStorage(st.device) ? h("p", { class: "muted small" }, "On iPhone and iPad the installed app keeps its own copy of your progress, separate from Safari. Install it first and use it from the icon. To bring progress over from Safari, use Download backup in Safari and Restore from file in the installed app (Settings, Your progress), or turn on sync.") : null;
    const how = st.kind === "prompt"
      ? h("button", { class: "btn warm", type: "button", onClick: () => inst.install().then((o) => { if (o === "accepted") toast("Installing. Look for the icon."); }) }, "Install the app")
      : h("div", { class: "stack" }, h("p", { class: "small" }, "To put it on your home screen:"), h("ol", { class: "small", style: "margin:0" }, st.steps.map((s) => h("li", null, s))));
    box.replaceChildren(h("section", { class: "card stack", style: "border-color:hsl(var(--sage))" },
      h("div", null, h("p", { class: "eyebrow" }, "Install"), h("h2", null, "Keep it on your home screen"), h("p", { class: "muted small" }, "Opens like an app, with no browser bars, and you never have to search for the address.")),
      how, banner ? (warn ? h("p", { class: "muted small" }, "On iPhone and iPad, install before you save progress: the installed app keeps its own data.") : null) : warn,
      h("div", { class: "row" }, banner ? h("button", { class: "btn ghost", type: "button", onClick: () => inst.dismissBanner() }, "Not now") : null, h("button", { class: "btn ghost", type: "button", onClick: share }, navigator.share ? "Share the link" : "Copy the link"))));
  }
  const off = inst.onChange(paint);
  paint();
  return box;
}
