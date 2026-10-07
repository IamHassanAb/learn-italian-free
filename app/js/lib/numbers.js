// Italian number words, 0 to 99,999. Rules checked against published sources (see content/ledger/numbers.yaml):
// tens drop their final vowel before uno/otto; a final "tre" in a compound takes an accent (ventitré);
// mille becomes -mila from 2,000.
const UNITS = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS = { 2: "venti", 3: "trenta", 4: "quaranta", 5: "cinquanta", 6: "sessanta", 7: "settanta", 8: "ottanta", 9: "novanta" };

function below100(n) {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10), u = n % 10;
  let w = TENS[t];
  if (u === 0) return w;
  if (u === 1 || u === 8) w = w.slice(0, -1);
  return w + UNITS[u];
}
function below1000(n, elide = true) {
  const h = Math.floor(n / 100), r = n % 100;
  let w = "";
  if (h) w = h === 1 ? "cento" : UNITS[h] + "cento";
  if (!r) return w;
  const rest = below100(r);
  if (elide && h && r >= 80 && r < 90) return w.slice(0, -1) + rest;     // centottanta
  return w + rest;
}
function plain(n) {
  if (n < 1000) return n === 0 ? "zero" : below1000(n);
  const th = Math.floor(n / 1000), r = n % 1000;
  const head = th === 1 ? "mille" : below1000(th) + "mila";
  return head + (r ? below1000(r) : "");
}
const accent = (w, n) => (n > 3 && w.endsWith("tre") ? w.slice(0, -3) + "tré" : w);

export function numberToItalian(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99999) throw new RangeError("0 to 99999 only");
  return accent(plain(n), n);
}
// Other spellings accepted when checking an answer (the preferred form comes first):
// the hundreds may keep or drop their final o before a vowel (centootto / centotto, centoottanta / centottanta).
export function numberVariants(n) {
  const out = new Set([numberToItalian(n)]);
  const th = Math.floor(n / 1000), tail = n % 1000, r = tail % 100;
  if (tail >= 100 && r) {
    const head = th ? (th === 1 ? "mille" : below1000(th) + "mila") : "";
    const hundreds = below1000(tail - r), rest = below100(r);
    out.add(accent(head + hundreds + rest, n));
    if (/^[aeiou]/.test(rest)) out.add(accent(head + hundreds.slice(0, -1) + rest, n));
  }
  return [...out];
}
