import test from "node:test";
import assert from "node:assert/strict";
import { detectDevice, iosBrowser, installState, separateStorage } from "../js/lib/install.js";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1",
  ipadMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

test("devices: iPhone, iPad (also when it pretends to be a Mac), Android, desktop", () => {
  assert.equal(detectDevice({ ua: UA.iphone }), "iphone");
  assert.equal(detectDevice({ ua: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)" }), "ipad");
  assert.equal(detectDevice({ ua: UA.ipadMac, platform: "MacIntel", maxTouchPoints: 5 }), "ipad");
  assert.equal(detectDevice({ ua: UA.ipadMac, platform: "MacIntel", maxTouchPoints: 0 }), "desktop");     // a real Mac
  assert.equal(detectDevice({ ua: UA.android }), "android");
  assert.equal(detectDevice({ ua: UA.windows }), "desktop");
  assert.equal(detectDevice(), "desktop");
});
test("iOS browser: Safari or another one", () => { assert.equal(iosBrowser(UA.iphone), "safari"); assert.equal(iosBrowser(UA.chromeIos), "other"); });
test("already installed: nothing to offer", () => {
  for (const device of ["iphone", "ipad", "android", "desktop"]) assert.equal(installState({ device, standalone: true, canPrompt: true }).kind, "installed");
});
test("one-tap install wherever the browser offers it", () => {
  for (const device of ["android", "desktop"]) assert.equal(installState({ device, canPrompt: true }).kind, "prompt");
});
test("iPhone and iPad get the Share steps (different wording per device and browser)", () => {
  const a = installState({ device: "iphone" }), b = installState({ device: "ipad" }), c = installState({ device: "iphone", browser: "other" });
  for (const x of [a, b, c]) { assert.equal(x.kind, "steps"); assert.ok(x.steps.length >= 3 && x.steps.some((t) => /Add to Home Screen/.test(t))); }
  assert.match(a.steps[0], /bottom/); assert.match(b.steps[0], /top right/); assert.match(c.steps[0], /address bar/);
});
test("Android without the install event gets the menu steps; desktop without it gets nothing", () => {
  const a = installState({ device: "android" }); assert.equal(a.kind, "steps"); assert.ok(a.steps.some((t) => /Install app/.test(t)));
  assert.equal(installState({ device: "desktop" }).kind, "none");
});
test("only iPhone and iPad warn about separate storage", () => {
  assert.equal(separateStorage("iphone"), true); assert.equal(separateStorage("ipad"), true); assert.equal(separateStorage("android"), false); assert.equal(separateStorage("desktop"), false);
});
