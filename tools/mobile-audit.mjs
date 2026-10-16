// Mobile audit: opens every main screen at five phone sizes in headless Chrome and counts problems.
// Needs Node 18+, puppeteer-core and Chrome:  npm i puppeteer-core   then   node tools/mobile-audit.mjs [baseUrl] [shotsDir]
// Serve the built app first, e.g.  python -m http.server 8765 --directory docs
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:8765";
const SHOTS = process.argv[3] || "";
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEVICES = [["Android 360x640", 360, 640, 3], ["iPhone SE 320x568", 320, 568, 2], ["iPhone 390x844", 390, 844, 3], ["Android 412x915", 412, 915, 2.6], ["landscape 844x390", 844, 390, 3]];
const ROUTES = ["today", "review", "translate", "scenarios", "scenarios/scenario-bar", "more", "library", "library/pb-banking", "library/step3-grammar", "gaps", "settings", "retell", "drills", "search"];
const MAX_HEADER = 56;
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };

// runs inside the page
async function audit() {
  const MIN = 44;
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const out = { small: [], smallText: [], overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, header: 0, underBar: 0 };
  const tapSel = "button, a.btn, #tabs a, summary, select, input:not([type=hidden]):not([type=file]):not([type=checkbox]), textarea, .check, .iconbtn, .brand";
  for (const el of document.querySelectorAll(tapSel)) {
    if (!vis(el) || el.closest(".toast")) continue;
    const r = el.getBoundingClientRect();
    if (r.height < MIN - 0.5 || (r.width < MIN - 0.5 && el.tagName !== "INPUT")) out.small.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 18)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const el of document.querySelectorAll("input:not([type=checkbox]):not([type=range]):not([type=file]):not([type=hidden]), select, textarea"))
    if (vis(el) && parseFloat(getComputedStyle(el).fontSize) < 16) out.smallText.push(`${el.tagName.toLowerCase()}#${el.id} ${getComputedStyle(el).fontSize}`);
  const hdr = document.querySelector("header.top"); out.header = hdr ? Math.round(hdr.getBoundingClientRect().height) : 0;
  // Is the last piece of content reachable above any fixed bottom bar once the page has finished scrolling?
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const bars = [...document.querySelectorAll("#tabs, .actionbar")].filter(vis);
  const top = bars.length ? Math.min(...bars.map((b) => b.getBoundingClientRect().top)) : innerHeight;
  const leaves = [...document.querySelectorAll("#app *")].filter((e) => vis(e) && !e.children.length);
  const last = leaves.reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
  out.underBar = Math.max(0, Math.round(last - top));
  window.scrollTo(0, 0);
  return out;
}

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"], userDataDir: (process.env.TEMP || "/tmp") + "/chrome-audit-" + Date.now() });
const report = {};
for (const [name, w, h, dpr] of DEVICES) {
  const ctx = await b.createBrowserContext(), p = await ctx.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await p.setRequestInterception(true);
  p.on("request", (r) => {
    if (new URL(r.url()).host === "api.mymemory.translated.net") return r.respond({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ responseStatus: 200, responseData: { translatedText: "Dove si trova la farmacia?", match: 0.9 }, matches: [{ translation: "Dove si trova la farmacia?", match: 0.9 }, { translation: "Dov'è la farmacia?", match: 0.8 }] }) });
    r.continue();
  });
  report[name] = {};
  for (const route of ROUTES) {
    await p.goto(BASE + "/#/" + route, { waitUntil: "networkidle2" }); await new Promise((r) => setTimeout(r, 150));
    if (route === "translate") { await p.type("#tr-input", "Where is the pharmacy?"); await new Promise((r) => setTimeout(r, 1300)); }
    if (route === "review") { await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.startsWith("Start"))?.click()); await new Promise((r) => setTimeout(r, 200)); }
    if (route === "search") { const q = await p.$("#q"); if (q) { await q.type("farmacia"); await new Promise((r) => setTimeout(r, 300)); } }
    report[name][route] = await p.evaluate(audit);
    if (SHOTS && ["today", "translate", "review", "search"].includes(route)) await p.screenshot({ path: `${SHOTS}/m-${w}x${h}-${route}.png` });
  }
  await ctx.close();
}
await b.close();

let small = 0, text = 0, overflow = 0, under = 0, worstHeader = 0; const tally = {}, bad = [];
for (const [name, routes] of Object.entries(report)) for (const [route, a] of Object.entries(routes)) {
  small += a.small.length; text += a.smallText.length; if (a.overflowX) { overflow++; bad.push(`overflow: ${name} ${route}`); }
  if (a.underBar > 0) { under++; bad.push(`under bar ${a.underBar}px: ${name} ${route}`); }
  worstHeader = Math.max(worstHeader, a.header);
  for (const s of a.small) { const k = s.replace(/ \d+x\d+$/, ""); tally[k] = (tally[k] || 0) + 1; }
}
console.log(`screens checked: ${Object.keys(report).length} sizes x ${ROUTES.length} routes`);
console.log(`tap targets under 44px: ${small} | fields with text under 16px: ${text} | pages overflowing sideways: ${overflow} | screens with content under the bottom bar: ${under} | tallest header: ${worstHeader}px (limit ${MAX_HEADER})`);
if (small) console.log("most common small targets:\n  " + Object.entries(tally).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => `${v}x ${k}`).join("\n  "));
if (bad.length) console.log(bad.slice(0, 12).join("\n"));
process.exitCode = small || text || overflow || under || worstHeader > MAX_HEADER ? 1 : 0;
