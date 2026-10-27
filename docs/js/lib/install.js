// Decides how to offer "install this app" on each kind of device. Pure functions, unit-tested.
//   Android and desktop Chrome/Edge: the browser fires an install event; one tap installs.
//   iPhone and iPad: there is no install button in Safari, so we show the Share steps.
//   Android browsers that have not offered the install event yet (or never do): show the menu steps.

export function detectDevice({ ua = "", platform = "", maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)) return "ipad";   // iPadOS Safari pretends to be a Mac
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

// Chrome, Firefox and Edge on iOS all say so in the user agent; plain Safari does not.
export const iosBrowser = (ua = "") => (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "other" : "safari");

const IOS_STEPS = {
  iphone: ["Tap the Share button (the square with an arrow) at the bottom of Safari.", "Scroll down and tap Add to Home Screen.", "Tap Add. The icon appears on your home screen."],
  ipad: ["Tap the Share button (the square with an arrow) at the top right of Safari.", "Tap Add to Home Screen.", "Tap Add. The icon appears on your home screen."],
};
const IOS_OTHER = ["Tap the Share icon next to the address bar.", "Tap Add to Home Screen, then Add.", "If you do not see it, open this page in Safari and use Share, then Add to Home Screen."];
const ANDROID_STEPS = ["Open the browser menu (the three dots).", "Tap Install app, or Add to Home screen.", "Tap Install. The icon appears with your other apps."];

// -> {kind: "installed" | "prompt" | "steps" | "none", device, steps?}
export function installState({ device = "desktop", standalone = false, canPrompt = false, browser = "safari" } = {}) {
  if (standalone) return { kind: "installed", device };
  if (canPrompt) return { kind: "prompt", device };
  if (device === "iphone" || device === "ipad") return { kind: "steps", device, steps: browser === "other" ? IOS_OTHER : IOS_STEPS[device] };
  if (device === "android") return { kind: "steps", device, steps: ANDROID_STEPS };
  return { kind: "none", device };                      // desktop without an install event: nothing to offer
}

// iPhone and iPad keep the installed app's data apart from Safari's, so say so.
export const separateStorage = (device) => device === "iphone" || device === "ipad";
