import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datoerMellom, grupperapport, kontrollerPeriode, kortNavn, kortNavnFor, periode } from '../src/model/rapport.js';
import { lagHendelse } from '../src/model/status.js';

// Uke 46, 2026: mandag 9. – fredag 13. november
let n = 0;
const kl = (dag, t, m) => new Date(2026, 10, dag, t, m);
const hend = (elevId, type, dag, t, m, ekstra = {}) => lagHendelse({ id: `h${++n}`, elevId, type, naa: kl(dag, t, m), ...ekstra });

const emma = { id: 'emma', fornavn: 'Emma', etternavn: 'Testesen', trinn: 2, skolegruppe: 'Gruppe 1 blå', ukedager: [1, 2, 3, 4, 5], aktiv: true };
const noah = { id: 'noah', fornavn: 'Noah', etternavn: 'Prøvestad', trinn: 4, skolegruppe: 'Gruppe 2 oppe', ukedager: [1, 3], aktiv: true };
const sara = { id: 'sara', fornavn: 'Sara', etternavn: 'Demoberg', trinn: 3, skolegruppe: 'Gruppe 1 grønn', ukedager: [1], aktiv: false };

test('perioder: i dag, denne uka (fra mandag) og denne måneden', () => {
  assert.deepEqual(periode('dag', '2026-11-11'), { fra: '2026-11-11', til: '2026-11-11' });
  assert.deepEqual(periode('uke', '2026-11-11'), { fra: '2026-11-09', til: '2026-11-11' });
  assert.deepEqual(periode('uke', '2026-11-15'), { fra: '2026-11-09', til: '2026-11-15' }, 'søndag hører til uka som startet mandag');
  assert.deepEqual(periode('maaned', '2026-11-11'), { fra: '2026-11-01', til: '2026-11-11' });
});

test('egen periode kontrolleres', () => {
  assert.equal(kontrollerPeriode('2026-11-01', '2026-11-11', '2026-11-11'), null);
  assert.match(kontrollerPeriode('2026-11-12', '2026-11-11', '2026-11-20'), /før til-dato/);
  assert.match(kontrollerPeriode('2026-12-01', '2026-12-02', '2026-11-11'), /framtiden/);
  assert.match(kontrollerPeriode('2025-01-01', '2026-11-11', '2026-11-11'), /høyst ett år/);
  assert.match(kontrollerPeriode('', '2026-11-11'), /både fra- og til-dato/);
  assert.equal(datoerMellom('2026-10-30', '2026-11-02').length, 4);
});

