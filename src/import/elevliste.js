// Import av elevlista fra Excel-malen (K-01, K-02, K-05). Ren logikk uten nettleser-API-er.
//
// 1. lesElevliste(ark)        – finner kolonnene, kontrollerer hver rad og samler feil med radnummer
// 2. planleggImport(...)      – matcher radene mot elevene i appen (navn + trinn, ev. trinnet under)
// 3. lagEndringer(plan, valg) – lager endringene som skal lagres, og et sammendrag til forhåndsvisning
//
// Historikk slettes aldri ved import: elever som ikke står i fila blir bare deaktivert.

import { UKEDAGER, avtaleFra, kontrollerElev, navnNokkel, tolkDag } from '../model/elev.js';

/** Kolonnene i malen, i rekkefølge. `navn` er overskriften i Excel, `alias` er andre skrivemåter som godtas. */
export const MAL_KOLONNER = [
  { nokkel: 'fornavn', navn: 'Fornavn', pakrevd: true, alias: [] },
  { nokkel: 'etternavn', navn: 'Etternavn', pakrevd: true, alias: [] },
  { nokkel: 'trinn', navn: 'Trinn', pakrevd: true, alias: ['klassetrinn'] },
  { nokkel: 'skolegruppe', navn: 'Skolegruppe', pakrevd: true, alias: ['gruppe'] },
  ...UKEDAGER.map((d) => ({ nokkel: `dag${d.nr}`, navn: d.kort, pakrevd: true, alias: [d.navn] })),
  { nokkel: 'gaarHjemAleneFra', navn: 'Går hjem alene fra', pakrevd: false, alias: ['går hjem alene', 'går alene fra', 'gar hjem alene fra'] },
  { nokkel: 'fastHentetid', navn: 'Fast hentetid', pakrevd: false, alias: ['hentetid'] },
  { nokkel: 'fritekst', navn: 'Merknad', pakrevd: false, alias: ['merknader', 'fast merknad'] },
];

