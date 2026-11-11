import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byttPassord, dekrypterKopi, erKryptert, kontrollerPassord, krypterKopi, lagNokkel } from '../src/kryptering.js';
import { byggSikkerhetskopi } from '../src/backup.js';

const RASK = { iterasjoner: 1000 }; // færre runder i testene, appen bruker 600 000
const data = {
  elever: [{ id: 'e1', fornavn: 'Sanna', etternavn: 'Østby', trinn: 3, skolegruppe: 'Gruppe 1 blå', ukedager: [1, 2], aktiv: true }],
  avtaler: [{ elevId: 'e1', gaarHjemAleneFra: '15:30', fastHentetid: null, fritekst: 'Hentes av bestemor' }],
  hendelser: Array.from({ length: 200 }, (_, i) => ({ id: `h${i}`, elevId: 'e1', dato: '2026-11-09', tid: '2026-11-09T14:00:00.000Z', type: 'inn' })),
  innstillinger: [{ nokkel: 'kopi-nokkel', verdi: { raa: 'hemmelig' } }],
};

test('kryptert sikkerhetskopi: ingen navn i klartekst, og riktig passord gir alt tilbake (T15)', async () => {
  const nokkel = await lagNokkel('Lang setning som passord', RASK);
  const kopi = byggSikkerhetskopi(data, { appversjon: '0.12.0', naa: new Date('2026-11-10T15:00:00Z') });
  const fil = await krypterKopi(kopi, nokkel);
  assert.doesNotMatch(fil, /Sanna|Østby|bestemor|Gruppe 1/);
  assert.ok(!fil.includes(nokkel.raa), 'datanøkkelen står aldri i fila');
  const obj = JSON.parse(fil);
  assert.ok(erKryptert(obj));
  assert.equal(obj.eksportert, '2026-11-10T15:00:00.000Z');
  assert.ok(fil.length < JSON.stringify(kopi).length, 'komprimert');
  const { kopi: tilbake, nokkel: ny } = await dekrypterKopi(obj, 'Lang setning som passord');
  assert.deepEqual(tilbake, kopi);
  assert.equal(ny.raa, nokkel.raa, 'samme datanøkkel kan tas i bruk på ny telefon');
  assert.ok(!tilbake.data.innstillinger.some((r) => r.nokkel === 'kopi-nokkel'), 'nøkkelen tas aldri med i kopien');
});

test('feil passord avvises', async () => {
  const nokkel = await lagNokkel('Riktig passord her', RASK);
  const fil = JSON.parse(await krypterKopi(byggSikkerhetskopi(data), nokkel));
  await assert.rejects(dekrypterKopi(fil, 'Feil passord her!'), /Feil passord/);
});

test('bytte av passord: nye kopier åpnes med nytt passord, gamle med det gamle', async () => {
  const gammel = await lagNokkel('Første passord ja', RASK);
  const gammelFil = JSON.parse(await krypterKopi(byggSikkerhetskopi(data), gammel));
  const ny = await byttPassord(gammel, 'Andre passord nå', RASK);
  const nyFil = JSON.parse(await krypterKopi(byggSikkerhetskopi(data), ny));
  await dekrypterKopi(nyFil, 'Andre passord nå');
  await assert.rejects(dekrypterKopi(nyFil, 'Første passord ja'), /Feil passord/);
  await dekrypterKopi(gammelFil, 'Første passord ja');
});

test('passordkrav', () => {
  assert.equal(kontrollerPassord('Hesten spiser gress', 'Hesten spiser gress'), null);
  assert.match(kontrollerPassord('kort'), /minst 12 tegn/);
  assert.match(kontrollerPassord('aaaaaaaaaaaaaa'), /samme tegn/);
  assert.match(kontrollerPassord('Hesten spiser gress', 'Hesten spiser gres'), /ikke like/);
});
