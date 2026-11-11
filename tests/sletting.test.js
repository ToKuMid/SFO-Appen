import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dagenFor, skoleaarStart, slettegrense, slettePlan } from '../src/model/sletting.js';

test('skoleåret starter 1. august', () => {
  assert.equal(skoleaarStart('2026-11-10'), '2026-08-01');
  assert.equal(skoleaarStart('2026-08-01'), '2026-08-01');
  assert.equal(skoleaarStart('2026-07-31'), '2025-08-01');
});

test('slettegrense: inneværende og forrige skoleår beholdes (K-63)', () => {
  assert.equal(slettegrense('2026-11-10'), '2025-08-01');
  assert.equal(slettegrense('2026-07-31'), '2024-08-01', 'sommeren hører til skoleåret som slutter');
  assert.equal(slettegrense('2026-08-01'), '2025-08-01', 'nytt skoleår flytter grensen');
  assert.equal(slettegrense('2026-11-10', 1), '2026-08-01', 'bare inneværende skoleår');
  assert.equal(slettegrense('2026-11-10', 7), '2025-08-01', 'ugyldig valg gir standard');
  assert.equal(dagenFor('2025-08-01'), '2025-07-31');
  assert.equal(dagenFor('2026-03-01'), '2026-02-28');
});

test('slettePlan: gamle registreringer, linjer til gamle tellinger og deaktiverte elever uten nyere data', () => {
  const elever = [
    { id: 'a', aktiv: true }, // aktiv: beholdes alltid
    { id: 'b', aktiv: false }, // deaktivert, har nyere data: beholdes
    { id: 'c', aktiv: false }, // deaktivert, ingen nyere data: slettes med avtale
    { id: 'd', aktiv: false, endret: '2025-09-01T10:00:00.000Z' }, // deaktivert i år uten data: beholdes
  ];
  const plan = slettePlan({
    grense: '2025-08-01',
    gamle: {
      hendelser: [{ id: 'h1', dato: '2025-06-20' }, { id: 'h2', dato: '2025-08-01' }],
      unntak: [{ id: 'u1', dato: '2025-05-02' }],
      tellinger: [{ id: 't1', dato: '2025-06-20' }],
      tellingslinjer: [{ id: 'l1', tellingId: 't1' }, { id: 'l2', tellingId: 't9' }],
    },
    elever,
    avtaler: [{ elevId: 'c' }, { elevId: 'a' }],
    elevMedNyereData: new Set(['a', 'b']),
  });
  assert.deepEqual(plan.slett, {
    hendelser: ['h1'], unntak: ['u1'], tellinger: ['t1'], tellingslinjer: ['l1'], elever: ['c'], avtaler: ['c'],
  });
  assert.equal(plan.tom, false);
  assert.equal(slettePlan({ grense: '2025-08-01', gamle: { hendelser: [], unntak: [], tellinger: [], tellingslinjer: [] }, elever: [{ id: 'a', aktiv: true }], avtaler: [], elevMedNyereData: new Set() }).tom, true);
});
