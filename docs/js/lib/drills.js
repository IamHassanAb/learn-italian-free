import { numberToItalian, numberVariants } from "./numbers.js";
import { acceptable, everyday, official, digital } from "./clock.js";
import { WEEKDAYS, MONTHS, dateWords } from "./calendar.js";
import { norm, pick, shuffle } from "./util.js";
import { registerQuestion, REGISTER_MODES } from "./register.js";

// A question: {prompt, hint?, answers: [accepted spellings], show: preferred answer, speak: text to read aloud, kind}
export const NUMBER_RANGES = { "0-20": 20, "0-100": 100, "0-999": 999, "0-9999": 9999 };
const randInt = (max, rnd) => Math.floor(rnd() * (max + 1));

export function numberQuestion(max, rnd = Math.random, mode = "write") {
  let n = randInt(max, rnd);
  if (max > 100 && rnd() < 0.4) n = randInt(100, rnd);                    // keep the everyday range in the mix
  const word = numberToItalian(n);
  if (mode === "listen") return { kind: "number-listen", prompt: "Listen, then type the number in digits.", answers: [String(n)], show: String(n), speak: word, hint: word };
  return { kind: "number", prompt: String(n), hint: "Write it in Italian", answers: numberVariants(n), show: word, speak: word };
}

export function timeQuestion(rnd = Math.random, mode = "write") {
  for (;;) {
    const h = randInt(23, rnd), m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], rnd);
    const ev = everyday(h, m);
    if (!ev || (h === 0 && m !== 0)) continue;
    if (mode === "listen") return { kind: "time-listen", prompt: "Listen, then type the time as hh:mm.", answers: [digital(h, m)], show: digital(h, m), speak: ev, hint: ev };
    return { kind: "time", prompt: digital(h, m), hint: "Say it the everyday way: Sono le… / È l'una… (24-hour style is accepted too)", answers: acceptable(h, m), show: ev, speak: ev };
  }
}

export function calendarQuestion(kind, rnd = Math.random) {
  if (kind === "weekday") { const [it, en] = pick(WEEKDAYS, rnd); return { kind, prompt: en, hint: "Weekday in Italian", answers: [it], show: it, speak: it }; }
  if (kind === "month") { const [it, en] = pick(MONTHS, rnd); return { kind, prompt: en, hint: "Month in Italian", answers: [it], show: it, speak: it }; }
  const mi = randInt(11, rnd), day = 1 + randInt([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mi] - 1, rnd);
  const w = dateWords(day, mi);
  return { kind: "date", prompt: `${day} ${MONTHS[mi][1]}`, hint: "Say the date: il primo… / il sette… / l'otto…", answers: [w], show: w, speak: w };
}

export const DRILLS = {
  numbers: { title: "Numbers", blurb: "Type the number in Italian.", options: Object.keys(NUMBER_RANGES), make: (opt, rnd) => numberQuestion(NUMBER_RANGES[opt], rnd, "write") },
  "numbers-listen": { title: "Numbers by ear", blurb: "Listen and type the digits. Needs an Italian voice on your device.", options: Object.keys(NUMBER_RANGES), needsVoice: true, make: (opt, rnd) => numberQuestion(NUMBER_RANGES[opt], rnd, "listen") },
  time: { title: "Telling the time", blurb: "Digital time to spoken Italian.", options: ["write"], make: (_o, rnd) => timeQuestion(rnd, "write") },
  "time-listen": { title: "Time by ear", blurb: "Listen and type hh:mm.", options: ["listen"], needsVoice: true, make: (_o, rnd) => timeQuestion(rnd, "listen") },
  weekdays: { title: "Days of the week", blurb: "English to Italian.", options: ["weekday"], make: (_o, rnd) => calendarQuestion("weekday", rnd) },
  months: { title: "Months", blurb: "English to Italian.", options: ["month"], make: (_o, rnd) => calendarQuestion("month", rnd) },
  dates: { title: "Dates", blurb: "Say the date out loud in Italian.", options: ["date"], make: (_o, rnd) => calendarQuestion("date", rnd) },
  "tu-lei": { title: "Tu or Lei", blurb: "Pick the right register for the person, or say the same thing politely and casually.", options: ["choose", "mixed", "say it"], make: (opt, rnd) => registerQuestion(opt, rnd) },
};

export function makeSession(drillId, option, count = 10, rnd = Math.random) {
  const d = DRILLS[drillId], seen = new Set(), out = [];
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const q = d.make(option, rnd);
    if (!seen.has(q.prompt + "|" + q.show)) { seen.add(q.prompt + "|" + q.show); out.push(q); }
  }
  return out;
}
// Topic drills (colours, ...) are generated from the content and added at start-up.
export function registerDrills(defs) { Object.assign(DRILLS, defs); }
export const check = (q, input) => q.answers.some(a => norm(a) === norm(input));
