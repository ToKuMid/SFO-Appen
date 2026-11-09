// Dagens status for hvert barn, regnet ut fra hendelsene (kravspesifikasjonen kap. 3 og 6).
// Ren logikk uten nettleser-API-er, slik at den kan testes med `npm test`.
//
// Hver handling lagres som en hendelse. Status lagres aldri; den regnes ut her:
//   - «angret» fjerner hendelsen den viser til (erstatter)
//   - en rettelse er en ny hendelse av samme type som viser til den gamle (erstatter) og tar dens plass
//   - siste gjeldende hendelse bestemmer status
//
// Statuser (K-11): forventet, inne, sjekket-ut, meldt-fravaer, ikke-mott, ikke-sfo

import { lokalDato, ukedagNr } from '../dato.js';

export const STATUS = {
  FORVENTET: 'forventet',
  INNE: 'inne',
  UT: 'sjekket-ut',
  MELDT_FRAVAER: 'meldt-fravaer',
  IKKE_MOTT: 'ikke-mott',
  IKKE_SFO: 'ikke-sfo',
};

export const STATUS_TEKST = {
  forventet: 'Forventet',
  inne: 'Inne',
  'sjekket-ut': 'Sjekket ut',
  'meldt-fravaer': 'Meldt fravær',
  'ikke-mott': 'Ikke møtt',
  'ikke-sfo': 'Ikke SFO i dag',
};

export const HENDELSE_TEKST = {
  inn: 'Sjekket inn',
  ut: 'Sjekket ut',
  'meldt-fravaer': 'Meldt fravær',
  'ikke-mott': 'Ikke møtt',
  angret: 'Angret',
};

const STATUS_ETTER_HENDELSE = {
  inn: STATUS.INNE,
  ut: STATUS.UT,
  'meldt-fravaer': STATUS.MELDT_FRAVAER,
  'ikke-mott': STATUS.IKKE_MOTT,
};

/** Lager en ny hendelse. */
export function lagHendelse({ id, elevId, type, naa = new Date(), initialer = null, erstatter = null }) {
  return {
    id,
    elevId,
    dato: lokalDato(naa),
    tid: naa.toISOString(),
    type,
    initialer: initialer ? String(initialer).trim().toUpperCase().slice(0, 4) || null : null,
    erstatter,
  };
}

/**
 * Gjeldende hendelser: uten angrede, uten de som er rettet, sortert på tid.
 * Returnerer også et kart over hva som skjedde med hver hendelse, til historikken på elevkortet.
 */
export function gjeldendeHendelser(hendelser) {
  const fjernet = new Map(); // id → 'angret' | 'rettet'
  const rettetTil = new Map(); // gammel id → ny hendelse
  for (const h of hendelser) {
    if (!h.erstatter) continue;
    if (h.type === 'angret') fjernet.set(h.erstatter, 'angret');
    else { fjernet.set(h.erstatter, 'rettet'); rettetTil.set(h.erstatter, h); }
  }
  const gjeldende = hendelser
    .filter((h) => h.type !== 'angret' && !fjernet.has(h.id))
    .sort((a, b) => a.tid.localeCompare(b.tid) || a.id.localeCompare(b.id));
  return { gjeldende, fjernet, rettetTil };
}

/** Er eleven forventet på SFO denne datoen? Ukeplan + enkeltunntak (K-04, K-19). */
export function erForventet(elev, dato, unntak = []) {
  if (elev.aktiv === false) return false;
  const u = unntak.find((x) => x.elevId === elev.id && x.dato === dato);
  if (u?.type === 'ikke-sfo') return false;
  if (u?.type === 'ekstra-dag') return true;
  const [y, m, d] = dato.split('-').map(Number);
  return (elev.ukedager ?? []).includes(ukedagNr(new Date(y, m - 1, d)));
}

/**
 * Status for én elev én dag.
 * hendelser: elevens hendelser denne datoen (alle typer, også angret og rettelser).
 */
