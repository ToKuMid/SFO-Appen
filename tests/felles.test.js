import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sorterElever } from '../src/ui/felles.js';

test('lister sorteres alfabetisk på fornavn, så etternavn og trinn', () => {
  const e = (fornavn, etternavn, trinn) => ({ fornavn, etternavn, trinn });
  const sortert = sorterElever([e('Øyvind', 'Ask', 1), e('Emma', 'Berg', 4), e('Åse', 'Lie', 2), e('Emma', 'Ask', 2), e('aksel', 'Moe', 3), e('Emma', 'Ask', 1)]);
  assert.deepEqual(sortert.map((x) => `${x.fornavn} ${x.etternavn} ${x.trinn}`),
    ['aksel Moe 3', 'Emma Ask 1', 'Emma Ask 2', 'Emma Berg 4', 'Øyvind Ask 1', 'Åse Lie 2']);
});
