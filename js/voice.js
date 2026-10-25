// Annonces vocales de la séance guidée (synthèse vocale du téléphone, en français).
const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voice = null;

function pickVoice() {
  const list = speechSynthesis.getVoices();
  voice = list.find((v) => v.lang === 'fr-FR' && /google/i.test(v.name))
    || list.find((v) => v.lang?.toLowerCase().startsWith('fr')) || null;
}
if (hasSpeech) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

// Rend le texte de l'appli agréable à l'oral : « 1 min 30 » → « 1 minute 30 », « 2/4 » → « 2 sur 4 ».
export function speakable(text) {
  return String(text)
    .replace(/\b30\/30\b/g, 'trente-trente')
    .replace(/(\d+) min (\d+)/g, '$1 minute $2')
    .replace(/(\d+) min\b/g, (m, n) => `${n} minute${n > 1 ? 's' : ''}`)
    .replace(/(\d+) s\b/g, (m, n) => `${n} seconde${n > 1 ? 's' : ''}`)
    .replace(/(\d+)\skg\b/g, (m, n) => `${n} kilo${n > 1 ? 's' : ''}`)
    .replace(/(\d+)\/(\d+)/g, '$1 sur $2')
    .replace(/×/g, 'fois')
    .replace(/ · /g, '. ')
    .replace(/[()]/g, ', ');
}

export function speak(text) {
  if (!hasSpeech) return;
  if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = 'fr-FR';
  if (voice) u.voice = voice;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (hasSpeech) speechSynthesis.cancel();
}
