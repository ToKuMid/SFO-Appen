import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erTestmiljo } from '../src/miljo.js';

test('testmiljøet kjennes igjen på adressen, SFO-adressen gjør ikke det', () => {
  assert.equal(erTestmiljo('/SFO-Appen-test/'), true);
  assert.equal(erTestmiljo('/SFO-Appen-test/index.html'), true);
  assert.equal(erTestmiljo('/SFO-Appen/'), false);
  assert.equal(erTestmiljo('/'), false);
  assert.equal(erTestmiljo(undefined), false);
});

test('testmiljøet har egen database, eget hurtigbuffer og eget navn på hjemskjermen', () => {
  const db = readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
  assert.match(db, /ER_TEST \? 'sfo-appen-test' : 'sfo-appen'/);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /'sfo-appen-test-' : 'sfo-appen-'/);
  // SFO-appen sletter bare sine egne gamle hurtigbuffere, aldri testmiljøets (og omvendt).
  const PREFIKS = 'sfo-appen-';
  const egenGammel = (n, CACHE) => n.startsWith(PREFIKS) && /^\d/.test(n.slice(PREFIKS.length)) && n !== CACHE;
  assert.equal(egenGammel('sfo-appen-test-0.12.3', 'sfo-appen-0.12.4'), false);
  assert.equal(egenGammel('sfo-appen-0.12.3', 'sfo-appen-0.12.4'), true);
  const manifest = JSON.parse(readFileSync(new URL('../manifest-test.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'SFO TEST');
});
