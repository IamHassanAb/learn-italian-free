import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

// Every source file must at least parse and load. (A stray bracket once stopped the whole app from starting.)
const root = new URL("../js/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : n.endsWith(".js") && files.push(p); } })(decodeURIComponent(root));
test(`all ${files.length} app modules load`, async () => {
  assert.ok(files.length > 20);
  for (const f of files) {
    const shown = relative(decodeURIComponent(root), f);
    try { await import(pathToFileURL(f).href); } catch (e) { if (e instanceof SyntaxError) assert.fail(`${shown}: ${e.message}`); /* main.js starts the app and needs a browser: only syntax errors matter here */ }
  }
});
