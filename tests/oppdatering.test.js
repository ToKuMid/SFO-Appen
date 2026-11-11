import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('ny versjon henter filene med versjonsnummer i adressen, så gamle filer fra GitHub ikke brukes', () => {
  assert.match(sw, /v=\$\{encodeURIComponent\(APP_VERSJON\)\}/);
  assert.match(sw, /cache: 'reload'/);
  assert.doesNotMatch(sw, /cache\.addAll\(/, 'filene skal ikke hentes uten versjonsnummer');
});

test('installasjonen avbrytes hvis versjonsfila ikke har samme versjon som service workeren', () => {
  assert.match(sw, /if \(!versjon\.includes\(`'\$\{APP_VERSJON\}'`\)\) throw/);
});
