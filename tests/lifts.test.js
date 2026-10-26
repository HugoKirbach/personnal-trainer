import test from 'node:test';
import assert from 'node:assert/strict';
import { HARDER, STAGES, formatSets, liftPlan, liftProgress, liftable, parseReps, recordSet, saveLift, setsOn, suggestLift } from '../js/lifts.js';

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

test('charge max atteinte : paliers de technique, validés un par un', () => {
  const r = { lo: 10, hi: 15 };
  const max = { ...DB, kg: 10 };
  const top = (tech) => ({ sets: [{ reps: 15, kg: 10 }, { reps: 15, kg: 10 }], ...(tech ? { tech } : {}) });
  // à 9 kg, la charge monte encore
  assert.equal(suggestLift(r, max, { sets: [{ reps: 15, kg: 9 }] }).kg, 10);
  // 10 kg validés : palier 1, on repart du bas de la fourchette
  const t1 = suggestLift(r, max, top());
  assert.deepEqual([t1.kg, t1.reps, t1.tech, !!t1.extraSet], [10, 10, 'tempo', false]);
  // palier pas encore validé : +1 répétition, même technique
  const stay = suggestLift(r, max, { sets: [{ reps: 12, kg: 10 }, { reps: 11, kg: 10 }], tech: 'tempo' });
  assert.deepEqual([stay.reps, stay.tech], [12, 'tempo']);
  // chaque palier validé ouvre le suivant
  assert.equal(suggestLift(r, max, top('tempo')).tech, 'pause');
  assert.equal(suggestLift(r, max, top('pause')).tech, 'demi');
  const last = suggestLift(r, max, top('demi'));
  assert.deepEqual([last.tech, last.extraSet], ['serie', true]);
  const done = suggestLift(r, max, top('serie'));
  assert.ok(done.top);
  assert.equal(done.reps, 15);
  // décharge : même technique, pas de série en plus
  const hold = suggestLift(r, max, top('serie'), true);
  assert.deepEqual([hold.tech, !!hold.extraSet], ['serie', false]);
  // charge baissée à la main : retour à la double progression classique
  assert.equal(suggestLift(r, max, { sets: [{ reps: 15, kg: 8 }], tech: 'pause' }).tech, undefined);
  assert.equal(STAGES.length, 4);
});

test('palier enregistré avec les séries, variante plus dure proposée', async () => {
  const st = {};
  recordSet(st, 'Rowing haltère un bras', '2026-11-02', 0, { reps: 15, kg: 10 }, 'demi');
  assert.equal(st.lifts['Rowing haltère un bras'][0].tech, 'demi');
  saveLift(st, 'Curl un bras', '2026-11-02', [{ reps: 12, kg: 10 }], 'pause');
  assert.equal(st.lifts['Curl un bras'][0].tech, 'pause');
  const e = { name: 'Rowing haltère un bras', reps: '10 à 15 par bras', load: { ...DB, kg: 10 } };
  const plan = liftPlan(e, st, '2026-11-09');
  assert.equal(plan.target.tech, 'serie');
  assert.equal(plan.target.harder, 'Rowing inversé sous une table');
  // les variantes proposées existent dans Remplacer, dans le même groupe que l'exercice
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/program.js', import.meta.url), 'utf8');
  const groups = src.slice(src.indexOf('const SWAP_GROUPS'), src.indexOf('};', src.indexOf('const SWAP_GROUPS'))).split(/\n  \w+: \[/);
  Object.entries(HARDER).forEach(([from, to]) => {
    assert.ok(groups.some((g) => g.includes(`name: '${from.replace(/'/g, "\\'")}'`) && g.includes(`name: '${to}'`)), `${from} → ${to}`);
  });
});
