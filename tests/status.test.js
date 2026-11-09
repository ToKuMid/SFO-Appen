import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS, dagsoversikt, elevStatus, erForventet, gjeldendeHendelser, handlingerFor, lagHendelse, tellingResultat } from '../src/model/status.js';

// Mandag 9. november 2026
const DATO = '2026-11-09';
const kl = (t, m) => new Date(2026, 10, 9, t, m);
let n = 0;
const hend = (elevId, type, t, m, ekstra = {}) => lagHendelse({ id: `h${String(++n).padStart(3, '0')}`, elevId, type, naa: kl(t, m), ...ekstra });

const emma = { id: 'emma', fornavn: 'Emma', etternavn: 'T', trinn: 2, skolegruppe: 'Gruppe 1 blå', ukedager: [1, 3, 5], aktiv: true };
const noah = { id: 'noah', fornavn: 'Noah', etternavn: 'P', trinn: 4, skolegruppe: 'Gruppe 2 oppe', ukedager: [2, 4], aktiv: true };
const ola = { id: 'ola', fornavn: 'Ola', etternavn: 'D', trinn: 1, skolegruppe: 'Gruppe 1 grønn', ukedager: [1], aktiv: false };

test('forventet etter ukeplan (K-10)', () => {
  assert.equal(erForventet(emma, DATO), true);
  assert.equal(erForventet(noah, DATO), false);
  assert.equal(erForventet(ola, DATO), false, 'deaktivert elev er aldri forventet');
});

test('enkeltunntak for én dag (K-19)', () => {
  assert.equal(erForventet(emma, DATO, [{ elevId: 'emma', dato: DATO, type: 'ikke-sfo' }]), false);
  assert.equal(erForventet(noah, DATO, [{ elevId: 'noah', dato: DATO, type: 'ekstra-dag' }]), true);
  assert.equal(erForventet(emma, '2026-11-11', [{ elevId: 'emma', dato: DATO, type: 'ikke-sfo' }]), true, 'unntak gjelder bare én dato');
});

test('statuser fra hendelser (K-11, K-14)', () => {
  assert.equal(elevStatus(emma, DATO, []).status, STATUS.FORVENTET);
  assert.equal(elevStatus(noah, DATO, []).status, STATUS.IKKE_SFO);
  assert.equal(elevStatus(emma, DATO, [hend('emma', 'inn', 14, 47)]).status, STATUS.INNE);
  assert.equal(elevStatus(emma, DATO, [hend('emma', 'inn', 14, 47), hend('emma', 'ut', 15, 30)]).status, STATUS.UT);
  assert.equal(elevStatus(emma, DATO, [hend('emma', 'meldt-fravaer', 13, 0)]).status, STATUS.MELDT_FRAVAER);
  assert.equal(elevStatus(emma, DATO, [hend('emma', 'ikke-mott', 15, 10)]).status, STATUS.IKKE_MOTT);
});

test('flere inn og ut samme dag (K-17), «inne siden» følger siste inn', () => {
  const h = [hend('emma', 'inn', 14, 46), hend('emma', 'ut', 15, 0), hend('emma', 'inn', 15, 45)];
  const s = elevStatus(emma, DATO, h);
  assert.equal(s.status, STATUS.INNE);
  assert.equal(s.innSiden, kl(15, 45).toISOString());
});

test('angre fjerner siste handling (K-15)', () => {
  const inn = hend('emma', 'inn', 14, 46);
  const ut = hend('emma', 'ut', 15, 5);
  const angret = hend('emma', 'angret', 15, 6, { erstatter: ut.id });
  assert.equal(elevStatus(emma, DATO, [inn, ut, angret]).status, STATUS.INNE);
  const { fjernet } = gjeldendeHendelser([inn, ut, angret]);
  assert.equal(fjernet.get(ut.id), 'angret');
});

test('rettet tidspunkt tar plassen til den gamle hendelsen (K-15)', () => {
  const inn = hend('emma', 'inn', 14, 46);
  const ut = hend('emma', 'ut', 15, 30);
  const rettet = lagHendelse({ id: 'rett1', elevId: 'emma', type: 'ut', naa: kl(15, 10), erstatter: ut.id });
  const { gjeldende, fjernet, rettetTil } = gjeldendeHendelser([inn, ut, rettet]);
  assert.deepEqual(gjeldende.map((h) => h.id), [inn.id, 'rett1']);
  assert.equal(fjernet.get(ut.id), 'rettet');
  assert.equal(rettetTil.get(ut.id).id, 'rett1');
});

