import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byggSikkerhetskopi, filnavn, kontroller, lesTekst, oppsummer, FORMAT } from '../src/backup.js';
import { DATAVERSJON, TABELLNAVN } from '../src/db.js';
import { lagTestdata } from '../src/dev/testdata.js';

const naa = new Date(2026, 10, 9, 16, 30);

test('filnavn følger SFO-backup-ÅÅÅÅ-MM-DD.json', () => {
  assert.equal(filnavn(naa), 'SFO-backup-2026-11-09.json');
  assert.equal(filnavn(new Date(2027, 0, 5, 23, 59)), 'SFO-backup-2027-01-05.json');
});

test('sikkerhetskopi har format, dataversjon og alle tabeller', () => {
  const k = byggSikkerhetskopi({ elever: [] }, { appversjon: '0.1.0', naa });
  assert.equal(k.format, FORMAT);
  assert.equal(k.dataversjon, DATAVERSJON);
  assert.equal(k.eksportert, naa.toISOString());
  assert.deepEqual(Object.keys(k.data).sort(), [...TABELLNAVN].sort());
});

test('rundtur: testdata → JSON → kontroll gir samme data', () => {
  const data = lagTestdata({ naa });
  const tekst = JSON.stringify(byggSikkerhetskopi(data, { naa }));
  const r = kontroller(lesTekst(tekst));
  assert.equal(r.ok, true, r.feil?.join('\n'));
  assert.deepEqual(r.kopi.data, data);
});

test('tom database kan tas sikkerhetskopi av og gjenopprettes', () => {
  const r = kontroller(byggSikkerhetskopi({}, { naa }));
  assert.equal(r.ok, true);
  assert.equal(oppsummer(r.kopi).elever, 0);
});

test('avviser fil som ikke er JSON', () => {
  assert.throws(() => lesTekst('dette er ikke json'), /ikke en gyldig sikkerhetskopi/);
});

test('avviser fil fra annet program', () => {
  const r = kontroller({ format: 'noe-annet', dataversjon: 1, data: {} });
  assert.equal(r.ok, false);
  assert.match(r.feil[0], /ikke en sikkerhetskopi fra SFO-appen/);
});

test('avviser sikkerhetskopi fra nyere appversjon', () => {
  const r = kontroller({ format: FORMAT, dataversjon: DATAVERSJON + 1, data: {} });
  assert.equal(r.ok, false);
  assert.match(r.feil[0], /nyere versjon/);
});

test('avviser dupliserte ID-er, manglende navn og ugyldig trinn', () => {
  const k = byggSikkerhetskopi({
    elever: [
      { id: 'a', fornavn: 'Test', etternavn: 'Testesen', trinn: 2 },
      { id: 'a', fornavn: '', etternavn: 'X', trinn: 7 },
    ],
  }, { naa });
  const r = kontroller(k);
  assert.equal(r.ok, false);
  assert.ok(r.feil.some((f) => /flere ganger/.test(f)));
  assert.ok(r.feil.some((f) => /mangler navn/.test(f)));
  assert.ok(r.feil.some((f) => /ugyldig trinn/.test(f)));
});

test('avviser hendelser som viser til elev som ikke finnes', () => {
  const k = byggSikkerhetskopi({
    elever: [],
    hendelser: [{ id: 'h1', elevId: 'finnes-ikke', dato: '2026-11-09', type: 'inn' }],
  }, { naa });
  const r = kontroller(k);
  assert.equal(r.ok, false);
  assert.ok(r.feil.some((f) => /elev som ikke finnes/.test(f)));
});

test('avviser ugyldig dato', () => {
  const k = byggSikkerhetskopi({
    elever: [{ id: 'e', fornavn: 'A', etternavn: 'B', trinn: 1 }],
    hendelser: [{ id: 'h1', elevId: 'e', dato: '9.11.2026', type: 'inn' }],
  }, { naa });
  assert.equal(kontroller(k).ok, false);
});

test('oppsummering viser antall og datoer', () => {
  const data = lagTestdata({ naa, antall: 10, dager: 3 });
  const o = oppsummer(byggSikkerhetskopi(data, { naa }));
  assert.equal(o.elever, 10);
  assert.equal(o.tellinger, 3);
  assert.ok(o.hendelser > 0);
  assert.ok(o.forsteDato < o.sisteDato);
  assert.ok(o.sisteDato < '2026-11-09');
});
