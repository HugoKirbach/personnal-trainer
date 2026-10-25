import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhases, fmt } from '../js/timer.js';

test('intervalles : phases et durée totale', () => {
  const p = buildPhases({ mode: 'interval', work: 7, rest: 3, rounds: 6, sets: 2, setRest: 120 });
  assert.equal(p.filter((x) => x.kind === 'work').length, 12);
  const total = p.reduce((s, x) => s + x.dur, 0);
  assert.equal(total, 5 + 2 * (6 * 7 + 5 * 3) + 120);
});

test('format du temps', () => {
  assert.equal(fmt(65000), '01:05');
  assert.equal(fmt(65430, true), '01:05.4');
});
