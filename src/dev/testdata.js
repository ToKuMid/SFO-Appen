// Fiktive testdata for utvikling og test (IF-10). Ingen av navnene er ekte elever.
// Samme frø gir alltid samme data, slik at tester og skjermbilder blir like.

import { DATAVERSJON } from '../db.js';
import { lokalDato, ukedagNr } from '../dato.js';
import { SKOLEGRUPPER } from '../model/elev.js';

// Skolegrupper etter kravspesifikasjonen kapittel 7 (samme regel som i appen).
export { SKOLEGRUPPER };

const FORNAVN = ['Emma', 'Noah', 'Nora', 'Oskar', 'Ella', 'Lukas', 'Sofie', 'Filip', 'Olivia', 'Jakob',
  'Ingrid', 'Aksel', 'Maja', 'Isak', 'Frida', 'Emil', 'Leah', 'Henrik', 'Sara', 'Theo',
  'Hedda', 'Johannes', 'Alma', 'Magnus', 'Tiril', 'Elias', 'Live', 'Mathias', 'Selma', 'William',
  'Iben', 'Sander', 'Mia', 'Tobias', 'Ylva', 'Kasper'];
const ETTERNAVN = ['Testesen', 'Prøvestad', 'Eksempelsen', 'Fiktivdal', 'Øvingsrud', 'Demoberg',
  'Utkastvik', 'Skissebakken', 'Malmo', 'Plassholdersen', 'Lekeland', 'Dummyhaug'];

function tilfeldig(frø) {
  // mulberry32: liten, forutsigbar tallgenerator
  let a = frø >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function testId(prefiks, n) {
  return `${prefiks}-${String(n).padStart(4, '0')}`;
}

/**
 * Lager et komplett, fiktivt datasett.
 * antall: antall elever. dager: antall tidligere skoledager med hendelser og tellinger.
 */
export function lagTestdata({ antall = 32, dager = 10, naa = new Date(), frø = 2026 } = {}) {
  const r = tilfeldig(frø);
  const velg = (liste) => liste[Math.floor(r() * liste.length)];

  const elever = [];
  const avtaler = [];
  const brukteNavn = new Set();
  for (let i = 1; i <= antall; i++) {
    let fornavn, etternavn;
    do {
      fornavn = velg(FORNAVN);
      etternavn = velg(ETTERNAVN);
    } while (brukteNavn.has(fornavn + etternavn));
    brukteNavn.add(fornavn + etternavn);

    const trinn = 1 + Math.floor(r() * 4);
    const ukedager = [1, 2, 3, 4, 5].filter(() => r() < 0.85);
    if (ukedager.length === 0) ukedager.push(1 + Math.floor(r() * 5));
    const elev = {
      id: testId('elev', i),
      fornavn,
      etternavn,
      trinn,
      skolegruppe: velg(SKOLEGRUPPER[trinn]),
      ukedager,
      aktiv: true,
    };
    elever.push(elev);

    if (r() < 0.3) {
      avtaler.push({
        elevId: elev.id,
        gaarHjemAleneFra: trinn >= 3 && r() < 0.6 ? velg(['15:00', '15:30', '16:00']) : null,
        fastHentetid: r() < 0.5 ? velg(['15:30', '16:00', '16:30']) : null,
        // Merknad for i dag (model/merknad.js), som en beskjed fra Barn-nett.
        fritekst: r() < 0.4 ? velg(['Hentes av bestemor i dag', 'Skal på fotball kl. 16 i dag']) : '',
      });
      const a = avtaler[avtaler.length - 1];
      a.fritekstDato = a.fritekst ? lokalDato(naa) : null;
    }
  }

  // Tidligere skoledager (mandag–fredag) før i dag.
  const datoer = [];
  const d = new Date(naa);
  d.setHours(12, 0, 0, 0);
  while (datoer.length < dager) {
    d.setDate(d.getDate() - 1);
    if (ukedagNr(d) <= 5) datoer.unshift(new Date(d));
  }

  const hendelser = [];
  const tellinger = [];
  const tellingslinjer = [];
  let h = 0, t = 0, tl = 0;
  const tid = (dag, timer, min) => {
    const x = new Date(dag);
    x.setHours(timer, min, 0, 0);
    return x.toISOString();
  };

  datoer.forEach((dag, dagNr) => {
    const dato = lokalDato(dag);
    const forventet = elever.filter((e) => e.ukedager.includes(ukedagNr(dag)));
    const inne = [];
    for (const e of forventet) {
      const x = r();
      if (x < 0.06) {
        hendelser.push({ id: testId('hend', ++h), elevId: e.id, dato, tid: tid(dag, 14, 40), type: 'meldt-fravaer', initialer: 'AB', erstatter: null });
        continue;
      }
      if (x < 0.08) {
        hendelser.push({ id: testId('hend', ++h), elevId: e.id, dato, tid: tid(dag, 15, 10), type: 'ikke-mott', initialer: 'CD', erstatter: null });
        continue;
      }
      hendelser.push({ id: testId('hend', ++h), elevId: e.id, dato, tid: tid(dag, 14, 45 + Math.floor(r() * 8)), type: 'inn', initialer: null, erstatter: null });
      inne.push(e);
    }
    // Hver fjerde dag mangler ett barn ved tellingen (avvik med kommentar, K-31, K-32).
    const mangler = dagNr % 4 === 3 && inne.length ? inne[0] : null;
    tellinger.push({
      id: testId('tell', ++t), dato, tid: tid(dag, 15, 30), antallForventet: inne.length,
      antallTalt: inne.length - (mangler ? 1 : 0), initialer: velg(['AB', 'CD', 'EF']), kommentar: mangler ? 'Var på do, funnet etter 2 min' : '',
    });
    for (const e of inne) tellingslinjer.push({ id: testId('tlin', ++tl), tellingId: testId('tell', t), elevId: e.id, talt: e !== mangler });
    inne.forEach((e, i) => {
      // Én dag blir ett barn aldri sjekket ut, så det vises i rapporten.
      if (dagNr === 5 && i === inne.length - 1) return;
      hendelser.push({
        id: testId('hend', ++h), elevId: e.id, dato, tid: tid(dag, 15 + Math.floor(r() * 2), 35 + Math.floor(r() * 25)),
        type: 'ut', initialer: r() < 0.7 ? velg(['AB', 'CD', 'EF']) : null, erstatter: null,
      });
    });
  });

  return {
    elever,
    avtaler,
    unntak: [],
    hendelser,
    tellinger,
    tellingslinjer,
    innstillinger: [
      { nokkel: 'dataversjon', verdi: DATAVERSJON },
      { nokkel: 'testdata', verdi: true },
    ],
  };
}
