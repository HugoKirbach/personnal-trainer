import test from 'node:test';
import assert from 'node:assert/strict';
import { benchDue, latestBench, prescriptions, referenceSession, vmaFromCooper, durationLabel, fmtDuration, resolveKey, SCHEDULES, TEMPLATE_KEYS, adapt, buildSession, mondayOf, weekInfo, weekSessions, ymd, parseYmd } from '../js/program.js';

const baseState = () => ({
  settings: { sessionsPerWeek: 4, startDate: '2026-10-26', times: { midi: '12:15', soir: '18:00', weekend: '10:00' }, access: { escalade: true, muscu: true } },
  adapt: { escalade: 1, muscu: 1, cardio: 1, gradeIdx: 3 },
  logs: [],
  moves: {},
});

test('mondayOf renvoie le lundi de la semaine', () => {
  assert.equal(ymd(mondayOf(parseYmd('2026-11-01'))), '2026-10-26'); // dimanche
  assert.equal(ymd(mondayOf(parseYmd('2026-10-26'))), '2026-10-26');
});

test('cycle de 4 semaines avec décharge en semaine 4', () => {
  const s = '2026-10-26';
  assert.equal(weekInfo(parseYmd('2026-10-27'), s).week, 1);
  assert.equal(weekInfo(parseYmd('2026-11-16'), s).phase.name, 'Décharge');
  assert.equal(weekInfo(parseYmd('2026-11-23'), s).cycle, 2);
  assert.ok(weekInfo(parseYmd('2026-11-16'), s).mult < weekInfo(parseYmd('2026-11-09'), s).mult);
});

test('chaque répartition donne le bon nombre de séances, sans escalade deux jours de suite', () => {
  for (const n of [3, 4, 5]) {
    const st = { ...baseState(), settings: { ...baseState().settings, sessionsPerWeek: n } };
    const list = weekSessions(parseYmd('2026-10-26'), st);
    assert.equal(list.length, n);
    const climbDays = list.filter((x) => x.type === 'escalade').map((x) => x.day).sort();
    for (let i = 1; i < climbDays.length; i++) assert.ok(climbDays[i] - climbDays[i - 1] > 1);
  }
});

test('tous les modèles produisent des exercices valides', () => {
  const st = baseState();
  for (const key of TEMPLATE_KEYS) {
    for (const d of ['2026-10-27', '2026-11-30', '2026-12-14']) {
      const s = buildSession(key, parseYmd(d), st);
      assert.ok(s.exercises.length >= 3, key);
      s.exercises.forEach((e) => {
        assert.ok(e.name && e.detail, key);
        assert.ok(!/undefined|NaN/.test(e.detail), `${key} : ${e.detail}`);
      });
    }
  }
});

test('pas de poutre avant la semaine 5', () => {
  const st = baseState();
  const early = buildSession('bloc', parseYmd('2026-11-04'), st);
  const later = buildSession('bloc', parseYmd('2026-11-25'), st);
  assert.ok(!early.exercises.some((e) => e.info === 'poutre'));
  assert.ok(later.exercises.some((e) => e.info === 'poutre'));
  assert.ok(early.notes.some((n) => n.includes('poutre')));
});

test('un déplacement ne touche que la semaine concernée', () => {
  const st = baseState();
  st.moves['2026-10-26'] = { 0: 1 };
  assert.equal(weekSessions(parseYmd('2026-10-26'), st)[0].day, 1);
  assert.equal(weekSessions(parseYmd('2026-11-02'), st)[0].day, 0);
});

test('adaptation : facile augmente, dur et douleur allègent', () => {
  const st = baseState();
  const push = (l) => { st.logs.push(l); return adapt(st, l); };
  push({ type: 'muscu', feeling: 'facile', completed: true });
  assert.equal(st.adapt.muscu, 1.05);
  push({ type: 'cardio', feeling: 'ok', completed: false });
  assert.equal(st.adapt.cardio, 0.93);
  push({ type: 'escalade', feeling: 'facile', completed: true });
  push({ type: 'escalade', feeling: 'facile', completed: true });
  assert.equal(st.adapt.gradeIdx, 4);
  const msgs = push({ type: 'escalade', feeling: 'ok', completed: true, pain: true });
  assert.equal(st.adapt.gradeIdx, 3);
  assert.ok(msgs.some((m) => m.includes('Douleur')));
});

