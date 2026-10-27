// DOM helpers and the generic renderer for content parts. Text is always inserted as text nodes, never as HTML.
import { speakable } from "./lib/util.js";
import { withArticle } from "./lib/vocabdrills.js";

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

// **bold**, *italic*, [[res:id|text]] -> nodes
export function inline(str, resources = {}) {
  const frag = document.createDocumentFragment();
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[res:[^|\]]+\|[^\]]*\]\])/g;
  String(str ?? "").split(re).forEach((part) => {
    if (!part) return;
    let m;
    if ((m = part.match(/^\*\*([^*]+)\*\*$/))) frag.append(h("strong", null, m[1]));
    else if ((m = part.match(/^\*([^*]+)\*$/))) frag.append(h("em", null, m[1]));
    else if ((m = part.match(/^\[\[res:([^|\]]+)\|([^\]]*)\]\]$/))) {
      const r = resources[m[1]];
      frag.append(r ? h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, m[2]) : m[2]);
    } else frag.append(part);
  });
  return frag;
}

// "**Barista:** Buongiorno" -> {who, text, aside}
export function parseLine(s) {
  const m = String(s).match(/^(?:\*([^*]+)\*\s+)?\*\*([^*]+?):\*\*\s*(.*)$/);
  if (!m) return { who: null, text: s, aside: null };
  return { who: m[2], text: m[3], aside: m[1] || null };
}

export function speakBtn(ctx, text, label = "Listen") {
  if (!ctx.speech.available()) return null;
  return h("button", { class: "speak", type: "button", "aria-label": `${label}: ${speakable(text)}`, title: label, onClick: (e) => { e.stopPropagation(); ctx.speech.speak(text, ctx.store.state.settings.rate); } }, "▶");
}

function table(ctx, cols, rows, speakCol = -1) {
  const head = cols ? h("thead", null, h("tr", null, cols.map(c => h("th", null, inline(c, ctx.resources))))) : null;
  const body = h("tbody", null, rows.map(r => h("tr", null, r.map((c, i) => h("td", null,
    i === speakCol ? h("div", { class: "row" }, speakBtn(ctx, c), h("span", null, inline(c, ctx.resources))) : inline(c, ctx.resources))))));
  return h("div", { class: "tablewrap" }, h("table", null, head, body));
}

export function renderPart(ctx, p) {
  const out = [];
  if (p.title && p.type !== "writing-task") out.push(h("h3", null, inline(p.title, ctx.resources)));
  switch (p.type) {
    case "text": out.push(h("p", { class: p.small ? "muted small" : "" }, inline(p.text, ctx.resources))); break;
    case "bullets": out.push(h("ul", null, p.items.map(i => h("li", null, inline(i, ctx.resources))))); break;
    case "dialogue": out.push(h("div", null, p.lines.map(l => { const x = parseLine(l); return h("div", { class: "line" }, h("span", { class: "who" }, x.who || ""), h("span", { class: "txt" }, inline(x.text, ctx.resources)), speakBtn(ctx, x.text)); }))); break;
    case "table": out.push(table(ctx, p.columns, p.rows)); break;
    case "vocab": {
      if (!p.items.some((i) => i.swatch || i.forms || i.group)) { out.push(table(ctx, p.header === false ? null : ["Italiano", "English"], p.items.map(i => [withArticle(i), i.en]), 0)); break; }
      // words with a colour sample and/or their other forms (feminine, plural)
      const hasForms = p.items.some((i) => i.forms);
      const formsText = (f) => { if (!f) return ""; const u = [...new Set([f.m, f.f, f.mp, f.fp].filter(Boolean))]; return u.length === 1 ? "never changes" : u.join(" · "); };
      out.push(h("div", { class: "tablewrap" }, h("table", null,
        h("thead", null, h("tr", null, h("th", null, "Italiano"), h("th", null, "English"), hasForms ? h("th", null, "Forms") : null)),
        h("tbody", null, p.items.flatMap((i, n) => [
          i.group && i.group !== (p.items[n - 1] || {}).group ? h("tr", null, h("th", { colspan: hasForms ? 3 : 2 }, i.group)) : null,
          h("tr", null,
            h("td", null, h("div", { class: "row" }, i.swatch ? h("span", { class: "dot", style: `background:${i.swatch}`, "aria-hidden": "true" }) : null, speakBtn(ctx, withArticle(i)), h("span", null, withArticle(i)))),
            h("td", null, i.en), hasForms ? h("td", { class: "small" }, formsText(i.forms)) : null)])))));
      break;
    }
    case "phrases": { const ex = p.items.some(i => i.example); out.push(table(ctx, ex ? ["Phrase", "English", "Example"] : ["Phrase", "English"], p.items.map(i => ex ? [i.it, i.en, i.example || ""] : [i.it, i.en]), 0)); break; }
    case "writing-task": out.push(h("details", null, h("summary", null, inline(p.title, ctx.resources)), h("p", null, inline(p.prompt, ctx.resources)), h("p", { class: "muted small" }, "Model answer:"), h("p", null, inline(p.model, ctx.resources)))); break;
    default: break;   // template blanks are for the printed PDFs
  }
  return out;
}

export function renderModule(ctx, m) {
  const out = [], parts = m.parts;
  for (let i = 0; i < parts.length;) {
    if (parts[i].type === "lookup-row") {
      const rows = [];
      while (i < parts.length && parts[i].type === "lookup-row") { rows.push([parts[i].when, parts[i].answer]); i++; }
      out.push(h("div", { class: "lookup" }, rows.map(([when, answer]) => h("div", { class: "card flat" }, h("h3", null, inline(when, ctx.resources)), h("p", null, inline(answer, ctx.resources))))));
    } else { out.push(...renderPart(ctx, parts[i])); i++; }
  }
  return out;
}

let toastTimer;
export function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast", role: "status" }, msg); document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}

// Replace a container's contents. Flattens arrays and skips null/false, so views can pass lists and optional parts.
export function mount(root, ...kids) {
  const flat = [];
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else flat.push(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  root.replaceChildren(...flat);
}