test('rettelse som flytter inn etter ut endrer status riktig', () => {
  const inn = hend('emma', 'inn', 14, 46);
  const ut = hend('emma', 'ut', 15, 0);
  const rettetInn = lagHendelse({ id: 'rett2', elevId: 'emma', type: 'inn', naa: kl(15, 30), erstatter: inn.id });
  assert.equal(elevStatus(emma, DATO, [inn, ut, rettetInn]).status, STATUS.INNE);
});

test('hendelser fra andre dager påvirker ikke dagens status', () => {
  const igaar = lagHendelse({ id: 'x', elevId: 'emma', type: 'inn', naa: new Date(2026, 10, 8, 14, 50) });
  assert.equal(elevStatus(emma, DATO, [igaar]).status, STATUS.FORVENTET);
});

test('dagsoversikt: tall og varsel etter varseltidspunktet (K-12, K-13, K-16)', () => {
  const elever = [emma, noah, { ...noah, id: 'lea', ukedager: [1] }, ola];
  const hendelser = [hend('lea', 'inn', 14, 50)];
  const foer = dagsoversikt({ elever, hendelser, dato: DATO, naa: kl(14, 55), varseltid: '15:00' });
  assert.equal(foer.tall.inne, 1);
  assert.equal(foer.tall.forventet, 2);
  assert.equal(foer.tall.ikkeRegistrert, 1);
  assert.equal(foer.varselAktivt, false);
  assert.deepEqual(foer.uregistrert, []);
  const etter = dagsoversikt({ elever, hendelser, dato: DATO, naa: kl(15, 0), varseltid: '15:00' });
  assert.equal(etter.varselAktivt, true);
  assert.deepEqual(etter.uregistrert.map((r) => r.elev.id), ['emma']);
  assert.equal(etter.rader.some((r) => r.elev.id === 'ola'), false, 'deaktivert elev uten hendelser vises ikke');
});

test('fravær registrert fører ikke til varsel', () => {
  const d = dagsoversikt({ elever: [emma], hendelser: [hend('emma', 'meldt-fravaer', 12, 0)], dato: DATO, naa: kl(15, 30) });
  assert.deepEqual(d.uregistrert, []);
  assert.equal(d.tall.meldtFravaer, 1);
});

test('ekstra barn som sjekkes inn uten å være forventet telles med', () => {
  const d = dagsoversikt({ elever: [emma, noah], hendelser: [hend('noah', 'inn', 15, 0)], dato: DATO, naa: kl(15, 5) });
  assert.equal(d.tall.inne, 1);
  assert.equal(d.tall.forventet, 2);
});

test('handlinger passer statusen', () => {
  assert.deepEqual(handlingerFor(STATUS.FORVENTET), ['inn', 'fravaer']);
  assert.deepEqual(handlingerFor(STATUS.INNE), ['ut']);
  assert.deepEqual(handlingerFor(STATUS.UT), ['inn']);
  assert.deepEqual(handlingerFor(STATUS.IKKE_SFO), ['ekstra-inn']);
});

test('initialer lagres med store bokstaver og maks fire tegn (K-18)', () => {
  assert.equal(lagHendelse({ id: 'a', elevId: 'e', type: 'ut', initialer: ' kt ' }).initialer, 'KT');
  assert.equal(lagHendelse({ id: 'a', elevId: 'e', type: 'ut', initialer: '' }).initialer, null);
  assert.equal(lagHendelse({ id: 'a', elevId: 'e', type: 'ut', initialer: 'abcdef' }).initialer, 'ABCD');
});

test('telling: talt, forventet og hvem som mangler (K-30, K-31)', () => {
  const inne = [emma, noah].map((e) => ({ elev: e }));
  const r = tellingResultat(inne, ['emma']);
  assert.equal(r.antallForventet, 2);
  assert.equal(r.antallTalt, 1);
  assert.deepEqual(r.mangler.map((x) => x.elev.id), ['noah']);
  assert.equal(tellingResultat(inne, ['emma', 'noah', 'ukjent']).antallTalt, 2, 'avhuking av barn som ikke er inne teller ikke');
});