test('grupperapport: per dag, tellinger, avvik og fravær (K-50)', () => {
  const hendelser = [
    // Mandag: Emma inn og ut, Noah meldt fravær, Sara (nå deaktivert) inn og ut
    hend('emma', 'inn', 9, 14, 46), hend('emma', 'ut', 9, 16, 0),
    hend('noah', 'meldt-fravaer', 9, 12, 0, { initialer: 'KT' }),
    hend('sara', 'inn', 9, 14, 50), hend('sara', 'ut', 9, 15, 40),
    // Tirsdag: Emma inn, aldri ut
    hend('emma', 'inn', 10, 14, 48),
    // Onsdag: Emma ikke møtt, Noah aldri registrert
    hend('emma', 'ikke-mott', 11, 15, 10),
  ];
  const tellinger = [
    { id: 't1', dato: '2026-11-09', tid: kl(9, 15, 30).toISOString(), antallForventet: 2, antallTalt: 1, initialer: 'MH', kommentar: 'Var på do' },
    { id: 't2', dato: '2026-11-10', tid: kl(10, 15, 30).toISOString(), antallForventet: 1, antallTalt: 1, initialer: 'KT', kommentar: '' },
  ];
  const tellingslinjer = [
    { id: 'l1', tellingId: 't1', elevId: 'emma', talt: true },
    { id: 'l2', tellingId: 't1', elevId: 'sara', talt: false },
    { id: 'l3', tellingId: 't2', elevId: 'emma', talt: true },
  ];
  const r = grupperapport({
    elever: [emma, noah, sara], hendelser, tellinger, tellingslinjer, fra: '2026-11-09', til: '2026-11-13', idag: '2026-11-12',
  });

  assert.deepEqual(r.dager.map((d) => d.dato), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'], 'ingen dager etter i dag; torsdag uten registreringer tas med');
  const [man, tir, ons, tor] = r.dager;
  assert.equal(man.forventet, 2);
  assert.equal(man.mott, 2, 'deaktivert elev med registreringer telles med');
  assert.deepEqual(man.meldtFravaer, ['NoaP 4.trinn']);
  assert.equal(man.tellingerMedAvvik, 1);
  assert.deepEqual(tir.ikkeUtsjekket, ['EmmT 2.trinn']);
  assert.deepEqual(ons.ikkeMott, ['EmmT 2.trinn']);
  assert.deepEqual(ons.ikkeRegistrert, ['NoaP 4.trinn']);
  assert.equal(tor.ingenRegistreringer, true);
  assert.deepEqual(tor.ikkeRegistrert, [], 'dag uten registreringer gir ikke «ikke registrert» for alle');

  assert.equal(r.avvik.length, 1);
  assert.deepEqual(r.avvik[0].mangler, ['SarD 3.trinn']);
  assert.equal(r.avvik[0].kommentar, 'Var på do');
  assert.deepEqual(r.sammendrag, {
    sfoDager: 3, tellinger: 2, tellingerMedAvvik: 1, barnSomManglet: 1,
    meldtFravaer: 1, ikkeMott: 1, ikkeRegistrert: 1, ikkeUtsjekket: 1, dagerUtenTelling: 1,
  });
});

test('angrede registreringer telles ikke i rapporten', () => {
  const r = grupperapport({
    elever: [emma],
    hendelser: [hend('emma', 'meldt-fravaer', 9, 12, 0), hend('emma', 'angret', 9, 12, 5, { erstatter: `h${n}` }), hend('emma', 'inn', 9, 14, 50)],
    tellinger: [], tellingslinjer: [], fra: '2026-11-09', til: '2026-11-09', idag: '2026-11-09',
  });
  assert.deepEqual(r.dager[0].meldtFravaer, []);
  assert.equal(r.dager[0].mott, 1);
});

test('helg uten registreringer er ikke med', () => {
  const r = grupperapport({ elever: [emma], hendelser: [], tellinger: [], tellingslinjer: [], fra: '2026-11-14', til: '2026-11-15', idag: '2026-11-20' });
  assert.deepEqual(r.dager, []);
  assert.equal(r.sammendrag.sfoDager, 0);
});

test('forkortede navn: tre bokstaver av fornavn, én av etternavn og trinn', () => {
  assert.equal(kortNavn({ fornavn: 'Sander', etternavn: 'Øvingsrud', trinn: 3 }), 'SanØ 3.trinn');
  assert.equal(kortNavn({ fornavn: 'BO', etternavn: 'li', trinn: 1 }), 'BoL 1.trinn');
  assert.equal(kortNavn({ fornavn: 'Ole-Martin', etternavn: 'de Lange', trinn: 2 }), 'OleD 2.trinn');
  assert.equal(kortNavn({ fornavn: 'Åse', etternavn: 'Ærø', trinn: 4 }), 'ÅseÆ 4.trinn');
});

test('forkortede navn blir aldri like i samme rapport', () => {
  const k = kortNavnFor([
    { id: 'a', fornavn: 'Sander', etternavn: 'Øvingsrud', trinn: 3 },
    { id: 'b', fornavn: 'Sandra', etternavn: 'Ølberg', trinn: 3 },
    { id: 'c', fornavn: 'Sander', etternavn: 'Øvingsrud', trinn: 3 },
    { id: 'd', fornavn: 'Sander', etternavn: 'Øvingsrud', trinn: 2 },
    { id: 'e', fornavn: 'Emma', etternavn: 'Testesen', trinn: 2 },
  ]);
  assert.equal(k.get('b'), 'SanØl 3.trinn');
  assert.equal(k.get('a'), 'SanØv 3.trinn (1)');
  assert.equal(k.get('c'), 'SanØv 3.trinn (2)');
  assert.equal(k.get('d'), 'SanØ 2.trinn');
  assert.equal(k.get('e'), 'EmmT 2.trinn');
  assert.equal(new Set(k.values()).size, 5);
});

test('elevrapport: inn, ut, fravær, rettelser og telling der barnet manglet (K-51)', async () => {
  const { elevrapport } = await import('../src/model/rapport.js');
  const innMan = hend('emma', 'inn', 9, 14, 46);
  const hendelser = [
    innMan, hend('emma', 'ut', 9, 15, 0, { initialer: 'MH' }), hend('emma', 'inn', 9, 15, 30), hend('emma', 'ut', 9, 16, 10, { initialer: 'KT' }),
    lagHendelse({ id: 'rett', elevId: 'emma', type: 'inn', naa: kl(9, 14, 50), erstatter: innMan.id }),
    hend('emma', 'meldt-fravaer', 10, 12, 0, { initialer: 'KT' }),
    hend('emma', 'inn', 11, 14, 47),
    hend('noah', 'inn', 9, 14, 45),
  ];
  const tellinger = [{ id: 't1', dato: '2026-11-11', tid: kl(11, 15, 30).toISOString(), antallForventet: 2, antallTalt: 1, initialer: 'EF', kommentar: 'Var på do' }];
  const tellingslinjer = [{ id: 'l1', tellingId: 't1', elevId: 'emma', talt: false }];
  const r = elevrapport({ elev: emma, elever: [emma, noah], hendelser, tellinger, tellingslinjer, fra: '2026-11-09', til: '2026-11-13', idag: '2026-11-13' });

  assert.equal(r.navn, 'EmmT 2.trinn');
  assert.deepEqual(r.dager.map((d) => d.dato), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  const [man, tir, ons, tor, fre] = r.dager;
  assert.equal(man.inn.length, 2, 'to innsjekker samme dag');
  assert.equal(man.inn[0].rettet, true, 'rettet tidspunkt merkes');
  assert.deepEqual(man.ut.map((u) => u.initialer), ['MH', 'KT']);
  assert.deepEqual(tir.fravaer, { type: 'meldt-fravaer', initialer: 'KT' });
  assert.equal(ons.ikkeUtsjekket, true);
  assert.equal(ons.mangletVedTelling[0].kommentar, 'Var på do');
  assert.equal(tor.aldriRegistrert, true);
  assert.equal(fre.aldriRegistrert, false, 'i dag regnes ikke som aldri registrert ennå');
  assert.equal(r.harRettelser, true);
  assert.deepEqual(r.sammendrag, {
    forventetDager: 5, mottDager: 2, meldtFravaer: 1, ikkeMott: 0, aldriRegistrert: 1, ikkeUtsjekket: 1, mangletVedTelling: 1, ekstraDager: 0,
  });
});

test('elevrapport: ekstra SFO-dag og deaktivert elev', async () => {
  const { elevrapport } = await import('../src/model/rapport.js');
  const r = elevrapport({
    elev: sara, elever: [emma, noah, sara],
    hendelser: [hend('sara', 'inn', 10, 14, 50), hend('sara', 'ut', 10, 16, 0)],
    unntak: [{ id: 'u1', elevId: 'sara', dato: '2026-11-10', type: 'ekstra-dag' }],
    tellinger: [], tellingslinjer: [], fra: '2026-11-09', til: '2026-11-10', idag: '2026-11-20',
  });
  assert.deepEqual(r.dager.map((d) => d.dato), ['2026-11-09', '2026-11-10'], 'deaktivert elev får rapport for dagene etter ukeplanen');
  assert.equal(r.dager[1].ekstraDag, true);
  assert.equal(r.sammendrag.ekstraDager, 1);
});

test('bunnteksten i rapportene har bare utskriftstid, app og versjon', async () => {
  const { readFile } = await import('node:fs/promises');
  const les = (f) => readFile(new URL(f, import.meta.url), 'utf8');
  const felles = await les('../src/ui/rapportfelles.js');
  const bunn = felles.slice(felles.indexOf('export const rapportBunn'));
  assert.match(bunn, /`Skrevet ut \$\{utskrevet\} · SFO-appen \$\{APP_VERSJON\}`/);
  assert.doesNotMatch(bunn.split('\n')[0], /personopplysninger|OneDrive|lagringstid/);
  for (const fil of ['../src/ui/rapport.js', '../src/ui/elevrapport.js', '../src/ui/avviksrapport.js']) {
    const kilde = await les(fil);
    assert.match(kilde, /rapportBunn\(utskrevet\)/, `${fil} bruker felles bunntekst`);
    assert.doesNotMatch(kilde, /rapport-bunn|personopplysninger om barn|lagringstid/, `${fil} har ingen egen bunntekst`);
  }
});

test('avviksrapport: bare avvik, ikke møtt skilt fra aldri registrert, barn med flere avvik (K-54)', async () => {
  const { avviksrapport } = await import('../src/model/rapport.js');
  const hendelser = [
    hend('emma', 'inn', 9, 14, 46), hend('emma', 'ut', 9, 16, 0),
    hend('noah', 'meldt-fravaer', 9, 12, 0, { initialer: 'KT' }),
    hend('emma', 'inn', 10, 14, 48),
    hend('emma', 'ikke-mott', 11, 15, 10, { initialer: 'MH' }),
  ];
  const tellinger = [{ id: 't1', dato: '2026-11-09', tid: kl(9, 15, 30).toISOString(), antallForventet: 2, antallTalt: 1, initialer: 'MH', kommentar: 'Var på do' }];
  const tellingslinjer = [{ id: 'l1', tellingId: 't1', elevId: 'emma', talt: false }, { id: 'l2', tellingId: 't1', elevId: 'noah', talt: true }];
  const r = avviksrapport({ elever: [emma, noah, sara], hendelser, tellinger, tellingslinjer, fra: '2026-11-09', til: '2026-11-13', idag: '2026-11-13' });

  assert.equal(r.tellingAvvik.length, 1);
  assert.deepEqual(r.tellingAvvik[0].mangler, ['EmmT 2.trinn']);
  assert.deepEqual(r.ikkeMott.map((x) => [x.dato, x.navn, x.initialer]), [['2026-11-11', 'EmmT 2.trinn', 'MH']]);
  assert.deepEqual(r.aldriRegistrert.map((x) => [x.dato, x.navn]), [['2026-11-11', 'NoaP 4.trinn']], 'meldt fravær er ikke avvik');
  assert.deepEqual(r.ikkeUtsjekket.map((x) => x.dato), ['2026-11-10']);
  assert.deepEqual(r.dagerUtenTelling, ['2026-11-10', '2026-11-11']);
  assert.deepEqual(r.dagerUtenRegistreringer.map((d) => d.dato), ['2026-11-12'], 'torsdag uten registreringer, men ikke i dag');
  assert.deepEqual(r.flereAvvik.map((x) => [x.navn, x.totalt]), [['EmmT 2.trinn', 3]], 'Emma: manglet, ikke sjekket ut og ikke møtt');
  assert.equal(r.ingenAvvik, false);

  const tom = avviksrapport({ elever: [emma], hendelser: [hend('emma', 'inn', 9, 14, 46), hend('emma', 'ut', 9, 16, 0)],
    tellinger: [{ id: 't9', dato: '2026-11-09', tid: kl(9, 15, 0).toISOString(), antallForventet: 1, antallTalt: 1 }], tellingslinjer: [],
    fra: '2026-11-09', til: '2026-11-09', idag: '2026-11-10' });
  assert.equal(tom.ingenAvvik, true);
});
