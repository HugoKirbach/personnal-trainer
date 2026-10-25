import test from 'node:test';
import assert from 'node:assert/strict';
import { activeProjects, addProject, logTry, projectStats, removeProject, sendProject, setProjectStatus, suggestGrade } from '../js/projects.js';
import { recentMax, parseYmd } from '../js/program.js';
import { defaults } from '../js/store.js';

test('projet : essais, point haut puis enchaînement versé au carnet d\'escalade', () => {
  const st = defaults();
  const p = addProject(st, { name: '  Le dévers jaune ', kind: 'bloc', grade: '6c+', place: 'mur du fond' }, '2026-11-02');
  assert.equal(p.name, 'Le dévers jaune');
  assert.equal(activeProjects(st, 'bloc').length, 1);
  assert.equal(activeProjects(st, 'voie').length, 0);
  logTry(st, p.id, '2026-11-02');
  logTry(st, p.id, '2026-11-02');
  logTry(st, p.id, '2026-11-02', { delta: 0, high: '50' });
  logTry(st, p.id, '2026-11-05', { delta: 3, high: 75 });
  logTry(st, p.id, '2026-11-05', { delta: -1 });
  let s = projectStats(st.projects[0]);
  assert.deepEqual([s.sessions, s.tries, s.best], [2, 4, 75]);
  // Un essai retiré à zéro sans point haut efface la journée.
  logTry(st, p.id, '2026-11-06');
  logTry(st, p.id, '2026-11-06', { delta: -1 });
  assert.equal(projectStats(st.projects[0]).sessions, 2);
  sendProject(st, p.id, '2026-11-09');
  s = projectStats(st.projects[0]);
  assert.equal(st.projects[0].status, 'enchaine');
  assert.deepEqual([s.sessions, s.tries, s.best], [3, 5, 100]);
  assert.deepEqual(st.climbs.map((c) => [c.grade, c.style, c.project]), [['6c+', 'enchaine', p.id]]);
  assert.equal(recentMax(st, 'bloc', parseYmd('2026-11-10')), '6c+');
  assert.equal(activeProjects(st).length, 0);
  // Annuler l'enchaînement retire la croix ; supprimer le projet aussi.
  setProjectStatus(st, p.id, 'actif');
  assert.equal(st.climbs.length, 0);
  assert.equal(st.projects[0].sent, undefined);
  sendProject(st, p.id, '2026-11-09');
  removeProject(st, p.id);
  assert.equal(st.projects.length, 0);
  assert.equal(st.climbs.length, 0);
});

test('projet : cotation proposée une cotation pleine au-dessus du max récent', () => {
  const st = defaults();
  st.climbs = [{ id: '1', date: '2026-11-01', kind: 'voie', grade: '6c', style: 'enchaine' }];
  assert.equal(suggestGrade(st, 'voie', parseYmd('2026-11-02')), '7a');
  st.adapt.gradeIdx = 9;
  assert.equal(suggestGrade(st, 'bloc', parseYmd('2026-11-02')), '7b', 'jamais au-delà de la dernière cotation');
});
