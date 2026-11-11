import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lesXlsx, skrivXlsx } from '../src/import/xlsx.js';
import { lesElevliste, planleggImport, lagEndringer, MAL_KOLONNER, malRader, malForklaring } from '../src/import/elevliste.js';
import { tolkKlokkeslett, tolkSkolegruppe, tolkTrinn, kontrollerElev } from '../src/model/elev.js';

const H = MAL_KOLONNER.map((k) => k.navn);
const rad = (n, celler) => ({ rad: n, celler });
const ark = (...rader) => ({ rader: [rad(1, H), ...rader.map((c, i) => rad(i + 2, c))] });
// Fornavn, Etternavn, Trinn, Skolegruppe, Man, Tir, Ons, Tor, Fre, Går alene, Hentetid (+ en gammel Merknad-celle)
const emma = ['Emma', 'Testesen', 3, 'Gruppe 1 blå', 'X', 'X', '', 'X', '', '15:30', '', ''];
const noah = ['Noah', 'Prøvestad', 4, 'Gruppe 2 oppe', 'x', 'x', 'x', 'x', 'x', '', 0.6666666666666666, 'Hentes av mormor'];

let teller = 0;
const nyId = () => `ny-${++teller}`;
const fil = async (navn) => {
  const b = await readFile(fileURLToPath(new URL(`../testdata/${navn}`, import.meta.url)));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};

// ---------- Tolking av felter ----------

test('klokkeslett fra tekst og Excel-tall', () => {
  assert.equal(tolkKlokkeslett('15:30'), '15:30');
  assert.equal(tolkKlokkeslett('15.30'), '15:30');
  assert.equal(tolkKlokkeslett('1530'), '15:30');
  assert.equal(tolkKlokkeslett('9'), '09:00');
  assert.equal(tolkKlokkeslett(0.6458333333333334), '15:30');
  assert.equal(tolkKlokkeslett(46000.6666666667), '16:00');
  assert.equal(tolkKlokkeslett(''), null);
  assert.throws(() => tolkKlokkeslett('halv fire'));
  assert.throws(() => tolkKlokkeslett('25:00'));
});

test('trinn og skolegruppe tolkes med vanlige skrivemåter', () => {
  assert.equal(tolkTrinn('3.'), 3);
  assert.equal(tolkTrinn('4. trinn'), 4);
  assert.equal(tolkTrinn(5), null);
  assert.equal(tolkSkolegruppe('gruppe 1 BLÅ'), 'Gruppe 1 blå');
  assert.equal(tolkSkolegruppe('Gr. 2 nede'), 'Gruppe 2 nede');
  assert.equal(tolkSkolegruppe('Gruppe1 grønn'), 'Gruppe 1 grønn');
  assert.equal(tolkSkolegruppe('Gruppe 3'), null);
});

test('trinn og skolegruppe må passe sammen (K-05)', () => {
  const { feil } = kontrollerElev({ fornavn: 'A', etternavn: 'B', trinn: 4, skolegruppe: 'Gruppe 1 blå', ukedager: [1] });
  assert.ok(feil.some((f) => /passer ikke med 4\. trinn/.test(f)));
});

// ---------- Lesing av elevlista ----------

test('leser gyldige rader med ukedager og avtaler', () => {
  const r = lesElevliste(ark(emma, noah));
  assert.deepEqual(r.feil, []);
  assert.equal(r.elever.length, 2);
  assert.deepEqual(r.elever[0].ukedager, [1, 2, 4]);
  assert.equal(r.elever[0].gaarHjemAleneFra, '15:30');
  assert.equal(r.elever[1].fastHentetid, '16:00');
  assert.equal(r.elever[1].fritekst, '', 'merknad leses ikke fra fila');
});

test('kolonnen «Merknad» i eldre filer leses ikke, men gir en forklarende melding', () => {
  const r = lesElevliste({ rader: [rad(1, [...H, 'Merknad']), rad(2, noah)] });
  assert.deepEqual(r.feil, []);
  assert.equal(r.elever[0].fritekst, '');
  assert.ok(r.advarsler.some((a) => /Merknad.*leses ikke.*beskjeder for dagen/.test(a)));
  assert.ok(!H.includes('Merknad'), 'malen har ikke kolonnen Merknad');
});

test('import beholder dagens merknad', () => {
  const elever = [{ id: 'n', fornavn: 'Noah', etternavn: 'Prøvestad', trinn: 4, skolegruppe: 'Gruppe 2 oppe', ukedager: [1, 2, 3, 4, 5], aktiv: true }];
  const avtaler = [{ elevId: 'n', gaarHjemAleneFra: null, fastHentetid: '16:00', fritekst: 'Hentes av bestemor i dag', fritekstDato: '2026-11-12' }];
  const plan = planleggImport(lesElevliste(ark(noah)).elever, elever, avtaler);
  const e = lagEndringer(plan, {}, { nyId });
  assert.equal(e.sammendrag.ingenEndringer, true);
});

