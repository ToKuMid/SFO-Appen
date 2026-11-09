import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lagTestdata, SKOLEGRUPPER } from '../src/dev/testdata.js';
import { ukedagNr } from '../src/dato.js';

const naa = new Date(2026, 10, 9, 16, 30);

test('testdata er like hver gang (samme frø)', () => {
  assert.deepEqual(lagTestdata({ naa }), lagTestdata({ naa }));
});

test('trinn og skolegruppe passer sammen (K-05)', () => {
  for (const e of lagTestdata({ naa }).elever) {
    assert.ok(SKOLEGRUPPER[e.trinn].includes(e.skolegruppe), `${e.trinn} / ${e.skolegruppe}`);
  }
});

test('alle elever har minst én SFO-dag, bare mandag–fredag', () => {
  for (const e of lagTestdata({ naa }).elever) {
    assert.ok(e.ukedager.length >= 1);
    assert.ok(e.ukedager.every((d) => d >= 1 && d <= 5));
  }
});

test('hendelser og tellinger er bare på skoledager før i dag', () => {
  const d = lagTestdata({ naa });
  for (const r of [...d.hendelser, ...d.tellinger]) {
    const [y, m, dag] = r.dato.split('-').map(Number);
    assert.ok(ukedagNr(new Date(y, m - 1, dag)) <= 5);
    assert.ok(r.dato < '2026-11-09');
  }
});

test('ingen navn er like', () => {
  const navn = lagTestdata({ naa }).elever.map((e) => `${e.fornavn} ${e.etternavn}`);
  assert.equal(new Set(navn).size, navn.length);
});
