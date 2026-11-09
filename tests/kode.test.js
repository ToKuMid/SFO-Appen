import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erKodeNokkel, gjenstaendeVent, kontrollerNyKode, lagKode, sjekkKode } from '../src/kode.js';
import { byggSikkerhetskopi } from '../src/backup.js';
import { settLast, settAdmin, erAdmin, aapnerSystemvindu, skalLases, SYSTEMVINDU_MAKS } from '../src/tilgang.js';

test('koden lagres som hash med salt, ikke i klartekst (K-71)', async () => {
  const lagret = await lagKode('2580');
  assert.ok(!JSON.stringify(lagret).includes('2580'));
  assert.equal(await sjekkKode('2580', lagret), true);
  assert.equal(await sjekkKode('2581', lagret), false);
  const annen = await lagKode('2580');
  assert.notEqual(annen.salt, lagret.salt, 'nytt salt hver gang');
  assert.equal(await sjekkKode('2580', null), false);
});

test('nye koder: riktig lengde, ikke like siffer og ikke rekker', () => {
  assert.equal(kontrollerNyKode('2580', 4), null);
  assert.equal(kontrollerNyKode('739164', 6), null);
  assert.match(kontrollerNyKode('258', 4), /4 siffer/);
  assert.match(kontrollerNyKode('25a0', 4), /4 siffer/);
  assert.match(kontrollerNyKode('0000', 4), /like siffer/);
  assert.match(kontrollerNyKode('1234', 4), /rekke/);
  assert.match(kontrollerNyKode('4321', 4), /rekke/);
  assert.match(kontrollerNyKode('890123', 6), /rekke/);
});

test('ventetid etter feil kode: fem frie forsøk, så økende ventetid', () => {
  const sist = '2026-11-09T12:00:00.000Z';
  const t = new Date(sist).getTime();
  assert.equal(gjenstaendeVent({ antall: 4, sist }, t), 0);
  assert.equal(gjenstaendeVent({ antall: 5, sist }, t), 30000);
  assert.equal(gjenstaendeVent({ antall: 6, sist }, t), 60000);
  assert.equal(gjenstaendeVent({ antall: 5, sist }, t + 31000), 0);
  assert.equal(gjenstaendeVent({ antall: 30, sist }, t), 15 * 60000, 'høyst 15 minutter');
  assert.equal(gjenstaendeVent(undefined, t), 0);
});

test('kodene tas ikke med i sikkerhetskopien', () => {
  const kopi = byggSikkerhetskopi({ innstillinger: [
    { nokkel: 'varseltidspunkt', verdi: '15:00' },
    { nokkel: 'kode-ansatt', verdi: { hash: 'x' } },
    { nokkel: 'kode-admin', verdi: { hash: 'y' } },
    { nokkel: 'kode-feil-ansatt', verdi: { antall: 2 } },
  ] });
  assert.deepEqual(kopi.data.innstillinger.map((r) => r.nokkel), ['varseltidspunkt']);
  assert.ok(erKodeNokkel('kode-admin') && !erKodeNokkel('varseltidspunkt'));
});

test('appen låses når den skjules, men ikke for et kort systemvindu', () => {
  assert.equal(skalLases(false, 0), true, 'skjult = lås');
  aapnerSystemvindu();
  assert.equal(skalLases(false, 1000), false, 'filvelger/deling/utskrift låser ikke');
  assert.equal(skalLases(true, 5000), false, 'tilbake innen to minutter');
  aapnerSystemvindu();
  skalLases(false, 1000);
  assert.equal(skalLases(true, 1000 + SYSTEMVINDU_MAKS + 1), true, 'borte for lenge = lås');
});

test('administratormodus slutter når appen låses', () => {
  settLast(false);
  settAdmin(true);
  assert.equal(erAdmin(), true);
  settLast(true);
  assert.equal(erAdmin(), false);
  settAdmin(true);
  assert.equal(erAdmin(), false, 'kan ikke bli administrator mens appen er låst');
});

test('initialer: 2–4 bokstaver, store bokstaver, æøå tillatt (K-18)', async () => {
  const { kontrollerInitialer } = await import('../src/kode.js');
  assert.deepEqual(kontrollerInitialer(' kt '), { verdi: 'KT' });
  assert.deepEqual(kontrollerInitialer('øæå'), { verdi: 'ØÆÅ' });
  assert.deepEqual(kontrollerInitialer('K.T.'), { verdi: 'KT' });
  assert.ok(kontrollerInitialer('').feil);
  assert.ok(kontrollerInitialer('K').feil);
  assert.ok(kontrollerInitialer('ABCDE').feil);
  assert.ok(kontrollerInitialer('K1').feil);
});

test('initialene følger telefonen til noen bytter, ny dag eller lang pause (K-18)', async () => {
  const { maaSporeInitialer, lesLagredeInitialer } = await import('../src/kode.js');
  const naa = new Date(2026, 10, 9, 15, 0);
  const fersk = { verdi: 'KT', tid: new Date(2026, 10, 9, 14, 45).toISOString() };
  assert.equal(maaSporeInitialer(fersk, { naa }), false, 'samme person innen 30 min: ingen spørsmål');
  assert.equal(maaSporeInitialer(fersk, { naa, bytt: true }), true, '«Bytt» gir spørsmål');
  assert.equal(maaSporeInitialer({ verdi: 'KT', tid: new Date(2026, 10, 9, 14, 20).toISOString() }, { naa }), true, 'over 30 min');
  assert.equal(maaSporeInitialer({ verdi: 'KT', tid: new Date(2026, 10, 8, 14, 50).toISOString() }, { naa }), true, 'ny dag');
  assert.equal(maaSporeInitialer(null, { naa }), true);
  assert.deepEqual(lesLagredeInitialer('KT'), { verdi: 'KT', tid: null }, 'eldre format');
  assert.equal(maaSporeInitialer('KT', { naa }), true, 'eldre format spør én gang');
});
