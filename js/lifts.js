// Carnet de charges : répétitions et charge de chaque série, et progression
// proposée pour la séance suivante (double progression : d'abord les
// répétitions jusqu'au haut de la fourchette, puis la charge).

// « 12 à 15 », « 10 par bras », « 3 » → { lo, hi }
export function parseReps(reps) {
  const m = String(reps ?? '').match(/^(\d+)(?:\s*à\s*(\d+))?/);
  return m ? { lo: Number(m[1]), hi: Number(m[2] || m[1]) } : null;
}

// Exercice compté en répétitions, dont on peut suivre les séries.
export function liftable(e) {
  return !e.unit && !e.circuit && !e.inner && !e.setLabels && !e.countUp && !e.timed && !!parseReps(e.reps);
}

export function liftHistory(state, key) {
  return state.lifts?.[key] || [];
}

// Dernière séance enregistrée avant la date donnée.
export function lastLift(state, key, beforeDate) {
  return liftHistory(state, key).filter((x) => !beforeDate || x.date < beforeDate).at(-1) || null;
}

const sets = (entry) => (entry?.sets || []).filter(Boolean);

// Objectif de la prochaine séance à partir de la précédente.
// hold : semaine de décharge, on garde la charge sans chercher à progresser.
export function suggestLift(range, load, last, hold = false) {
  const { lo, hi } = range;
  const done = sets(last);
  const lastKg = done.at(-1)?.kg ?? load?.kg ?? null;
  if (!done.length) return { reps: lo, kg: load?.kg ?? null, reason: null };
  if (hold) return { reps: lo, kg: lastKg, reason: 'semaine de décharge : même charge, sans forcer' };
  const allHit = done.every((s) => s.reps >= hi);
  if (allHit && load && lastKg != null && lastKg + load.step <= load.max) {
    return { reps: lo, kg: lastKg + load.step, reason: `toutes les séries à ${hi} : +${String(load.step).replace('.', ',')} kg` };
  }
  if (allHit && load && lastKg != null) return { reps: hi, kg: lastKg, reason: 'charge max atteinte : descente lente en 3 secondes' };
  if (allHit) return { reps: hi, kg: lastKg, reason: 'haut de la fourchette atteint : soigne l\'amplitude' };
  const minReps = Math.min(...done.map((s) => s.reps));
  return { reps: Math.min(hi, Math.max(lo, minReps + 1)), kg: lastKg, reason: '+1 répétition par série' };
}

// Ce que l'appli propose pour un exercice à une date donnée.
//   resetBefore : date de la dernière prise de référence (recale les charges qui en dépendent)
export function liftPlan(e, state, date, { resetBefore = null, hold = false } = {}) {
  if (!liftable(e)) return null;
  const range = parseReps(e.reps);
  const key = e.name;
  let last = lastLift(state, key, date);
  const reset = last && e.load?.fromBench && resetBefore && last.date < resetBefore;
  if (reset) last = null;
  return { key, range, last, target: suggestLift(range, e.load, last, hold), reset: !!reset };
}

// Enregistre une série (séance guidée).
export function recordSet(state, key, date, setIndex, value) {
  state.lifts ||= {};
  const list = (state.lifts[key] ||= []);
  let entry = list.find((x) => x.date === date);
  if (!entry) {
    entry = { date, sets: [] };
    list.push(entry);
    list.sort((a, b) => a.date.localeCompare(b.date));
  }
  entry.sets[setIndex] = value;
  entry.sets = Array.from(entry.sets, (s) => s ?? null);
}

// Remplace toutes les séries d'un exercice pour une date (saisie depuis la séance).
export function saveLift(state, key, date, list) {
  state.lifts ||= {};
  const others = (state.lifts[key] || []).filter((x) => x.date !== date);
  state.lifts[key] = list.length ? [...others, { date, sets: list }].sort((a, b) => a.date.localeCompare(b.date)) : others;
  if (!state.lifts[key].length) delete state.lifts[key];
}

export function setsOn(state, key, date) {
  return liftHistory(state, key).find((x) => x.date === date)?.sets || [];
}

export const fmtKg = (kg) => `${String(kg).replace('.', ',')}\u00a0kg`;

export function formatSets(entry) {
  const done = sets(entry);
  const kgs = [...new Set(done.map((s) => s.kg).filter((k) => k != null))];
  return `${done.map((s) => s.reps).join(' · ')}${kgs.length ? ` à ${kgs.map((k) => String(k).replace('.', ',')).join('/')}\u00a0kg` : ''}`;
}

// Progression entre la première et la dernière séance notée.
export function liftProgress(list) {
  if (list.length < 2) return null;
  const first = sets(list[0]);
  const last = sets(list.at(-1));
  const kg = (x) => Math.max(...x.map((s) => s.kg ?? 0));
  const reps = (x) => x.reduce((t, s) => t + s.reps, 0);
  if (kg(last) !== kg(first)) return { kind: 'kg', delta: Math.round((kg(last) - kg(first)) * 10) / 10 };
  return { kind: 'reps', delta: reps(last) - reps(first) };
}