test('tomme rader hoppes over, og overskrift kan ha en tittelrad over seg', () => {
  const r = lesElevliste({ rader: [rad(1, ['Elevliste SFO 2026']), rad(2, H), rad(3, emma), rad(5, noah)] });
  assert.equal(r.elever.length, 2);
  assert.equal(r.elever[1].rad, 5);
});

test('gir feil med radnummer, og ingen elever lagres når fila har feil (K-01)', () => {
  const r = lesElevliste(ark(
    emma,
    ['Ola', '', 2, 'Gruppe 1 blå', 'X', '', '', '', '', '', '', ''],
    ['Kari', 'Li', 4, 'Gruppe 1 grønn', 'X', '', '', '', '', '', '', ''],
    ['Per', 'Ås', 2, 'Gruppe 1 blå', 'kanskje', '', '', '', '', 'snart', '', ''],
    ['Tom', 'Tom', 1, 'Gruppe 1 blå', '', '', '', '', '', '', '', ''],
  ));
  assert.ok(r.feil.some((f) => /^Rad 3 \(Ola\): Etternavn mangler/.test(f)));
  assert.ok(r.feil.some((f) => /^Rad 4 .*passer ikke/.test(f)));
  assert.ok(r.feil.some((f) => /^Rad 5 .*Man: «kanskje»/.test(f)));
  assert.ok(r.feil.some((f) => /^Rad 5 .*Går hjem alene fra/.test(f)));
  assert.ok(r.feil.some((f) => /^Rad 6 .*ingen SFO-dager/.test(f)));
});

test('samme navn og trinn to ganger i fila er feil', () => {
  const r = lesElevliste(ark(emma, emma));
  assert.ok(r.feil.some((f) => /står også på rad 2/.test(f)));
});

test('manglende kolonner gir én tydelig feil', () => {
  const r = lesElevliste({ rader: [rad(1, ['Fornavn', 'Etternavn']), rad(2, ['A', 'B'])] });
  assert.equal(r.feil.length, 1);
  assert.match(r.feil[0], /mangler kolonnene «Trinn», «Skolegruppe»/);
});

test('fil uten overskrift avvises', () => {
  assert.match(lesElevliste({ rader: [rad(1, ['Hei'])] }).feil[0], /overskriftsraden/);
});

// ---------- Matching og endringer (K-02) ----------

const elevA = { id: 'a', fornavn: 'Emma', etternavn: 'Testesen', trinn: 3, skolegruppe: 'Gruppe 1 blå', ukedager: [1, 2, 4], aktiv: true };
const avtaleA = { elevId: 'a', gaarHjemAleneFra: '15:30', fastHentetid: null, fritekst: '' };

test('første import: alle er nye', () => {
  const { elever } = lesElevliste(ark(emma, noah));
  const e = lagEndringer(planleggImport(elever, [], []), {}, { nyId });
  assert.equal(e.sammendrag.nye.length, 2);
  assert.equal(e.elever.length, 2);
  assert.equal(e.avtalerLagre.length, 2);
});

test('samme fil to ganger gir ingen duplikater og ingen endringer', () => {
  const { elever: imp } = lesElevliste(ark(emma, noah));
  const forste = lagEndringer(planleggImport(imp, [], []), {}, { nyId });
  const andre = lagEndringer(planleggImport(imp, forste.elever, forste.avtalerLagre), {}, { nyId });
  assert.equal(andre.sammendrag.nye.length, 0);
  assert.equal(andre.sammendrag.uendret, 2);
  assert.equal(andre.sammendrag.ingenEndringer, true);
});

test('store/små bokstaver og ekstra mellomrom i navn gir treff', () => {
  const { elever: imp } = lesElevliste(ark(['  emma ', 'TESTESEN', 3, 'Gruppe 1 blå', 'X', 'X', '', 'X', '', '15:30', '', '']));
  const e = lagEndringer(planleggImport(imp, [elevA], [avtaleA]), {}, { nyId });
  assert.equal(e.sammendrag.nye.length, 0);
  assert.deepEqual(e.sammendrag.oppdatert[0].endringer, ['skrivemåte på navn']);
});

test('endrede felter oppdateres, og fjernede avtaler slettes', () => {
  const { elever: imp } = lesElevliste(ark(['Emma', 'Testesen', 3, 'Gruppe 1 grønn', 'X', '', '', '', 'X', '', '', '']));
  const e = lagEndringer(planleggImport(imp, [elevA], [avtaleA]), {}, { nyId });
  assert.deepEqual(e.sammendrag.oppdatert[0].endringer, ['Gruppe 1 blå → Gruppe 1 grønn', 'SFO-dager', 'går hjem alene']);
  assert.deepEqual(e.avtalerSlett, ['a']);
  assert.equal(e.elever[0].id, 'a');
});

