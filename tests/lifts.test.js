import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSets, liftProgress, liftable, parseReps, recordSet, saveLift, setsOn, suggestLift } from '../js/lifts.js';

const DB = { kg: 3, step: 1, min: 2, max: 10, tool: 'haltère' };

test('lecture des fourchettes de répétitions', () => {
  assert.deepEqual(parseReps('12 à 15 par bras'), { lo: 12, hi: 15 });
  assert.deepEqual(parseReps('3'), { lo: 3, hi: 3 });
  assert.equal(parseReps('voie facile'), null);
  assert.ok(liftable({ reps: '8 à 12' }));
  assert.ok(!liftable({ reps: '2 à 3 essais', unit: 'blocs' }));
  assert.ok(!liftable({ reps: '10', timed: true }));
});

test('double progression : répétitions puis charge', () => {
  const r = { lo: 12, hi: 15 };
  assert.deepEqual(suggestLift(r, DB, null), { reps: 12, kg: 3, reason: null });
  assert.equal(suggestLift(r, DB, { sets: [{ reps: 13, kg: 3 }, { reps: 12, kg: 3 }] }).reps, 13);
  assert.equal(suggestLift(r, DB, { sets: [{ reps: 15, kg: 3 }, { reps: 15, kg: 3 }] }).kg, 4);
  assert.equal(suggestLift(r, { ...DB, kg: 10 }, { sets: [{ reps: 15, kg: 10 }] }).kg, 10);
  assert.equal(suggestLift(r, null, { sets: [{ reps: 10, kg: null }] }).reps, 12);
  assert.equal(suggestLift(r, DB, { sets: [{ reps: 15, kg: 3 }] }, true).kg, 3);
});

test('enregistrement des séries', () => {
  const st = {};
  recordSet(st, 'Curl', '2026-11-02', 1, { reps: 9, kg: 7 });
  recordSet(st, 'Curl', '2026-11-02', 0, { reps: 10, kg: 7 });
  assert.equal(formatSets(st.lifts.Curl[0]), '10 · 9 à 7\u00a0kg');
  saveLift(st, 'Curl', '2026-10-26', [{ reps: 8, kg: 6 }, { reps: 8, kg: 6 }]);
  assert.deepEqual(st.lifts.Curl.map((x) => x.date), ['2026-10-26', '2026-11-02']);
  assert.deepEqual(liftProgress(st.lifts.Curl), { kind: 'kg', delta: 1 });
  assert.equal(setsOn(st, 'Curl', '2026-11-02').length, 2);
  saveLift(st, 'Curl', '2026-10-26', []);
  saveLift(st, 'Curl', '2026-11-02', []);
  assert.equal(st.lifts.Curl, undefined);
});
