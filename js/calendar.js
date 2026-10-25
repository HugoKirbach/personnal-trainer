// Rappels via l'agenda : lien Google Agenda récurrent et export .ics.
import { buildSession, mondayOf, weekSessions } from './program.js';

const APP_URL = 'https://hugokirbach.github.io/personnal-trainer/';
const pad = (n) => String(n).padStart(2, '0');

function durationMinutes(d) {
  const m = d.match(/(\d+)h(\d+)?/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  return Number(d.match(/\d+/)?.[0] || 60);
}

function stamp(date, time, addMin = 0) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m + addMin);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

// Événement hebdomadaire récurrent pour un créneau du programme.
export function googleLink(slot, state) {
  const first = mondayOf(new Date());
  first.setDate(first.getDate() + slot.day);
  if (first < new Date(new Date().toDateString())) first.setDate(first.getDate() + 7);
  const time = state.settings.times[slot.day >= 5 ? 'weekend' : slot.slot];
  const s = buildSession(slot.key, first, state);
  const dur = durationMinutes(s.duration);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🏋️ ${s.title}`,
    dates: `${stamp(first, time)}/${stamp(first, time, dur)}`,
    details: `Le détail de la séance est dans l'appli : ${APP_URL}`,
    recur: 'RRULE:FREQ=WEEKLY',
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function icsText(s) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function downloadIcs(state, weeks = 4) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//personnal-trainer//FR', 'CALSCALE:GREGORIAN'];
  const monday = mondayOf(new Date());
  const now = stamp(new Date(), `${new Date().getHours()}:${new Date().getMinutes()}`);
  for (let w = 0; w < weeks; w++) {
    const m = new Date(monday);
    m.setDate(m.getDate() + w * 7);
    weekSessions(m, state).forEach((s) => {
      const [y, mo, d] = s.date.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      if (date < new Date(new Date().toDateString())) return;
      const desc = s.exercises.map((e) => `• ${e.name} : ${e.detail}`).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${s.date}-${s.index}@personnal-trainer`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(date, s.time)}`,
        `DTEND:${stamp(date, s.time, durationMinutes(s.duration))}`,
        `SUMMARY:${icsText(`🏋️ ${s.title}`)}`,
        `DESCRIPTION:${icsText(`Semaine ${s.week} · ${s.phase.name}\n${desc}\n${APP_URL}`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(s.title)}`, `TRIGGER:-PT${state.settings.reminderMinutes}M`, 'END:VALARM',
        'END:VEVENT',
      );
    });
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'programme-sport.ics' });
  a.click();
}
