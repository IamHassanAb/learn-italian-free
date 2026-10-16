import { h, mount, toast, speakBtn } from "../ui.js";
import { guessLang, googleTranslateLink } from "../lib/translate.js";

const SITUATIONS = ["café", "shop", "home", "university", "transport", "health", "friends", "other"];
const DIRS = [["auto", "Auto"], ["en-it", "EN → IT"], ["it-en", "IT → EN"]];

// Translate while you talk, then log the line. Machine translation can be wrong, so every logged line starts "unchecked".
export function translateView(ctx) {
  const { store, translator } = ctx;
  const root = h("div", { class: "stack" });
  let dir = store.state.settings.translateDir || "auto", timer = null, seq = 0, current = null, saving = false, situation = "";

  const input = h("textarea", { id: "tr-input", rows: 3, placeholder: "Type English or Italian…", autocapitalize: "sentences", spellcheck: "false", "aria-label": "Text to translate" });
  const results = h("div", { class: "stack", "aria-live": "polite" });
  const form = h("div");

  const pair = (text) => {
    if (dir === "en-it") return ["en", "it"];
    if (dir === "it-en") return ["it", "en"];
    const g = guessLang(text) || "en"; return [g, g === "en" ? "it" : "en"];
  };

  function paintDirections() {
    dirRow.replaceChildren(...DIRS.map(([v, label]) => h("button", { class: "chip", type: "button", "aria-pressed": String(dir === v), onClick: () => { dir = v; store.setting("translateDir", v); paintDirections(); schedule(0); } }, label)));
  }
  const dirRow = h("div", { class: "row", role: "group", "aria-label": "Direction" });

  function schedule(ms = 700) { clearTimeout(timer); timer = setTimeout(run, ms); }

  async function run() {
    const text = input.value.trim(); const my = ++seq;
    saving = false; form.replaceChildren();
    if (text.length < 2) { current = null; results.replaceChildren(); return; }
    const [from, to] = pair(text);
    results.replaceChildren(h("p", { class: "muted" }, "Translating…"));
    try {
      const r = await translator.translate(text, from, to);
      if (my !== seq) return;
      current = { text, from, to, out: r.text, provider: r.provider, alternatives: r.alternatives };
      paintResult();
    } catch (e) {
      if (my !== seq) return;
      current = null;
      const msg = e.code === "quota" ? "The free daily translation limit is used up. Add your email in Settings to raise it, or use Google Translate below."
        : e instanceof TypeError ? "No connection right now. Try again when you are online, or use Google Translate below."
        : e.message || "Translation failed.";
      results.replaceChildren(h("p", { class: "bad", role: "alert" }, msg), h("a", { class: "btn", href: googleTranslateLink(text, from, to), target: "_blank", rel: "noopener noreferrer" }, "Open in Google Translate"));
    }
  }

  const italianOf = (c) => (c.to === "it" ? c.out : c.text);
  const englishOf = (c) => (c.to === "it" ? c.text : c.out);

  function paintResult() {
    const c = current; if (!c) return;
    const copy = () => (navigator.clipboard ? navigator.clipboard.writeText(c.out).then(() => toast("Copied.")).catch(() => toast("Could not copy.")) : toast("Could not copy."));
    const limit = translator.limit(), used = translator.usedToday();
    results.replaceChildren(
      h("section", { class: "card stack" },
        h("div", { class: "row between" }, h("span", { class: "eyebrow" }, `${c.from.toUpperCase()} → ${c.to.toUpperCase()}`), h("span", { class: "chip static" }, c.provider === "chrome" ? "On this device" : "MyMemory")),
        h("div", { class: "flash answer" }, c.out),
        h("div", { class: "row" },
          c.to === "it" ? speakBtn(ctx, c.out, "Listen") : null,
          h("button", { class: "btn small", type: "button", onClick: copy }, "Copy"),
          h("a", { class: "btn small", href: googleTranslateLink(c.text, c.from, c.to), target: "_blank", rel: "noopener noreferrer" }, "Check in Google Translate"),
          h("button", { class: "btn warm", type: "button", onClick: () => { saving = true; paintForm(); form.scrollIntoView({ block: "center" }); } }, "Save to log")),
        c.alternatives.length ? h("div", { class: "stack" }, h("p", { class: "muted small" }, "Other possible translations (from other translators):"),
          c.alternatives.map((a) => h("div", { class: "row between" }, h("span", null, a.text), h("button", { class: "btn small", type: "button", onClick: () => { c.out = a.text; c.alternatives = c.alternatives.filter((x) => x !== a); paintResult(); } }, "Use this")))) : null,
        h("p", { class: "muted small" }, "Machine translation can be wrong. Check anything important with a local, then mark it checked in the log."),
        c.provider === "mymemory" ? h("p", { class: "muted small" }, `Your text is sent to MyMemory (translated.net) to translate it. About ${used.toLocaleString()} of ${limit.toLocaleString()} characters used today (this device's estimate).`) : h("p", { class: "muted small" }, "Translated on this device. Nothing was sent anywhere.")));
    if (saving) paintForm();
  }

  function paintForm() {
    const c = current; if (!c) return;
    const itBox = h("textarea", { id: "log-it", rows: 2, "aria-label": "Italian" }, italianOf(c));
    const enBox = h("input", { type: "text", id: "log-en", value: englishOf(c), "aria-label": "English meaning" });
    const note = h("input", { type: "text", id: "log-note", placeholder: "What went wrong, or the correction (optional)", "aria-label": "Note" });
    const kind = h("select", { id: "log-kind", "aria-label": "What was it" }, h("option", { value: "wanted" }, "I wanted to say this"), h("option", { value: "heard" }, "Someone said this to me"), h("option", { value: "corrected" }, "A local corrected me"));
    const topics = (ctx.content.modules["step3-grammar"] || { parts: [] }).parts.filter((p) => p.type === "lookup-row");
    const tag = h("select", { id: "log-tag", "aria-label": "Grammar topic" }, h("option", { value: "" }, "Grammar topic (optional)"), topics.map((t) => h("option", { value: t.id }, t.when)));
    const chips = h("div", { class: "row", role: "group", "aria-label": "Situation" });
    const paintChips = () => chips.replaceChildren(...SITUATIONS.map((x) => h("button", { class: "chip", type: "button", "aria-pressed": String(situation === x), onClick: () => { situation = situation === x ? "" : x; paintChips(); } }, x)));
    paintChips();
    const save = () => {
      if (!itBox.value.trim() || !enBox.value.trim()) { toast("The Italian and the English both need text."); return; }
      store.addGap({ it: itBox.value.trim(), en: enBox.value.trim(), tag: tag.value || null, ctx: situation || null, kind: kind.value, note: note.value.trim() || null, src: "translate", provider: c.provider, checked: false });
      toast("Logged. It is now a flashcard, marked unchecked."); saving = false; form.replaceChildren(); input.value = ""; current = null; results.replaceChildren(); input.focus();
    };
    form.replaceChildren(h("section", { class: "card stack" }, h("h2", null, "Save to the conversation log"),
      h("p", { class: "muted small" }, "Edit the Italian if a local gave you a better version. That is the one worth learning."),
      h("div", { class: "field" }, h("label", { for: "log-it" }, "Italian"), itBox),
      h("div", { class: "field" }, h("label", { for: "log-en" }, "English"), enBox),
      h("div", { class: "field" }, h("label", null, "Situation"), chips),
      h("div", { class: "field" }, h("label", { for: "log-kind" }, "What was it?"), kind),
      h("div", { class: "field" }, h("label", { for: "log-note" }, "Note"), note),
      topics.length ? h("div", { class: "field" }, h("label", { for: "log-tag" }, "Grammar topic"), tag) : null,
      h("div", { class: "row" }, h("button", { class: "btn warm", type: "button", onClick: save }, "Save"), h("button", { class: "btn ghost", type: "button", onClick: () => { saving = false; form.replaceChildren(); } }, "Cancel"))));
  }

  input.addEventListener("input", () => schedule());
  paintDirections();
  mount(root,
    h("div", null, h("p", { class: "eyebrow" }, "Translate"), h("h1", null, "Translate & log"), h("p", { class: "muted" }, "Type what you want to say, or what you heard. Save the good ones to your log and they become flashcards.")),
    h("section", { class: "card stack" }, dirRow, input,
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => schedule(0) }, "Translate now"), h("button", { class: "btn ghost", type: "button", onClick: () => { input.value = ""; schedule(0); input.focus(); } }, "Clear"))),
    results, form,
    h("a", { class: "btn ghost", href: "#/gaps" }, "Open the conversation log"));
  root.cleanup = () => { clearTimeout(timer); seq++; };
  return root;
}
