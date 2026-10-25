// État de l'appli, sauvegardé dans le navigateur du téléphone.
import { defaultStart } from './program.js';

const KEY = 'personnal-trainer:v1';

export function defaults() {
  return {
    settings: {
      sessionsPerWeek: 4,
      startDate: defaultStart(),
      times: { midi: '12:15', soir: '18:00', weekend: '10:00' },
      sound: true,
      vibrate: true,
      notifications: false,
      reminderMinutes: 30,
      access: { escalade: false, muscu: false },
    },
    adapt: { escalade: 1, muscu: 1, cardio: 1, gradeIdx: 3 },
    logs: [],
    moves: {},
    checks: {},
    express: {},
    benchmarks: [],
  };
}

export function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return {
      ...base,
      ...s,
      settings: {
        ...base.settings,
        ...s.settings,
        times: { ...base.settings.times, ...s.settings?.times },
        access: { ...base.settings.access, ...s.settings?.access },
      },
      adapt: { ...base.adapt, ...s.adapt },
    };
  } catch {
    return base;
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* stockage indisponible */ }
}
