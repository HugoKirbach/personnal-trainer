import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKey, SCHEDULES, TEMPLATE_KEYS, adapt, buildSession, mondayOf, weekInfo, weekSessions, ymd, parseYmd } from '../js/program.js';

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
  assert.ok(!early.exercises.some((e) => e.timer?.label === 'Poutre'));
  assert.ok(later.exercises.some((e) => e.timer?.label === 'Poutre'));
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
