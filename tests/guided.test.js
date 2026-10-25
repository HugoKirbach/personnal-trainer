import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE_KEYS, buildSession, parseYmd } from '../js/program.js';
import { GuidedRunner, PREP_SECONDS, buildSteps, nextLabel } from '../js/guided.js';

const state = {
  settings: { sessionsPerWeek: 4, startDate: '2026-10-26', times: { midi: '12:15', soir: '18:00', weekend: '10:00' }, access: { escalade: true, muscu: true } },
  adapt: { escalade: 1, muscu: 1, cardio: 1, gradeIdx: 3 },
  logs: [],
  moves: {},
};

test('la séance guidée dure exactement le temps total annoncé', () => {
  for (const key of TEMPLATE_KEYS) {
    for (const d of ['2026-10-28', '2026-11-25']) {
      const s = buildSession(key, parseYmd(d), state);
      const steps = buildSteps(s);
      const total = steps.reduce((t, x) => t + x.dur, 0);
      assert.equal(total, s.totalSeconds + PREP_SECONDS, key);
      assert.equal(steps[0].kind, 'prep');
      steps.forEach((x) => assert.ok(x.dur > 0 && x.title, `${key} : étape vide`));
    }
  }
});

test('repos entre séries et entre exercices dans la séance guidée', () => {
  const s = buildSession('haut', parseYmd('2026-11-11'), state);
  const steps = buildSteps(s);
  const bench = steps.filter((x) => x.title === 'Développé couché haltères');
  assert.equal(bench.length, s.exercises[1].sets);
  assert.ok(steps.some((x) => x.kind === 'rest' && x.transition && x.sub.includes('Rowing')));
});

test('le texte « Ensuite » annonce le repos puis l\'exercice suivant', () => {
  const s = buildSession('haut', parseYmd('2026-11-11'), state);
  const steps = buildSteps(s);
  const k = steps.findIndex((x) => x.title === 'Développé couché haltères');
  assert.match(nextLabel(steps, k), /^Repos 1 min 30, puis Développé couché haltères · Série 2/);
  assert.equal(nextLabel(steps, steps.length - 1), 'Fin de la séance');
});

test('les circuits affichent chaque exercice du tour', () => {
  const s = buildSession('voie', parseYmd('2026-10-28'), { ...state, settings: { ...state.settings, access: { escalade: false, muscu: false } } });
  const steps = buildSteps(s);
  assert.ok(steps.some((x) => x.title === 'Suspension' && x.timed));
  assert.ok(steps.some((x) => x.title === 'Pompes' && !x.timed));
});

test('annonces vocales : objectif des séries, rien sur les intervalles courts', () => {
  const home = { ...state, settings: { ...state.settings, access: { escalade: false, muscu: false } } };
  const lifts = { 'Oiseau un bras': [{ date: '2026-10-28', sets: [{ reps: 15, kg: 3 }, { reps: 15, kg: 3 }] }] };
  const steps = buildSteps(buildSession('hautMaison', parseYmd('2026-11-04'), { ...home, lifts }));
  assert.match(steps[0].say, /^Prépare-toi\. Premier exercice : Échauffement/);
  assert.match(steps.find((x) => x.title === 'Oiseau un bras').say, /Série 1\/3\. Objectif : 12 répétitions à 4 kg/);
  assert.ok(steps.some((x) => x.transition && /Prochain exercice/.test(x.say)));
  const board = buildSteps(buildSession('bloc', parseYmd('2026-11-25'), state)).filter((x) => x.title === 'Poutre douce (salle d\'escalade)');
  assert.ok(board[0].say);
  assert.ok(board.filter((x) => !x.sub.endsWith(' 1/6')).every((x) => x.say === null), 'poutre : seule la première suspension de chaque série est annoncée');
});

test('la séance guidée parle au départ et à la fin', () => {
  const said = [];
  const s = buildSession('expressCourse', parseYmd('2026-10-28'), state);
  const r = new GuidedRunner(s, () => {}, { sound: () => false, vibrate: () => false, onExerciseDone: () => {}, onFinish: () => {}, onSpeak: (t) => said.push(t) });
  r.start();
  r.next();
  r.finish();
  assert.match(said[0], /^Prépare-toi/);
  assert.match(said[1], /Footing/);
  assert.equal(said.at(-1), 'Séance terminée. Bravo !');
});