test('le volume reste dans les bornes', () => {
  const st = baseState();
  for (let i = 0; i < 30; i++) { const l = { type: 'muscu', feeling: 'dur', completed: false }; st.logs.push(l); adapt(st, l); }
  assert.equal(st.adapt.muscu, 0.7);
});

test('la séance de 5 jours comprend du fractionné', () => {
  assert.ok(SCHEDULES[5].some((s) => s.key === 'fractionne'));
});

const homeState = () => ({ ...baseState(), settings: { ...baseState().settings, access: { escalade: false, muscu: false } } });

test('sans abonnement, toutes les séances passent à la maison', () => {
  for (const n of [3, 4, 5]) {
    const st = homeState();
    st.settings.sessionsPerWeek = n;
    weekSessions(parseYmd('2026-10-26'), st).forEach((s) => {
      if (s.type !== 'cardio') assert.ok(s.home, `${s.key} devrait être à la maison`);
    });
  }
  const mixed = baseState();
  mixed.settings.access = { escalade: true, muscu: false };
  assert.equal(resolveKey('bloc', mixed), 'bloc');
  assert.equal(resolveKey('haut', mixed), 'hautMaison');
});

test('aucun dips dans les séances maison et express', () => {
  const st = homeState();
  for (const key of TEMPLATE_KEYS) {
    for (const express of [false, true]) {
      const s = buildSession(key, parseYmd('2026-12-02'), st, express);
      if (!s.home) continue;
      s.exercises.forEach((e) => assert.ok(!/dips/i.test(e.name), `${s.variant} : ${e.name}`));
    }
  }
});

test('la version express dure entre 20 et 30 minutes', () => {
  const st = baseState();
  for (const key of TEMPLATE_KEYS.filter((k) => !k.startsWith('express'))) {
    const s = buildSession(key, parseYmd('2026-10-28'), st, true);
    assert.ok(s.express && s.variant.startsWith('express'));
    const min = Number(s.duration.match(/\d+/)[0]);
    assert.ok(min >= 20 && min <= 30, `${key} : ${s.duration}`);
  }
});

test('le mode express est mémorisé par séance', () => {
  const st = baseState();
  st.express = { '2026-10-28#1': true };
  const list = weekSessions(parseYmd('2026-10-26'), st);
  assert.ok(list[1].express);
  assert.ok(!list[0].express);
});

test('une séance d\'escalade maison ne change pas le niveau cible', () => {
  const st = baseState();
  for (let i = 0; i < 3; i++) { const l = { type: 'escalade', feeling: 'facile', completed: true, home: true }; st.logs.push(l); adapt(st, l); }
  assert.equal(st.adapt.gradeIdx, 3);
});

test('chaque exercice a une durée, un repos avant le suivant et une fiche tuto valide', async () => {
  const { GUIDES } = await import('../js/guides.js');
  const st = baseState();
  for (const key of TEMPLATE_KEYS) {
    for (const d of ['2026-10-27', '2026-11-25']) {
      const s = buildSession(key, parseYmd(d), st);
      assert.ok(s.totalSeconds > 0 && s.duration, key);
      s.exercises.forEach((e, i) => {
        assert.ok(e.seconds > 0, `${key} : ${e.name}`);
        if (i === s.exercises.length - 1) assert.equal(e.restAfter, 0);
        [].concat(e.info || []).forEach((id) => assert.ok(GUIDES[id], `fiche manquante : ${id}`));
        (e.circuit || []).forEach((c) => [].concat(c.info || []).forEach((id) => assert.ok(GUIDES[id], `fiche manquante : ${id}`)));
      });
      const total = s.exercises.reduce((t, e) => t + e.seconds + e.restAfter, 0);
      assert.equal(total, s.totalSeconds);
    }
  }
});