const norm = (v) => String(v ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb');
const tom = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function elevNavn(e) {
  return `${e.fornavn} ${e.etternavn} (${e.trinn}. trinn)`;
}

/**
 * Leser elevene fra første ark i Excel-fila.
 * ark: { rader: [{ rad, celler }] } fra lesXlsx.
 * Returnerer { elever: [{ rad, ...elev }], feil: [tekst], advarsler: [tekst] }.
 */
export function lesElevliste(ark) {
  const feil = [];
  const advarsler = [];
  const rader = ark?.rader ?? [];

  const overskrift = rader.slice(0, 10).find((r) => r.celler.some((c) => norm(c) === 'fornavn'));
  if (!overskrift) {
    return { elever: [], feil: ['Finner ikke overskriftsraden. Første rad i malen skal starte med «Fornavn», «Etternavn», «Trinn», «Skolegruppe».'], advarsler };
  }

  const kolonneFor = {};
  overskrift.celler.forEach((c, i) => {
    const n = norm(c);
    if (!n) return;
    const k = MAL_KOLONNER.find((m) => norm(m.navn) === n || m.alias.includes(n));
    if (k && kolonneFor[k.nokkel] === undefined) kolonneFor[k.nokkel] = i;
    else if (!k) advarsler.push(`Kolonnen «${c}» er ukjent og blir ikke lest.`);
  });
  const mangler = MAL_KOLONNER.filter((k) => k.pakrevd && kolonneFor[k.nokkel] === undefined).map((k) => `«${k.navn}»`);
  if (mangler.length) {
    return { elever: [], feil: [`Fila mangler kolonnene ${mangler.join(', ')}. Bruk Excel-malen fra appen.`], advarsler };
  }

  const elever = [];
  const sett = new Map();
  for (const r of rader.filter((x) => x.rad > overskrift.rad)) {
    const celle = (nokkel) => (kolonneFor[nokkel] === undefined ? '' : r.celler[kolonneFor[nokkel]]);
    if (MAL_KOLONNER.every((k) => tom(celle(k.nokkel)))) continue;

    const radFeil = [];
    const ukedager = [];
    for (const d of UKEDAGER) {
      try {
        if (tolkDag(celle(`dag${d.nr}`))) ukedager.push(d.nr);
      } catch (e) {
        radFeil.push(`${d.kort}: ${e.message}`);
      }
    }

    const { verdi, feil: elevFeil } = kontrollerElev({
      fornavn: celle('fornavn'),
      etternavn: celle('etternavn'),
      trinn: celle('trinn'),
      skolegruppe: celle('skolegruppe'),
      ukedager,
      gaarHjemAleneFra: celle('gaarHjemAleneFra'),
      fastHentetid: celle('fastHentetid'),
      fritekst: celle('fritekst'),
    });
    radFeil.push(...elevFeil);

    const hvem = verdi.fornavn || verdi.etternavn ? ` (${[verdi.fornavn, verdi.etternavn].filter(Boolean).join(' ')})` : '';
    if (radFeil.length) {
      for (const f of radFeil) feil.push(`Rad ${r.rad}${hvem}: ${f}`);
      continue;
    }
    const nokkel = `${navnNokkel(verdi.fornavn, verdi.etternavn)}|${verdi.trinn}`;
    if (sett.has(nokkel)) {
      feil.push(`Rad ${r.rad}${hvem}: står også på rad ${sett.get(nokkel)}. Samme navn og trinn kan bare stå én gang.`);
      continue;
    }
    sett.set(nokkel, r.rad);
    elever.push({ rad: r.rad, ...verdi });
  }

  if (elever.length === 0 && feil.length === 0) feil.push('Fila inneholder ingen elever.');
  return { elever, feil, advarsler };
}

/**
 * Matcher importerte elever mot elevene i appen.
 * Først på samme navn og trinn, deretter samme navn og trinnet under (barnet har gått opp et trinn).
 * Hver elev i appen kan bare matches én gang. Flere mulige treff gir «tvetydig», og da må den ansatte velge.
 * Returnerer { rader: [{ imp, type: 'samme'|'gattOpp'|'ny'|'tvetydig', elevId?, kandidater? }], elever, avtaler }.
 */
export function planleggImport(importerte, elever, avtaler) {
  const etterNokkel = new Map();
  for (const e of elever) {
    const k = `${navnNokkel(e.fornavn, e.etternavn)}|${e.trinn}`;
    if (!etterNokkel.has(k)) etterNokkel.set(k, []);
    etterNokkel.get(k).push(e);
  }
  const brukt = new Set();
  const finn = (imp, trinn) => (etterNokkel.get(`${navnNokkel(imp.fornavn, imp.etternavn)}|${trinn}`) ?? []).filter((e) => !brukt.has(e.id));

  const rader = importerte.map((imp) => ({ imp, type: null }));

  // Runde 1: samme navn og trinn. Aktive elever foretrekkes framfor deaktiverte.
  for (const r of rader) {
    let k = finn(r.imp, r.imp.trinn);
    if (k.length > 1) {
      const aktive = k.filter((e) => e.aktiv !== false);
      if (aktive.length === 1) k = aktive;
    }
    if (k.length === 1) { r.type = 'samme'; r.elevId = k[0].id; brukt.add(k[0].id); } else if (k.length > 1) { r.type = 'tvetydig'; r.kandidater = k.map((e) => e.id); }
  }
  // Runde 2: samme navn, trinnet under.
  for (const r of rader.filter((x) => x.type === null)) {
    const k = r.imp.trinn > 1 ? finn(r.imp, r.imp.trinn - 1) : [];
    if (k.length === 1) { r.type = 'gattOpp'; r.elevId = k[0].id; brukt.add(k[0].id); } else if (k.length > 1) { r.type = 'tvetydig'; r.kandidater = k.map((e) => e.id); } else r.type = 'ny';
  }
  return { rader, elever, avtaler };
}

function avtaleLik(a, b) {
  return (a?.gaarHjemAleneFra ?? null) === (b?.gaarHjemAleneFra ?? null)
    && (a?.fastHentetid ?? null) === (b?.fastHentetid ?? null)
    && (a?.fritekst ?? '') === (b?.fritekst ?? '');
}

/**
 * Lager endringene som skal lagres.
 * valg: { [Excel-rad]: elevId | 'ny' } for tvetydige rader.
 * nyId: funksjon som lager ID for nye elever.
 * Returnerer { elever, avtalerLagre, avtalerSlett, sammendrag } eller kaster en feil hvis et valg mangler.
 */
export function lagEndringer(plan, valg = {}, { nyId }) {
  const elevFor = new Map(plan.elever.map((e) => [e.id, e]));
  const avtaleFor = new Map(plan.avtaler.map((a) => [a.elevId, a]));
  const matchet = new Set();
  const ut = { elever: [], avtalerLagre: [], avtalerSlett: [] };
  const s = { nye: [], oppdatert: [], gattOpp: [], reaktivert: [], deaktiveres: [], uendret: 0 };

  for (const r of plan.rader) {
    let { type, elevId } = r;
    if (type === 'tvetydig') {
      const v = valg[r.imp.rad];
      if (!v) throw new Error(`Velg hvem ${r.imp.fornavn} ${r.imp.etternavn} på rad ${r.imp.rad} er.`);
      if (v === 'ny') type = 'ny';
      else {
        if (!r.kandidater.includes(v)) throw new Error(`Ugyldig valg for rad ${r.imp.rad}.`);
        elevId = v;
        type = elevFor.get(v).trinn === r.imp.trinn ? 'samme' : 'gattOpp';
      }
    }
    if (elevId && matchet.has(elevId)) throw new Error(`${elevNavn(elevFor.get(elevId))} er valgt for flere rader.`);

    const imp = r.imp;
    const felter = { fornavn: imp.fornavn, etternavn: imp.etternavn, trinn: imp.trinn, skolegruppe: imp.skolegruppe, ukedager: imp.ukedager };

    if (type === 'ny') {
      const id = nyId();
      ut.elever.push({ id, ...felter, aktiv: true });
      const a = avtaleFra(id, imp);
      if (a) ut.avtalerLagre.push(a);
      s.nye.push(elevNavn(imp));
      continue;
    }

    matchet.add(elevId);
    const gammel = elevFor.get(elevId);
    const gammelAvtale = avtaleFor.get(elevId);
    const nyAvtale = avtaleFra(elevId, imp);
    const endringer = [];
    if (gammel.fornavn !== imp.fornavn || gammel.etternavn !== imp.etternavn) endringer.push('skrivemåte på navn');
    if (gammel.trinn !== imp.trinn) endringer.push(`trinn ${gammel.trinn} → ${imp.trinn}`);
    if (gammel.skolegruppe !== imp.skolegruppe) endringer.push(`${gammel.skolegruppe} → ${imp.skolegruppe}`);
    if ((gammel.ukedager ?? []).join() !== imp.ukedager.join()) endringer.push('SFO-dager');
    if ((gammelAvtale?.gaarHjemAleneFra ?? null) !== imp.gaarHjemAleneFra) endringer.push('går hjem alene');
    if ((gammelAvtale?.fastHentetid ?? null) !== imp.fastHentetid) endringer.push('fast hentetid');
    if ((gammelAvtale?.fritekst ?? '') !== imp.fritekst) endringer.push('merknad');
    const varDeaktivert = gammel.aktiv === false;

    if (endringer.length || varDeaktivert) ut.elever.push({ ...gammel, ...felter, aktiv: true });
    if (!avtaleLik(gammelAvtale, nyAvtale)) {
      if (nyAvtale) ut.avtalerLagre.push(nyAvtale);
      else if (gammelAvtale) ut.avtalerSlett.push(elevId);
    }

    const linje = { navn: elevNavn(imp), endringer };
    if (varDeaktivert) s.reaktivert.push(linje);
    else if (type === 'gattOpp') s.gattOpp.push(linje);
    else if (endringer.length) s.oppdatert.push(linje);
    else s.uendret += 1;
  }

  for (const e of plan.elever) {
    if (e.aktiv !== false && !matchet.has(e.id)) {
      ut.elever.push({ ...e, aktiv: false });
      s.deaktiveres.push(elevNavn(e));
    }
  }

  const aktiveFor = plan.elever.filter((e) => e.aktiv !== false).length;
  return {
    ...ut,
    sammendrag: {
      ...s,
      aktiveFor,
      aktiveEtter: plan.rader.length,
      ingenEndringer: ut.elever.length === 0 && ut.avtalerLagre.length === 0 && ut.avtalerSlett.length === 0,
    },
  };
}

/** Overskriftsraden i den tomme Excel-malen. */
export function malRader() {
  return [
    MAL_KOLONNER.map((k) => k.navn),
  ];
}

/** Forklaringsarket i malen. */
export function malForklaring() {
  return [
    ['Kolonne', 'Påkrevd', 'Slik fyller du ut', 'Eksempel'],
    ['Fornavn', 'Ja', 'Elevens fornavn', 'Emma'],
    ['Etternavn', 'Ja', 'Elevens etternavn', 'Hansen'],
    ['Trinn', 'Ja', '1, 2, 3 eller 4', '3'],
    ['Skolegruppe', 'Ja', 'Gruppe 1 blå, Gruppe 1 grønn (1.–3. trinn), Gruppe 2 oppe eller Gruppe 2 nede (4. trinn)', 'Gruppe 1 blå'],
    ['Man, Tir, Ons, Tor, Fre', 'Ja', 'X de dagene eleven har SFO, ellers tom', 'X'],
    ['Går hjem alene fra', 'Nei', 'Klokkeslett eleven kan gå hjem alene fra', '15:30'],
    ['Fast hentetid', 'Nei', 'Klokkeslett eleven hentes fast', '16:00'],
    ['Merknad', 'Nei', 'Faste avtaler om henting. IKKE helseopplysninger, barnevernssaker eller foreldretvister.', 'Hentes av besteforeldre på fredager'],
    [],
    ['Viktig', '', 'Lagre fila i skolens OneDrive, ikke på egen PC eller i e-post. Fila inneholder personopplysninger om barn.', ''],
    ['', '', 'Ved ny import kobles elever på navn og trinn. Elever som ikke står i fila, blir deaktivert, men historikken beholdes.', ''],
  ];
}
