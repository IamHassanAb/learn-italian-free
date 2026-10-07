import { speakable } from "./util.js";
// Browser text-to-speech with an Italian voice. Reports unavailable when the device has none.
export function createSpeech(win) {
  const synth = win && win.speechSynthesis;
  let voices = [];
  const load = () => { voices = synth ? synth.getVoices().filter(v => /^it([-_]|$)/i.test(v.lang)) : []; };
  if (synth) { load(); synth.addEventListener && synth.addEventListener("voiceschanged", load); }
  return {
    available: () => { load(); return !!synth && voices.length > 0; },
    speak(text, rate = 0.9) {
      if (!synth) return false;
      load();
      if (!voices.length) return false;
      synth.cancel();
      const u = new win.SpeechSynthesisUtterance(speakable(text));
      u.lang = "it-IT"; u.voice = voices.find(v => v.localService) || voices[0]; u.rate = rate;
      synth.speak(u); return true;
    },
    stop() { if (synth) synth.cancel(); },
  };
}