test('format des durées', () => {
  assert.equal(fmtDuration(45), '45 s');
  assert.equal(fmtDuration(90), '1 min 30');
  assert.equal(fmtDuration(120), '2 min');
  assert.equal(durationLabel(65 * 60), '1h05');
  assert.equal(durationLabel(60 * 60), '1h');
  assert.equal(durationLabel(47 * 60), '45 min');
});

test('les séances maison n\'utilisent qu\'un seul haltère de 10 kg max et un gilet de 8 kg max', () => {
  const st = homeState();
  st.benchmarks = [{ date: '2026-10-25', pullups: 25, pushups: 60 }];
  for (const key of TEMPLATE_KEYS) {
    for (const express of [false, true]) {
      const s = buildSession(key, parseYmd('2026-12-02'), st, express);
      if (!s.home) continue;
      s.exercises.forEach((e) => {
        const text = `${e.name} ${e.detail}`;
        assert.ok(!/haltères/i.test(text), `${s.variant} : ${text}`);
        for (const m of text.matchAll(/(\d+) kg/g)) assert.ok(Number(m[1]) <= 10, `${s.variant} : ${text}`);
        for (const m of text.matchAll(/gilet à (\d+) kg/g)) assert.ok(Number(m[1]) >= 4 && Number(m[1]) <= 8, text);
      });
    }
  }
});

test('la prise de référence adapte répétitions, charges et allures', () => {
  const st = homeState();
  const before = buildSession('blocMaison', parseYmd('2026-10-28'), st);
  assert.ok(before.exercises.some((e) => e.name === 'Tractions' && e.reps === '5 à 8'));
  st.benchmarks = [{ date: '2026-10-25', pullups: 8, hang: 50, gripper: 40, plank: 100, squat: 30, pushups: 20, cooper: 2600 }];
  const after = buildSession('blocMaison', parseYmd('2026-10-28'), st);
  assert.ok(after.exercises.some((e) => e.name === 'Tractions' && e.reps === '4 à 6'));
  assert.equal(after.exercises.find((e) => e.name === 'Suspensions actives').work, 25);
  assert.match(after.exercises.find((e) => e.info === 'pince').detail, /28 kg/);
  const p = prescriptions(latestBench(st));
  assert.equal(p.plank, 60);
  assert.equal(p.squatReps, 18);
  assert.equal(vmaFromCooper(2600), 13.4);
  assert.match(buildSession('fractionne', parseYmd('2026-10-28'), st).exercises[1].detail, /13,4 km\/h/);
  st.benchmarks.push({ date: '2026-11-22', pullups: 12 });
  const strong = buildSession('blocMaison', parseYmd('2026-11-25'), st);
  assert.ok(strong.exercises.some((e) => e.name === 'Tractions lestées'));
  assert.equal(latestBench(st).hang, 50, 'un test sauté garde l\'ancienne valeur');
});

test('rappel de prise de référence toutes les 4 semaines', () => {
  const st = homeState();
  assert.equal(benchDue(st, parseYmd('2026-10-25')).due, true);
  st.benchmarks = [{ date: '2026-10-25', pullups: 8 }];
  assert.equal(benchDue(st, parseYmd('2026-11-10')).due, false);
  assert.equal(benchDue(st, parseYmd('2026-11-10')).inDays, 12);
  assert.equal(benchDue(st, parseYmd('2026-11-22')).due, true);
});

test('la séance de référence contient tous les tests', () => {
  const r = referenceSession(parseYmd('2026-10-25'), homeState());
  const tests = r.exercises.map((e) => e.test).filter(Boolean);
  assert.deepEqual(tests, ['pushups', 'pullups', 'hang', 'gripper', 'plank', 'squat', 'cooper']);
  assert.equal(r.index, 'ref');
});
