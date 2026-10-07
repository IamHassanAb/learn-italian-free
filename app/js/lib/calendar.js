import { numberToItalian } from "./numbers.js";
// Indexed like Date#getDay(): 0 = Sunday.
export const WEEKDAYS = [["domenica", "Sunday"], ["lunedì", "Monday"], ["martedì", "Tuesday"], ["mercoledì", "Wednesday"], ["giovedì", "Thursday"], ["venerdì", "Friday"], ["sabato", "Saturday"]];
export const MONTHS = [["gennaio", "January"], ["febbraio", "February"], ["marzo", "March"], ["aprile", "April"], ["maggio", "May"], ["giugno", "June"], ["luglio", "July"], ["agosto", "August"], ["settembre", "September"], ["ottobre", "October"], ["novembre", "November"], ["dicembre", "December"]];
// il primo ottobre / il sette ottobre / l'otto ottobre / l'undici ottobre
export function dateWords(day, monthIdx) {
  const m = MONTHS[monthIdx][0];
  if (day === 1) return `il primo ${m}`;
  const n = numberToItalian(day);
  return /^[aeiou]/.test(n) ? `l'${n} ${m}` : `il ${n} ${m}`;
}
export function longDate(d) { return `${WEEKDAYS[d.getDay()][0]} ${d.getDate()} ${MONTHS[d.getMonth()][0]}`; }
