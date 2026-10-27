import { detectDevice, iosBrowser, installState } from "./lib/install.js";

const DISMISS_KEY = "italiano-ogni-giorno:install-banner";

// Browser side of installing: keeps the install event the browser fires (it can arrive before the screen is drawn),
// answers "what should we offer here?", and remembers if the banner was dismissed on this device.
export function createInstall({ win = window, storage = null } = {}) {
  const nav = win.navigator || {};
  let deferred = null, installedNow = false;
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* a listener must never break installing */ } });
  const read = () => { try { return storage ? storage.getItem(DISMISS_KEY) : null; } catch { return null; } };
  const standalone = () => installedNow || (win.matchMedia && win.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true;

  win.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; emit(); });
  win.addEventListener("appinstalled", () => { deferred = null; installedNow = true; emit(); });

  return {
    state: () => installState({ device: detectDevice({ ua: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints }), standalone: standalone(), canPrompt: !!deferred, browser: iosBrowser(nav.userAgent) }),
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async install() {                       // only meaningful when state().kind === "prompt"
      if (!deferred) return "unavailable";
      const e = deferred; deferred = null; emit();
      try { await e.prompt(); const choice = await e.userChoice; return choice && choice.outcome || "dismissed"; } catch { return "dismissed"; }
    },
    bannerDismissed: () => read() === "1",
    dismissBanner() { try { storage && storage.setItem(DISMISS_KEY, "1"); } catch { /* blocked: the banner may come back */ } emit(); },
    // Ask the browser to keep this site's data (a browser may otherwise clear it when space is short or the site is unused).
    async requestPersistence() { try { return !!(nav.storage && nav.storage.persist && await nav.storage.persist()); } catch { return false; } },
  };
}
