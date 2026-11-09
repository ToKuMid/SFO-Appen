// Sjekker at appens filer, service worker og sikkerhetsregel henger sammen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSJON } from '../src/versjon.js';

const rot = fileURLToPath(new URL('..', import.meta.url));
const sw = await readFile(join(rot, 'sw.js'), 'utf8');
const html = await readFile(join(rot, 'index.html'), 'utf8');

async function filerUnder(mappe) {
  const ut = [];
  for (const d of await readdir(join(rot, mappe), { withFileTypes: true })) {
    const sti = `${mappe}/${d.name}`; // alltid «/», også på Windows
    if (d.isDirectory()) ut.push(...await filerUnder(sti));
    else ut.push(sti);
  }
  return ut;
}

test('versjon i sw.js og src/versjon.js er like', () => {
  assert.match(sw, new RegExp(`APP_VERSJON = '${APP_VERSJON.replace(/\./g, '\\.')}'`));
});

test('service worker lagrer alle appens filer, og alle filene finnes (IF-01)', async () => {
  const liste = [...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  for (const f of liste) await access(join(rot, f));
  const kreves = [...await filerUnder('src'), ...await filerUnder('icons'), 'index.html', 'manifest.webmanifest'];
  for (const f of kreves) assert.ok(liste.includes(f), `${f} mangler i FILER i sw.js`);
});

test('sikkerhetsregelen blokkerer nettverk (IF-02)', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
  assert.ok(csp, 'mangler CSP');
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|https?:/);
});

test('ingen eksterne ressurser i koden (IF-03)', async () => {
  for (const f of [...await filerUnder('src'), 'index.html', 'sw.js', 'manifest.webmanifest']) {
    const tekst = await readFile(join(rot, f), 'utf8');
    assert.doesNotMatch(tekst, /(src|href)=["']https?:|fetch\(\s*["']https?:|import .* from ["']https?:/, f);
  }
});

test('ingen innerHTML i grensesnittet', async () => {
  for (const f of await filerUnder('src')) {
    const tekst = await readFile(join(rot, f), 'utf8');
    assert.doesNotMatch(tekst, /\.innerHTML\s*=|insertAdjacentHTML/, f);
  }
});