test('elev som har gått opp et trinn beholder ID og historikk', () => {
  const { elever: imp } = lesElevliste(ark(['Emma', 'Testesen', 4, 'Gruppe 2 oppe', 'X', 'X', '', 'X', '', '15:30', '', '']));
  const e = lagEndringer(planleggImport(imp, [elevA], [avtaleA]), {}, { nyId });
  assert.equal(e.sammendrag.gattOpp.length, 1);
  assert.equal(e.elever[0].id, 'a');
  assert.equal(e.elever[0].trinn, 4);
});

test('elever som mangler i fila deaktiveres, ikke slettes', () => {
  const { elever: imp } = lesElevliste(ark(noah));
  const e = lagEndringer(planleggImport(imp, [elevA], [avtaleA]), {}, { nyId });
  assert.deepEqual(e.sammendrag.deaktiveres, ['Emma Testesen (3. trinn)']);
  assert.equal(e.elever.find((x) => x.id === 'a').aktiv, false);
  assert.deepEqual(e.avtalerSlett, []);
});

test('deaktivert elev som står i fila igjen, aktiveres', () => {
  const { elever: imp } = lesElevliste(ark(emma));
  const e = lagEndringer(planleggImport(imp, [{ ...elevA, aktiv: false }], [avtaleA]), {}, { nyId });
  assert.equal(e.sammendrag.reaktivert.length, 1);
  assert.equal(e.elever[0].aktiv, true);
});

test('to elever med samme navn og trinn: den ansatte må velge (navnelikhet)', () => {
  const tvilling = { ...elevA, id: 'b', skolegruppe: 'Gruppe 1 grønn' };
  const { elever: imp } = lesElevliste(ark(emma));
  const plan = planleggImport(imp, [elevA, tvilling], [avtaleA]);
  assert.equal(plan.rader[0].type, 'tvetydig');
  assert.deepEqual(plan.rader[0].kandidater, ['a', 'b']);
  assert.throws(() => lagEndringer(plan, {}, { nyId }), /Velg hvem Emma Testesen/);
  const e = lagEndringer(plan, { 2: 'b' }, { nyId });
  assert.equal(e.elever.find((x) => x.id === 'b').aktiv, true);
  assert.equal(e.elever.find((x) => x.id === 'a').aktiv, false);
  const ny = lagEndringer(plan, { 2: 'ny' }, { nyId });
  assert.equal(ny.sammendrag.nye.length, 1);
});

// ---------- Excel-filer ----------

test('malen kan leses tilbake og har riktige overskrifter', async () => {
  const bytes = skrivXlsx([
    { navn: 'Elever', rader: [...malRader(), emma], frysForsteRad: true },
    { navn: 'Forklaring', rader: malForklaring() },
  ]);
  const { ark: a } = await lesXlsx(bytes.buffer);
  assert.deepEqual(a.map((x) => x.navn), ['Elever', 'Forklaring']);
  const r = lesElevliste(a[0]);
  assert.deepEqual(r.feil, []);
  assert.equal(r.elever[0].fornavn, 'Emma');
});

test('fiktiv elevliste i testdata/ importeres to ganger uten duplikater (fase 2a-kriteriet)', async () => {
  const { ark: a } = await lesXlsx(await fil('fiktive-elever.xlsx'));
  const { elever: imp, feil } = lesElevliste(a[0]);
  assert.deepEqual(feil, []);
  assert.equal(imp.length, 32);
  const forste = lagEndringer(planleggImport(imp, [], []), {}, { nyId });
  const andre = lagEndringer(planleggImport(imp, forste.elever, forste.avtalerLagre), {}, { nyId });
  assert.equal(andre.sammendrag.ingenEndringer, true);
});

test('Excel-fil lagret av LibreOffice (komprimert, delte tekster, ekte klokkeslett) leses likt', async () => {
  const egen = lesElevliste((await lesXlsx(await fil('fiktive-elever.xlsx'))).ark[0]).elever;
  const lo = lesElevliste((await lesXlsx(await fil('fiktive-elever-libreoffice.xlsx'))).ark[0]);
  assert.deepEqual(lo.feil, []);
  assert.deepEqual(lo.elever.map(({ rad: _, ...e }) => e), egen.map(({ rad: _, ...e }) => e));
});

test('endret elevliste gir forventede endringer', async () => {
  const imp1 = lesElevliste((await lesXlsx(await fil('fiktive-elever.xlsx'))).ark[0]).elever;
  const imp2 = lesElevliste((await lesXlsx(await fil('fiktive-elever-endret.xlsx'))).ark[0]).elever;
  const forste = lagEndringer(planleggImport(imp1, [], []), {}, { nyId });
  const s = lagEndringer(planleggImport(imp2, forste.elever, forste.avtalerLagre), {}, { nyId }).sammendrag;
  assert.equal(s.nye.length, 1);
  assert.equal(s.deaktiveres.length, 1);
  assert.equal(s.gattOpp.length, 1);
  assert.equal(s.oppdatert.length, 1);
});

test('filer som ikke er .xlsx avvises med forståelig melding', async () => {
  await assert.rejects(lesXlsx(new TextEncoder().encode('Fornavn;Etternavn').buffer), /ikke en Excel-fil/);
});
