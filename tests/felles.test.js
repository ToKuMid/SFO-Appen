import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sorterElever } from '../src/ui/felles.js';

test('lister sorteres på trinn, og innad i trinnet på fornavn, så etternavn', () => {
  const e = (fornavn, etternavn, trinn) => ({ fornavn, etternavn, trinn });
  const sortert = sorterElever([e('Øyvind', 'Ask', 1), e('Emma', 'Berg', 4), e('Åse', 'Lie', 2), e('Emma', 'Ask', 2), e('aksel', 'Moe', 3), e('Emma', 'Ask', 1), e('Bror', 'Berg', 1), e('Emma', 'Aas', 1)]);
  // «Aas» sorteres som «Ås» på norsk, altså sist.
  assert.deepEqual(sortert.map((x) => `${x.fornavn} ${x.etternavn} ${x.trinn}`),
    ['Bror Berg 1', 'Emma Ask 1', 'Emma Aas 1', 'Øyvind Ask 1', 'Emma Ask 2', 'Åse Lie 2', 'aksel Moe 3', 'Emma Berg 4']);
});
