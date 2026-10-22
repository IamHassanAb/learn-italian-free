// "Tu or Lei" drill: choose the right register for a person, and say the same thing politely or casually.
// Only clear-cut cases are used. In real life the other person's lead matters most: tu is returned in kind,
// and it is the older or more senior person who offers it ("diamoci del tu"). Sources: content/ledger/tu-lei.yaml.
import { pick } from "./util.js";

export const PEOPLE = [
  // tu: people you are close to, or your peers and children
  { who: "a friend", reg: "tu", why: "Friends use tu." },
  { who: "your flatmate", reg: "tu", why: "People you live with use tu." },
  { who: "a classmate your age", reg: "tu", why: "Peers use tu with each other." },
  { who: "your cousin", reg: "tu", why: "Family uses tu." },
  { who: "a child", reg: "tu", why: "Children are addressed with tu." },
  { who: "your partner", reg: "tu", why: "Partners use tu." },
  // Lei: strangers, people older than you, and formal roles
  { who: "your university professor", reg: "Lei", why: "Students address professors with Lei." },
  { who: "an older woman you do not know, on the bus", reg: "Lei", why: "Use Lei with older people you do not know, unless they offer tu." },
  { who: "the clerk at the town hall", reg: "Lei", why: "Use Lei with public officials, whatever their age." },
  { who: "a police officer asking for your documents", reg: "Lei", why: "Use Lei with officials." },
  { who: "an older man you have just met", reg: "Lei", why: "Use Lei with older people you have just met, until they say 'diamoci del tu'." },
  { who: "the secretary at the university office", reg: "Lei", why: "A formal office: use Lei." },
];

// The same message in both registers. Several spellings are accepted for the answer.
export const ACTIONS = [
  { ask: "Ask their name.", tu: ["Come ti chiami?"], lei: ["Come si chiama?"] },
  { ask: "Ask where they are from.", tu: ["Di dove sei?"], lei: ["Di dov'è?", "Di dove è?"] },
  { ask: "Ask how they are.", tu: ["Come stai?"], lei: ["Come sta?"] },
  { ask: "Ask if they speak English.", tu: ["Parli inglese?"], lei: ["Parla inglese?"] },
  { ask: "Ask if they can help you.", tu: ["Mi puoi aiutare?"], lei: ["Mi può aiutare?"] },
  { ask: "Ask if they can repeat that.", tu: ["Puoi ripetere?"], lei: ["Può ripetere?"] },
  { ask: "Ask if they understand.", tu: ["Capisci?"], lei: ["Capisce?"] },
  { ask: "Ask if they live here.", tu: ["Abiti qui?"], lei: ["Abita qui?"] },
  { ask: "Say 'Excuse me.'", tu: ["Scusa."], lei: ["Scusi."] },
  { ask: "Say 'Wait a moment.'", tu: ["Aspetta un attimo."], lei: ["Aspetti un attimo."] },
  { ask: "Ask if they have a minute.", tu: ["Hai un minuto?"], lei: ["Ha un minuto?"] },
  { ask: "Say 'You are very kind.'", tu: ["Sei molto gentile."], lei: ["È molto gentile."] },
];

export const REGISTER_MODES = ["mixed", "choose", "say it"];

export function registerQuestion(mode = "mixed", rnd = Math.random) {
  const m = mode === "mixed" ? (rnd() < 0.5 ? "choose" : "say it") : mode;
  const person = pick(PEOPLE, rnd);
  if (m === "choose") {
    return { kind: "register-choose", prompt: `You are talking to ${person.who}.`, hint: "tu or Lei?", choices: ["tu", "Lei"], answers: [person.reg], show: person.reg, speak: "", why: person.why };
  }
  const action = pick(ACTIONS, rnd), forms = person.reg === "tu" ? action.tu : action.lei;
  return { kind: "register-say", prompt: `${person.who[0].toUpperCase()}${person.who.slice(1)}. ${action.ask}`, hint: `Use ${person.reg}`, answers: forms, show: forms[0], speak: forms[0], why: person.why };
}