export function elevStatus(elev, dato, hendelser, unntak = []) {
  const { gjeldende } = gjeldendeHendelser(hendelser.filter((h) => h.elevId === elev.id && h.dato === dato));
  const forventet = erForventet(elev, dato, unntak);
  const siste = gjeldende[gjeldende.length - 1] ?? null;
  let status;
  if (siste) status = STATUS_ETTER_HENDELSE[siste.type];
  else status = forventet ? STATUS.FORVENTET : STATUS.IKKE_SFO;

  // «Inne siden»: tidspunktet for den siste inn-hendelsen i den sammenhengende perioden eleven er inne.
  const sisteInn = [...gjeldende].reverse().find((h) => h.type === 'inn') ?? null;
  return {
    elev,
    status,
    forventet,
    siste,
    innSiden: status === STATUS.INNE ? sisteInn?.tid ?? null : null,
    hendelser: gjeldende,
  };
}

/** 'HH:MM' + lokal dato → Date */
export function tidspunkt(dato, hhmm) {
  const [y, m, d] = dato.split('-').map(Number);
  const [t, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, t, mi, 0, 0);
}

/**
 * Oversikt over hele dagen for alle aktive elever (og deaktiverte som har hendelser i dag).
 * Returnerer { rader, etterStatus: { status: [rader] }, tall, varselAktivt, uregistrert }.
 */
export function dagsoversikt({ elever, hendelser, unntak = [], dato, naa = new Date(), varseltid = '15:00' }) {
  const iDag = hendelser.filter((h) => h.dato === dato);
  const medHendelser = new Set(iDag.map((h) => h.elevId));
  const rader = elever
    .filter((e) => e.aktiv !== false || medHendelser.has(e.id))
    .map((e) => elevStatus(e, dato, iDag, unntak));

  const etterStatus = Object.fromEntries(Object.values(STATUS).map((s) => [s, []]));
  for (const r of rader) etterStatus[r.status].push(r);

  const varselAktivt = naa >= tidspunkt(dato, varseltid);
  return {
    rader,
    etterStatus,
    tall: {
      inne: etterStatus[STATUS.INNE].length,
      forventet: rader.filter((r) => r.forventet || r.status !== STATUS.IKKE_SFO).length,
      sjekketUt: etterStatus[STATUS.UT].length,
      meldtFravaer: etterStatus[STATUS.MELDT_FRAVAER].length,
      ikkeMott: etterStatus[STATUS.IKKE_MOTT].length,
      ikkeRegistrert: etterStatus[STATUS.FORVENTET].length,
    },
    varselAktivt,
    // K-16: forventede som ikke er registrert etter varseltidspunktet
    uregistrert: varselAktivt ? etterStatus[STATUS.FORVENTET] : [],
  };
}

/** Hvilke handlinger passer for en status (brukes av knappene i listene og på elevkortet). */
export function handlingerFor(status) {
  switch (status) {
    case STATUS.FORVENTET: return ['inn', 'fravaer'];
    case STATUS.INNE: return ['ut'];
    case STATUS.UT: return ['inn'];
    case STATUS.MELDT_FRAVAER:
    case STATUS.IKKE_MOTT: return ['inn'];
    case STATUS.IKKE_SFO: return ['ekstra-inn'];
    default: return [];
  }
}

// ---------- Telling (K-30–K-32) ----------

/**
 * Resultat av en telling: hvem som er inne, hvem som er talt og hvem som mangler.
 * inne: elevene som er inne nå. talt: Set eller liste med elev-ID-er som er huket av.
 */
export function tellingResultat(inne, talt) {
  const taltSett = new Set(talt);
  const mangler = inne.filter((r) => !taltSett.has(r.elev.id));
  return {
    antallForventet: inne.length,
    antallTalt: inne.length - mangler.length,
    mangler,
  };
}
