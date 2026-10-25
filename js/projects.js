// Projets : voies et blocs travaillés sur plusieurs séances (essais, point haut, enchaînement).
// state.projects = [{ id, name, kind, grade, place, notes, created, status, sent, log: { [date]: { tries, high } } }]
import { GRADES, recentMax } from './program.js';

export const PROJECT_STATUS = { actif: 'En cours', enchaine: 'Enchaîné', abandonne: 'Mis de côté' };
// Point haut atteint, en part de la voie ou du bloc.
export const HIGHS = [
  { value: 25, label: 'Début' },
  { value: 50, label: 'Moitié' },
  { value: 75, label: 'Trois quarts' },
  { value: 90, label: 'Dernier mouvement' },
];
export const MAX_ACTIVE = 3; // au-delà, on s'éparpille
export const TRIES_PER_SESSION = 6; // au-delà, la qualité des essais chute

// Cotation proposée pour un nouveau projet : une cotation pleine au-dessus du max récent.
export function suggestGrade(state, kind, today = new Date()) {
  const base = GRADES.indexOf(recentMax(state, kind, today) ?? GRADES[state.adapt?.gradeIdx ?? 3]);
  return GRADES[Math.min(GRADES.length - 1, Math.max(0, base) + 2)];
}

// Un bloc peut être repéré par le niveau de sa salle (gym, level) ; grade garde l'équivalence en cotation.
export function addProject(state, { name, kind, grade, gym, level, place = '', notes = '' }, date) {
  const p = { id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: name.trim() || `${kind === 'voie' ? 'Voie' : 'Bloc'} ${level ?? grade}`, kind, grade, ...(gym ? { gym, level } : {}), place: place.trim(), notes: notes.trim(), created: date, status: 'actif', log: {} };
  state.projects = [...(state.projects || []), p];
  return p;
}

const find = (state, id) => (state.projects || []).find((p) => p.id === id);
const update = (state, id, fn) => {
  state.projects = (state.projects || []).map((p) => (p.id === id ? fn({ ...p, log: { ...p.log } }) : p));
  return find(state, id);
};

// Un essai de plus (ou de moins) dans la séance du jour, avec le point haut atteint.
export function logTry(state, id, date, { delta = 1, high } = {}) {
  return update(state, id, (p) => {
    const day = { tries: 0, ...p.log[date] };
    day.tries = Math.max(0, day.tries + delta);
    if (high !== undefined) day.high = Number(high) || undefined;
    if (!day.tries && !day.high) delete p.log[date];
    else p.log[date] = Object.fromEntries(Object.entries(day).filter(([, v]) => v !== undefined));
    return p;
  });
}

// Enchaîné : le projet est clos et la croix rejoint le carnet d'escalade.
export function sendProject(state, id, date) {
  const p = update(state, id, (x) => {
    x.log[date] = { ...x.log[date], tries: Math.max(1, x.log[date]?.tries || 0), high: 100 };
    return { ...x, status: 'enchaine', sent: date };
  });
  if (!p) return null;
  state.climbs = [...(state.climbs || []).filter((c) => c.project !== id), { id: `c${id}`, date, kind: p.kind, grade: p.grade, ...(p.gym ? { gym: p.gym, level: p.level } : {}), style: 'enchaine', project: id }];
  return p;
}

export function setProjectStatus(state, id, status) {
  const p = update(state, id, (x) => {
    const y = { ...x, status };
    if (status !== 'enchaine') delete y.sent;
    return y;
  });
  if (status !== 'enchaine') state.climbs = (state.climbs || []).filter((c) => c.project !== id);
  return p;
}

export function removeProject(state, id) {
  state.projects = (state.projects || []).filter((p) => p.id !== id);
  state.climbs = (state.climbs || []).filter((c) => c.project !== id);
}

export function projectStats(p) {
  const days = Object.keys(p.log || {}).sort();
  const tries = days.reduce((n, d) => n + (p.log[d].tries || 0), 0);
  const best = days.reduce((m, d) => Math.max(m, p.log[d].high || 0), 0);
  return { sessions: days.length, tries, best, days, last: days.at(-1) ?? null };
}

export function activeProjects(state, kind = null) {
  return (state.projects || []).filter((p) => p.status === 'actif' && (!kind || p.kind === kind));
}
