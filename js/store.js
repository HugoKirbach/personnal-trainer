// État de l'appli, sauvegardé dans le navigateur du téléphone (et en ligne si un compte est connecté).
import { defaultStart } from './program.js';

const KEY = 'personnal-trainer:v1';
const listeners = new Set();

export function defaults() {
  return {
    settings: {
      sessionsPerWeek: 4,
      startDate: defaultStart(),
      times: { midi: '12:15', soir: '18:00', weekend: '10:00' },
      sound: true,
      vibrate: true,
      voice: true,
      notifications: false,
      reminderMinutes: 30,
      access: { escalade: false, muscu: false, course: true },
      goal: null,
    },
    adapt: { escalade: 1, muscu: 1, cardio: 1, gradeIdx: 3 },
    logs: [],
    moves: {},
    checks: {},
    express: {},
    benchmarks: [],
    lifts: {},
    pains: [],
    climbs: [],
    projects: [],
    forms: {},
    slots: {},
    swaps: {},
    durations: {},
    updatedAt: 0,
  };
}

// Complète un état ancien, importé ou venant d'un autre appareil avec les valeurs par défaut.
export function normalize(s) {
  const base = defaults();
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
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch {
    return defaults();
  }
}

// touch : false quand l'état vient du compte en ligne (ce n'est pas une modification locale).
// updatedAt ne recule jamais, même si l'horloge d'un autre téléphone était en avance.
export function save(state, { touch = true } = {}) {
  if (touch) state.updatedAt = Math.max(Date.now(), (state.updatedAt || 0) + 1);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* stockage indisponible */ }
  listeners.forEach((fn) => fn(state));
}

export function onSave(fn) {
  listeners.add(fn);
}
