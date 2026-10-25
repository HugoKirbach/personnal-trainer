import test from 'node:test';
import assert from 'node:assert/strict';
import { isPristine, mergeStates } from '../js/merge.js';
import { defaults, normalize, save } from '../js/store.js';

const log = (id, date) => ({ id, date, type: 'muscu', title: `Séance ${id}`, feeling: 'ok' });
const state = (patch) => ({ ...defaults(), ...patch });

test('premier lien : les séances des deux téléphones sont réunies', () => {
  const local = state({ logs: [log('a', '2026-10-27')], updatedAt: 2 });
  const remote = state({ logs: [log('b', '2026-10-25')], benchmarks: [{ date: '2026-10-25', pullups: 8 }], updatedAt: 1 });
  const m = mergeStates(local, remote);
  assert.deepEqual(m.logs.map((l) => l.id), ['b', 'a']);
  assert.equal(m.benchmarks.length, 1);
  assert.equal(m.updatedAt, 2);
});

test('fusion à trois voies : ajouts gardés, suppressions appliquées', () => {
  const base = state({ logs: [log('a', '2026-10-25'), log('b', '2026-10-26')], climbs: [{ id: 'c1', date: '2026-10-26', kind: 'bloc', grade: '6a', style: 'flash' }] });
  const local = state({ logs: [log('a', '2026-10-25'), log('b', '2026-10-26'), log('c', '2026-10-28')], climbs: [], updatedAt: 5 });
  const remote = state({ logs: [log('a', '2026-10-25'), log('d', '2026-10-28')], climbs: base.climbs, updatedAt: 4 });
  const m = mergeStates(local, remote, base);
  assert.deepEqual(m.logs.map((l) => l.id).sort(), ['a', 'c', 'd'], 'b supprimé ailleurs, c et d ajoutés');
  assert.equal(m.climbs.length, 0, 'bloc supprimé ici');
});

test('les résultats d\'une même prise de référence et le carnet de charges sont fusionnés', () => {
  const base = state({ benchmarks: [{ date: '2026-11-22', pullups: 9 }] });
  const local = state({ benchmarks: [{ date: '2026-11-22', pullups: 9, pushups: 30 }], lifts: { Curl: [{ date: '2026-11-20', sets: [{ reps: 10, kg: 7 }] }] }, updatedAt: 3 });
  const remote = state({ benchmarks: [{ date: '2026-11-22', pullups: 9, hang: 45 }], lifts: { Curl: [{ date: '2026-11-21', sets: [{ reps: 11, kg: 7 }] }], Oiseau: [{ date: '2026-11-21', sets: [{ reps: 15, kg: 3 }] }] }, updatedAt: 2 });
  const m = mergeStates(local, remote, base);
  assert.deepEqual(m.benchmarks, [{ date: '2026-11-22', pullups: 9, pushups: 30, hang: 45 }]);
  assert.deepEqual(m.lifts.Curl.map((x) => x.date), ['2026-11-20', '2026-11-21']);
  assert.ok(m.lifts.Oiseau);
});

test('réglages : chaque changement est gardé, le plus récent gagne en cas de conflit', () => {
  const base = state({});
  const local = state({ settings: { ...base.settings, sessionsPerWeek: 5, times: { ...base.settings.times, soir: '19:00' } }, updatedAt: 10 });
  const remote = state({ settings: { ...base.settings, sessionsPerWeek: 3, access: { escalade: true, muscu: false } }, updatedAt: 9 });
  const m = mergeStates(local, remote, base);
  assert.equal(m.settings.sessionsPerWeek, 5);
  assert.equal(m.settings.times.soir, '19:00');
  assert.equal(m.settings.access.escalade, true);
});

test('un téléphone neuf est reconnu', () => {
  assert.ok(isPristine(defaults()));
  assert.ok(!isPristine(state({ logs: [log('a', '2026-10-25')] })));
});

test('une modification locale reste plus récente que des données venues d\'un téléphone en avance', () => {
  const s = state({ updatedAt: Date.now() + 3 * 86400000 });
  const before = s.updatedAt;
  save(s);
  assert.ok(s.updatedAt > before);
});

test('projets : essais notés sur deux téléphones le même jour et un autre jour', () => {
  const p = { id: 'p1', name: 'Dévers', kind: 'bloc', grade: '6c+', created: '2026-11-01', status: 'actif', log: { '2026-11-01': { tries: 3 } } };
  const base = state({ projects: [p] });
  const local = state({ projects: [{ ...p, log: { ...p.log, '2026-11-03': { tries: 2, high: 50 } } }], updatedAt: 5 });
  const remote = state({ projects: [{ ...p, notes: 'talon à gauche', log: { ...p.log, '2026-11-04': { tries: 4 } } }], updatedAt: 4 });
  const m = mergeStates(local, remote, base);
  assert.equal(m.projects.length, 1);
  assert.equal(m.projects[0].notes, 'talon à gauche');
  assert.deepEqual(Object.keys(m.projects[0].log).sort(), ['2026-11-01', '2026-11-03', '2026-11-04']);
  assert.ok(!isPristine(state({ projects: [p] })));
});

test('ancien objectif unique : devient l\'objectif de son type', () => {
  const old = { ...defaults(), settings: { ...defaults().settings, goal: { kind: 'voie', grade: '7a', date: '2027-06-12', from: '2026-10-26', fromGrade: '6b' } } };
  delete old.settings.goals;
  const s = normalize(old);
  assert.equal(s.settings.goal, undefined);
  assert.equal(s.settings.goals.voie.grade, '7a');
  assert.equal(s.settings.gyms.length, 2, 'salles par défaut');
});
