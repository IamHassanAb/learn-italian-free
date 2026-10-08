import { h, renderModule, toast, mount } from "../ui.js";
import { localDate } from "../lib/util.js";

const SECONDS = 90;

// "Retell it in four sentences": the frame comes from content (module step2-retell); this view adds a timer
// and a shortcut to the Gaps log.
export function retellView(ctx) {
  const m = ctx.content.modules["step2-retell"], store = ctx.store, today = localDate();
  const root = h("div", { class: "stack" });
  let left = SECONDS, timer = null;

  const clock = h("div", { class: "flash", role: "timer", "aria-live": "off" }, fmt(left));
  const startBtn = h("button", { class: "btn warm", type: "button", onClick: toggle }, "Start the timer");
  function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  function stop() { clearInterval(timer); timer = null; startBtn.textContent = left === 0 ? "Start again" : "Resume"; }
  function toggle() {
    if (timer) return stop();
    if (left === 0) left = SECONDS;
    startBtn.textContent = "Pause";
    timer = setInterval(() => {
      left = Math.max(0, left - 1); clock.textContent = fmt(left);
      if (left === 0) { stop(); toast("Time. Close the page and say it again, or move on."); }
    }, 1000);
  }
  function reset() { clearInterval(timer); timer = null; left = SECONDS; clock.textContent = fmt(left); startBtn.textContent = "Start the timer"; }

  const done = store.day(today).retells || 0;
  mount(root,
    h("a", { class: "btn ghost small", href: "#/today" }, "← Today"),
    h("div", null, h("p", { class: "eyebrow" }, "Read with audio · after the story"), h("h1", null, m ? m.title : "Retell it")),
    m ? renderModule(ctx, m) : h("p", { class: "muted" }, "The retell guide is missing from the content."),
    h("section", { class: "card stack" }, h("h2", null, "Say it out loud"),
      h("p", { class: "muted small" }, "Close the story first. Then talk until the timer ends."),
      h("div", { class: "row" }, clock),
      h("div", { class: "row" }, startBtn, h("button", { class: "btn ghost", type: "button", onClick: reset }, "Reset"))),
    h("section", { class: "card stack" }, h("h2", null, "When you have finished"),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onClick: () => { store.addRetell(today); toast("Logged. That counts for today."); ctx.refresh(); } }, "I retold it"),
        h("a", { class: "btn", href: "#/gaps" }, "Log what I missed")),
      done ? h("p", { class: "muted small" }, `Retellings today: ${done}`) : null));
  root.cleanup = () => { clearInterval(timer); };
  return root;
}
