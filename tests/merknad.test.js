import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merknadIDag, nullstillPlan } from '../src/model/merknad.js';
import { avtaleFra } from '../src/model/elev.js';
import { avslutningStatus, dagsoppsummering } from '../src/model/avslutning.js';

const idag = '2026-11-12';

test('merknaden vises bare den dagen den ble skrevet', () => {
  assert.equal(merknadIDag({ fritekst: 'Hentes av bestemor i dag', fritekstDato: idag }, idag), 'Hentes av bestemor i dag');
  assert.equal(merknadIDag({ fritekst: 'Hentes av bestemor i dag', fritekstDato: '2026-11-11' }, idag), '');
  assert.equal(merknadIDag({ fritekst: 'Gammel fast merknad' }, idag), '', 'eldre merknader uten dato vises ikke');
  assert.equal(merknadIDag(undefined, idag), '');
});

test('avtaleFra lagrer datoen merknaden gjelder', () => {
  assert.equal(avtaleFra('a', { fritekst: 'Hentes kl. 15', fritekstDato: idag }).fritekstDato, idag);
  assert.equal(avtaleFra('a', { fastHentetid: '16:00', fritekst: '', fritekstDato: idag }).fritekstDato, null);
});

test('nullstilling: gamle merknader slettes ved ny dag, alle når dagen avsluttes', () => {
  const avtaler = [
    { elevId: 'a', gaarHjemAleneFra: null, fastHentetid: null, fritekst: 'I går', fritekstDato: '2026-11-11' },
    { elevId: 'b', gaarHjemAleneFra: '15:00', fastHentetid: null, fritekst: 'Uten dato' },
    { elevId: 'c', gaarHjemAleneFra: null, fastHentetid: '16:00', fritekst: 'I dag', fritekstDato: idag },
    { elevId: 'd', gaarHjemAleneFra: null, fastHentetid: '16:00', fritekst: '', fritekstDato: null },
  ];
  const nyDag = nullstillPlan(avtaler, idag);
  assert.deepEqual(nyDag.slett, ['a'], 'avtale med bare merknad slettes helt');
  assert.deepEqual(nyDag.lagre.map((a) => [a.elevId, a.fritekst, a.gaarHjemAleneFra]), [['b', '', '15:00']], 'faste avtaler beholdes');
  const avsluttet = nullstillPlan(avtaler, idag, { alle: true });
  assert.deepEqual(avsluttet.lagre.map((a) => a.elevId).sort(), ['b', 'c']);
  assert.ok(avsluttet.lagre.every((a) => a.fritekst === '' && a.fritekstDato === null));
});

test('dagsavslutning: status og «endret etter avslutning» (K-21)', () => {
  const avsluttet = { dato: idag, tid: '2026-11-12T16:05:00.000Z' };
  assert.equal(avslutningStatus(null, idag), null);
  assert.equal(avslutningStatus({ ...avsluttet, dato: '2026-11-11' }, idag), null, 'gjelder bare samme dag');
  assert.deepEqual(avslutningStatus(avsluttet, idag, [{ dato: idag, tid: '2026-11-12T15:00:00.000Z' }]), { tid: avsluttet.tid, endretEtter: false });
  assert.equal(avslutningStatus(avsluttet, idag, [{ dato: idag, tid: '2026-11-12T16:10:00.000Z' }]).endretEtter, true);
});

test('«Takk for i dag» viser bare tall: møtt, fravær og avvik', () => {
  const s = dagsoppsummering({ inne: 1, sjekketUt: 20, meldtFravaer: 2, ikkeMott: 1, ikkeRegistrert: 3 },
    [{ antallForventet: 22, antallTalt: 22 }, { antallForventet: 21, antallTalt: 20 }]);
  assert.deepEqual(s, { mott: 21, meldtFravaer: 2, ikkeMott: 1, aldriRegistrert: 3, ikkeSjekketUt: 1, tellinger: 2, tellingerMedAvvik: 1 });
});
