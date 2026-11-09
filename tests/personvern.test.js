// Vakt mot overføring av persondata (IF-02, IF-03, DPIA). Testene stopper en ny versjon hvis
// sikkerhetsregelen (CSP) svekkes, eller hvis noen legger inn kode som kan sende data ut av telefonen.
// Endrer du noe her, skal DPIA-en vurderes på nytt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rot = fileURLToPath(new URL('..', import.meta.url));
const les = (f) => readFile(join(rot, f), 'utf8');

async function filerUnder(mappe) {
  const ut = [];
  for (const d of await readdir(join(rot, mappe), { withFileTypes: true })) {
    const sti = `${mappe}/${d.name}`;
    if (d.isDirectory()) ut.push(...await filerUnder(sti));
    else if (/\.(js|html|json|webmanifest)$/.test(d.name)) ut.push(sti);
  }
  return ut;
}
const kodefiler = async () => [...await filerUnder('src'), 'sw.js', 'index.html', 'manifest.webmanifest'];

// Uten kommentarer, så forklarende tekst ikke gir falske treff.
const utenKommentarer = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

// ---------- Sikkerhetsregelen (CSP) ----------

const FORVENTET_CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'blob:', 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'none'"],
  'form-action': ["'none'"],
  'base-uri': ["'none'"],
  'object-src': ["'none'"],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'"],
};

test('CSP er nøyaktig som godkjent: ingen nettverkskall, ingen andre adresser', async () => {
  const html = await les('index.html');
  const treff = [...html.matchAll(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/g)];
  assert.equal(treff.length, 1, 'nøyaktig én CSP-regel');
  const regel = Object.fromEntries(treff[0][1].split(';').map((d) => d.trim()).filter(Boolean)
    .map((d) => { const [navn, ...verdier] = d.split(/\s+/); return [navn, verdier]; }));
  assert.deepEqual(regel, FORVENTET_CSP, 'CSP er endret. Vurder DPIA-en før regelen endres her.');
});

test('CSP-regelen står før alle skript i index.html', async () => {
  const html = await les('index.html');
  const csp = html.indexOf('Content-Security-Policy');
  const skript = html.search(/<script\b/);
  assert.ok(csp > 0 && (skript === -1 || csp < skript));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'ingen innebygde skript');
  assert.doesNotMatch(html, /\son[a-z]+=/i, 'ingen innebygde hendelser (onclick= osv.)');
});

// ---------- Koden ----------

// Nettverks-API-er som aldri skal brukes. fetch er bare lov i service workeren og i selvtesten.
const FORBUDT = [
  /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /EventSource/, /RTCPeerConnection/,
  /importScripts/, /window\.open\s*\(/, /location\.(href|assign|replace)\s*[=(]/,
  /\.action\s*=/, /\bimport\s*\(/, /new\s+Worker\s*\(/, /new\s+SharedWorker\s*\(/,
];
const FETCH_TILLATT = new Set(['sw.js', 'src/plattform.js']);
const DELING_TILLATT = new Set(['src/filer.js']);

test('ingen kode som kan sende data ut av telefonen', async () => {
  for (const f of await kodefiler()) {
    const kode = utenKommentarer(await les(f));
    for (const m of FORBUDT) assert.doesNotMatch(kode, m, `${f}: ${m}`);
    if (!FETCH_TILLATT.has(f)) assert.doesNotMatch(kode, /\bfetch\s*\(/, `${f}: fetch er ikke tillatt her`);
    if (!DELING_TILLATT.has(f)) assert.doesNotMatch(kode, /navigator\.share/, `${f}: deling bare via filer.js`);
  }
});

test('ingen nettadresser i koden (bare XML- og SVG-navnerom)', async () => {
  const navnerom = /^https?:\/\/(www\.w3\.org|schemas\.openxmlformats\.org)\//;
  for (const f of await kodefiler()) {
    const kode = utenKommentarer(await les(f));
    for (const [url] of kode.matchAll(/https?:\/\/[^\s"'`<>)]+/g)) {
      assert.match(url, navnerom, `${f}: nettadresse ${url}`);
    }
    assert.doesNotMatch(kode, /["'`]\/\/[a-z0-9.-]+\.[a-z]{2,}/i, `${f}: adresse uten protokoll`);
  }
});

test('selvtesten og service workeren henter bare appens egne filer', async () => {
  const plattform = utenKommentarer(await les('src/plattform.js'));
  for (const [, arg] of plattform.matchAll(/fetch\s*\(\s*([^,)]+)/g)) assert.match(arg, /^`\.\//, 'selvtesten henter bare egen fil');
  const sw = utenKommentarer(await les('sw.js'));
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/, 'service workeren slipper bare egne adresser');
  assert.match(sw, /req\.method !== 'GET'\) return/);
  assert.doesNotMatch(sw, /indexedDB|postMessage\s*\(\s*[^'"]/, 'service workeren rører ikke data');
});

test('skrivefelt har ikke stavekontroll eller autofyll som standard', async () => {
  const dom = await les('src/dom.js');
  assert.match(dom, /SKRIVEFELT_STANDARD = \{ spellcheck: 'false', autocorrect: 'off', autocomplete: 'off' \}/);
  assert.match(dom, /if \(tag === 'input' \|\| tag === 'textarea'\) attrs = \{ \.\.\.SKRIVEFELT_STANDARD, \.\.\.attrs \}/);
  for (const f of await filerUnder('src')) {
    const kode = await les(f);
    assert.doesNotMatch(kode, /spellcheck:\s*'true'|autocorrect:\s*'on'|autocomplete:\s*'(on|name|given-name|family-name)'/, f);
  }
});
