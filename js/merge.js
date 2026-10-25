// Fusion à trois voies des données de deux appareils (téléphone et sauvegarde en ligne).
// base = dernière version synchronisée : ce qui a changé d'un seul côté l'emporte, un ajout des
// deux côtés est gardé, une suppression n'est appliquée que si l'autre côté n'a pas modifié l'élément.

// Listes rangées par identifiant.
const KEYED = { logs: 'id', climbs: 'id', benchmarks: 'date', pains: (p) => `${p.zone}|${p.from}` };

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const toMap = (list, key) => Object.fromEntries((list || []).map((x) => [typeof key === 'function' ? key(x) : x[key], x]));
const byDate = (a, b) => String(a.date ?? a.from ?? '').localeCompare(String(b.date ?? b.from ?? ''));

function mergeValue(b, l, r, preferLocal, depth) {
  if (eq(l, r)) return l;
  if (eq(l, b)) return r;
  if (eq(r, b)) return l;
  // Modifié des deux côtés : on garde ce qui existe plutôt que la suppression.
  if (l === undefined) return r;
  if (r === undefined) return l;
  if (depth > 0 && isObj(l) && isObj(r)) return mergeMap(isObj(b) ? b : {}, l, r, preferLocal, depth - 1);
  return preferLocal ? l : r;
}

function mergeMap(b = {}, l = {}, r = {}, preferLocal = true, depth = 0) {
  const out = {};
  new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
    const v = mergeValue(b[k], l[k], r[k], preferLocal, depth);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

export function mergeStates(local, remote, base = null) {
  const b = base || {};
  const preferLocal = (local.updatedAt || 0) >= (remote.updatedAt || 0);
  const out = { ...remote, ...local };
  Object.entries(KEYED).forEach(([name, key]) => {
    out[name] = Object.values(mergeMap(toMap(b[name], key), toMap(local[name], key), toMap(remote[name], key), preferLocal, 1)).sort(byDate);
  });
  // Projets : champ par champ, et le journal des essais date par date.
  out.projects = Object.values(mergeMap(toMap(b.projects, 'id'), toMap(local.projects, 'id'), toMap(remote.projects, 'id'), preferLocal, 2))
    .sort((x, y) => String(x.created).localeCompare(String(y.created)));
  out.lifts = {};
  new Set([...Object.keys(local.lifts || {}), ...Object.keys(remote.lifts || {})]).forEach((name) => {
    const m = mergeMap(toMap(b.lifts?.[name], 'date'), toMap(local.lifts?.[name], 'date'), toMap(remote.lifts?.[name], 'date'), preferLocal, 0);
    const list = Object.values(m).sort(byDate);
    if (list.length) out.lifts[name] = list;
  });
  out.checks = mergeMap(b.checks, local.checks, remote.checks, preferLocal, 0);
  out.express = mergeMap(b.express, local.express, remote.express, preferLocal, 0);
  out.forms = mergeMap(b.forms, local.forms, remote.forms, preferLocal, 0);
  out.slots = mergeMap(b.slots, local.slots, remote.slots, preferLocal, 0);
  out.swaps = mergeMap(b.swaps, local.swaps, remote.swaps, preferLocal, 0);
  out.durations = mergeMap(b.durations, local.durations, remote.durations, preferLocal, 0);
  out.moves = mergeMap(b.moves, local.moves, remote.moves, preferLocal, 1);
  out.settings = mergeMap(b.settings, local.settings, remote.settings, preferLocal, 1);
  out.adapt = mergeMap(b.adapt, local.adapt, remote.adapt, preferLocal, 0);
  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  return out;
}

// Aucune donnée personnelle encore saisie sur cet appareil.
export function isPristine(s) {
  return !s.logs?.length && !s.benchmarks?.length && !s.climbs?.length && !s.projects?.length && !Object.keys(s.lifts || {}).length && !Object.keys(s.checks || {}).length;
}
