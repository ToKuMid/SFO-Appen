// Grupperapport (K-50): tellinger, avvik og fravær per dag for en valgt periode.
// Ren logikk uten nettleser-API-er, slik at den kan testes med `npm test`.
// Mottakere er SFO-leder og rektor: rapporten dokumenterer tilsynet og viser hva som må følges opp.

import { lokalDato, ukedagNr } from '../dato.js';
import { STATUS, elevStatus, erForventet, gjeldendeHendelser } from './status.js';

const fraDato = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const plussDager = (s, n) => { const d = fraDato(s); d.setDate(d.getDate() + n); return lokalDato(d); };

/** Datoer fra og med `fra` til og med `til` ('ÅÅÅÅ-MM-DD'). */
export function datoerMellom(fra, til) {
  const ut = [];
  for (let d = fra; d <= til; d = plussDager(d, 1)) ut.push(d);
  return ut;
}

/** Hurtigvalg for periode. type: 'dag' | 'uke' | 'maaned'. Perioden slutter aldri etter i dag. */
export function periode(type, idag = lokalDato()) {
  if (type === 'dag') return { fra: idag, til: idag };
  if (type === 'uke') return { fra: plussDager(idag, 1 - ukedagNr(fraDato(idag))), til: idag };
  if (type === 'maaned') return { fra: `${idag.slice(0, 8)}01`, til: idag };
  throw new Error(`Ukjent periode «${type}»`);
}

/** Kontroll av egen periode. Returnerer feiltekst eller null. */
export function kontrollerPeriode(fra, til, idag = lokalDato()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fra ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(til ?? '')) return 'Velg både fra- og til-dato.';
  if (fra > til) return 'Fra-dato må være før til-dato.';
  if (fra > idag) return 'Perioden kan ikke starte i framtiden.';
  if (datoerMellom(fra, til).length > 366) return 'Perioden kan være høyst ett år.';
  return null;
}

// ---------- Forkortede navn ----------
// Rapporten arkiveres, så navnene forkortes for å gjøre barna mindre gjenkjennelige:
// tre første bokstaver i fornavnet + første bokstav i etternavnet + trinn, for eksempel «SanØ 3.trinn».
// Merk: dette er pseudonymisering, ikke anonymisering. De ansatte kan fortsatt kjenne igjen barna,
// så rapporten inneholder fortsatt personopplysninger.

const bokstaver = (s) => Array.from(String(s ?? '').normalize('NFC').replace(/[^\p{L}]/gu, ''));
const storForbokstav = (b) => (b.length ? b[0].toLocaleUpperCase('nb') + b.slice(1).join('').toLocaleLowerCase('nb') : '');

/** Forkortet navn med `antall` bokstaver fra etternavnet. */
export function kortNavn(elev, antall = 1) {
  const fornavn = storForbokstav(bokstaver(elev.fornavn).slice(0, 3));
  const etternavn = storForbokstav(bokstaver(elev.etternavn).slice(0, antall));
  return `${fornavn}${etternavn} ${elev.trinn}.trinn`;
}

/**
 * Forkortede navn for alle elevene, uten like navn: får to elever samme forkortelse,
 * tas flere bokstaver fra etternavnet til de skiller seg («SanØv 3.trinn», «SanØl 3.trinn»).
 * Er de fortsatt like (samme navn og trinn), får de et nummer.
 */
export function kortNavnFor(elever) {
  const ut = new Map();
  const grupper = new Map();
  for (const e of elever) {
    const k = kortNavn(e);
    if (!grupper.has(k)) grupper.set(k, []);
    grupper.get(k).push(e);
  }
  for (const [k, gruppe] of grupper) {
    if (gruppe.length === 1) { ut.set(gruppe[0].id, k); continue; }
    const maks = Math.max(...gruppe.map((e) => bokstaver(e.etternavn).length));
    // Så få ekstra bokstaver som mulig: stopp når flere bokstaver ikke skiller dem bedre.
    const ulike = (n) => new Set(gruppe.map((e) => kortNavn(e, n))).size;
    const best = ulike(maks);
    let antall = 2;
    while (antall < maks && ulike(antall) < best) antall += 1;
    const navn = gruppe.map((e) => kortNavn(e, antall));
    const brukt = new Map();
    gruppe.forEach((e, i) => {
      const n = navn[i];
      const like = navn.filter((x) => x === n).length;
      brukt.set(n, (brukt.get(n) ?? 0) + 1);
      ut.set(e.id, like > 1 ? `${n} (${brukt.get(n)})` : n);
    });
  }
  return ut;
}

/**
 * Lager grupperapporten.
 * Inndata: alle elever, og hendelser, unntak, tellinger og tellingslinjer i perioden.
 * Dager med SFO er hverdager der noen var forventet, og alle dager med registreringer.
 */
export function grupperapport({ elever, hendelser, unntak = [], tellinger, tellingslinjer, fra, til, idag = lokalDato() }) {
  const sisteDag = til > idag ? idag : til;
  const elevFor = new Map(elever.map((e) => [e.id, e]));
  const kort = kortNavnFor(elever);
  const navn = (e) => kort.get(e.id);
  const linjerFor = new Map();
  for (const l of tellingslinjer) {
    if (!linjerFor.has(l.tellingId)) linjerFor.set(l.tellingId, []);
    linjerFor.get(l.tellingId).push(l);
  }

  const alleTellinger = tellinger
    .filter((t) => t.dato >= fra && t.dato <= sisteDag)
    .sort((a, b) => a.tid.localeCompare(b.tid))
    .map((t) => {
      const mangler = (linjerFor.get(t.id) ?? []).filter((l) => !l.talt).map((l) => elevFor.get(l.elevId)).filter(Boolean);
      return {
        id: t.id,
        dato: t.dato,
        tid: t.tid,
        antallTalt: t.antallTalt,
        antallForventet: t.antallForventet,
        avvik: t.antallForventet - t.antallTalt,
        mangler: mangler.map(navn).sort((a, b) => a.localeCompare(b, 'nb')),
        initialer: t.initialer ?? null,
        kommentar: t.kommentar ?? '',
      };
    });

  const dager = [];
  for (const dato of datoerMellom(fra, sisteDag)) {
    const iDag = hendelser.filter((h) => h.dato === dato);
    const unntakIDag = unntak.filter((u) => u.dato === dato);
    const medHendelser = new Set(iDag.map((h) => h.elevId));
    // Deaktiverte elever tas med de dagene de har registreringer.
    const aktuelle = elever.filter((e) => medHendelser.has(e.id) || erForventet(e, dato, unntakIDag));
    if (aktuelle.length === 0) continue;

    const status = aktuelle.map((e) => elevStatus(e, dato, iDag, unntakIDag));
    const mott = status.filter((s) => s.hendelser.some((h) => h.type === 'inn'));
    const etter = (st) => status.filter((s) => s.status === st).map((s) => s.elev);
    const tellingerIDag = alleTellinger.filter((t) => t.dato === dato);
    const { gjeldende } = gjeldendeHendelser(iDag);

    dager.push({
      dato,
      ingenRegistreringer: gjeldende.length === 0,
      forventet: status.filter((s) => s.forventet).length,
      mott: mott.length,
      meldtFravaer: etter(STATUS.MELDT_FRAVAER).map(navn).sort((a, b) => a.localeCompare(b, 'nb')),
      ikkeMott: etter(STATUS.IKKE_MOTT).map(navn).sort((a, b) => a.localeCompare(b, 'nb')),
      // Forventet, men aldri registrert (verken inn eller fravær). For i dag: «ikke registrert ennå».
      ikkeRegistrert: gjeldende.length === 0 ? [] : etter(STATUS.FORVENTET).map(navn).sort((a, b) => a.localeCompare(b, 'nb')),
      // Står som inne ved slutten av dagen (sjekket inn, aldri ut). For i dag: fortsatt inne.
      ikkeUtsjekket: dato === idag ? [] : etter(STATUS.INNE).map(navn).sort((a, b) => a.localeCompare(b, 'nb')),
      tellinger: tellingerIDag.length,
      tellingerMedAvvik: tellingerIDag.filter((t) => t.avvik > 0).length,
    });
  }

  const sum = (f) => dager.reduce((s, d) => s + f(d), 0);
  return {
    fra,
    til: sisteDag,
    dager,
    tellinger: alleTellinger,
    avvik: alleTellinger.filter((t) => t.avvik > 0),
    sammendrag: {
      sfoDager: dager.filter((d) => !d.ingenRegistreringer).length,
      tellinger: alleTellinger.length,
      tellingerMedAvvik: alleTellinger.filter((t) => t.avvik > 0).length,
      barnSomManglet: alleTellinger.reduce((s, t) => s + t.avvik, 0),
      meldtFravaer: sum((d) => d.meldtFravaer.length),
      ikkeMott: sum((d) => d.ikkeMott.length),
      ikkeRegistrert: sum((d) => d.ikkeRegistrert.length),
      ikkeUtsjekket: sum((d) => d.ikkeUtsjekket.length),
      dagerUtenTelling: dager.filter((d) => !d.ingenRegistreringer && d.tellinger === 0).length,
    },
  };
}

// ---------- Elevrapport (K-51) ----------

/**
 * Elevrapport for ett barn: inn- og utsjekk per dag, fravær og tellinger der barnet manglet.
 * Navnet forkortes som i grupperapporten. `elever` brukes bare til å gjøre forkortelsen unik.
 */
export function elevrapport({ elev, elever, hendelser, unntak = [], tellinger, tellingslinjer, fra, til, idag = lokalDato() }) {
  const sisteDag = til > idag ? idag : til;
  const egne = hendelser.filter((h) => h.elevId === elev.id);
  const egneUnntak = unntak.filter((u) => u.elevId === elev.id);
  const tellingFor = new Map(tellinger.map((t) => [t.id, t]));
  const manglet = tellingslinjer
    .filter((l) => l.elevId === elev.id && !l.talt && tellingFor.has(l.tellingId))
    .map((l) => tellingFor.get(l.tellingId))
    .filter((t) => t.dato >= fra && t.dato <= sisteDag)
    .sort((a, b) => a.tid.localeCompare(b.tid));

  const dager = [];
  for (const dato of datoerMellom(fra, sisteDag)) {
    const iDag = egne.filter((h) => h.dato === dato);
    const unntakIDag = egneUnntak.filter((u) => u.dato === dato);
    const forventet = erForventet({ ...elev, aktiv: true }, dato, unntakIDag);
    if (!forventet && iDag.length === 0) continue;

    const s = elevStatus({ ...elev, aktiv: true }, dato, iDag, unntakIDag);
    const tid = (h) => ({ tid: h.tid, initialer: h.initialer ?? null, rettet: !!h.erstatter });
    const fravaer = s.hendelser.filter((h) => h.type === 'meldt-fravaer' || h.type === 'ikke-mott').pop() ?? null;
    dager.push({
      dato,
      forventet,
      ekstraDag: unntakIDag.some((u) => u.type === 'ekstra-dag'),
      status: s.status,
      inn: s.hendelser.filter((h) => h.type === 'inn').map(tid),
      ut: s.hendelser.filter((h) => h.type === 'ut').map(tid),
      fravaer: fravaer && (s.status === STATUS.MELDT_FRAVAER || s.status === STATUS.IKKE_MOTT)
        ? { type: fravaer.type, initialer: fravaer.initialer ?? null } : null,
      aldriRegistrert: s.status === STATUS.FORVENTET && dato !== idag,
      ikkeUtsjekket: s.status === STATUS.INNE && dato !== idag,
      mangletVedTelling: manglet.filter((t) => t.dato === dato).map((t) => ({ tid: t.tid, initialer: t.initialer ?? null, kommentar: t.kommentar ?? '' })),
    });
  }

  return {
    navn: kortNavnFor(elever.some((e) => e.id === elev.id) ? elever : [...elever, elev]).get(elev.id),
    fra,
    til: sisteDag,
    dager,
    manglet: manglet.map((t) => ({ dato: t.dato, tid: t.tid, antallTalt: t.antallTalt, antallForventet: t.antallForventet, initialer: t.initialer ?? null, kommentar: t.kommentar ?? '' })),
    harRettelser: dager.some((d) => [...d.inn, ...d.ut].some((x) => x.rettet)),
    sammendrag: {
      forventetDager: dager.filter((d) => d.forventet).length,
      mottDager: dager.filter((d) => d.inn.length > 0).length,
      meldtFravaer: dager.filter((d) => d.fravaer?.type === 'meldt-fravaer').length,
      ikkeMott: dager.filter((d) => d.fravaer?.type === 'ikke-mott').length,
      aldriRegistrert: dager.filter((d) => d.aldriRegistrert).length,
      ikkeUtsjekket: dager.filter((d) => d.ikkeUtsjekket).length,
      mangletVedTelling: manglet.length,
      ekstraDager: dager.filter((d) => d.ekstraDag).length,
    },
  };
}

// ---------- Avviksrapport (K-54) ----------

/**
 * Avviksrapport: bare det som skal følges opp. Avvik ved telling, ikke møtt, aldri registrert,
 * ikke sjekket ut, dager uten telling og uten registreringer, og barn med flere avvik i perioden.
 * Meldt fravær er ikke et avvik og er ikke med. Rettelser og angre er heller ikke med (DPIA R9).
 */
export function avviksrapport({ elever, hendelser, unntak = [], tellinger, tellingslinjer, fra, til, idag = lokalDato() }) {
  const g = grupperapport({ elever, hendelser, unntak, tellinger, tellingslinjer, fra, til, idag });
  const kort = kortNavnFor(elever);
  const elevFor = new Map(elever.map((e) => [e.id, e]));
  const sorter = (a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn, 'nb');
  const ikkeMott = [];
  const aldriRegistrert = [];
  const ikkeUtsjekket = [];
  const dagerUtenRegistreringer = [];
  const perElev = new Map();
  const tell = (id, felt) => {
    if (!perElev.has(id)) perElev.set(id, { navn: kort.get(id), ikkeMott: 0, aldriRegistrert: 0, ikkeUtsjekket: 0, manglet: 0 });
    perElev.get(id)[felt] += 1;
  };

  for (const dag of g.dager) {
    const { dato } = dag;
    if (dag.ingenRegistreringer) {
      if (dato !== idag) dagerUtenRegistreringer.push({ dato, forventet: dag.forventet });
      continue;
    }
    const iDag = hendelser.filter((h) => h.dato === dato);
    const unntakIDag = unntak.filter((u) => u.dato === dato);
    const medHendelser = new Set(iDag.map((h) => h.elevId));
    for (const e of elever.filter((x) => medHendelser.has(x.id) || erForventet(x, dato, unntakIDag))) {
      const s = elevStatus(e, dato, iDag, unntakIDag);
      const navn = kort.get(e.id);
      if (s.status === STATUS.IKKE_MOTT) {
        ikkeMott.push({ dato, navn, tid: s.siste?.tid ?? null, initialer: s.siste?.initialer ?? null });
        tell(e.id, 'ikkeMott');
      } else if (s.status === STATUS.FORVENTET && dato !== idag) {
        aldriRegistrert.push({ dato, navn });
        tell(e.id, 'aldriRegistrert');
      } else if (s.status === STATUS.INNE && dato !== idag) {
        ikkeUtsjekket.push({ dato, navn, inn: s.innSiden ?? null });
        tell(e.id, 'ikkeUtsjekket');
      }
    }
  }
  for (const t of tellinger.filter((x) => x.dato >= g.fra && x.dato <= g.til)) {
    for (const l of tellingslinjer.filter((x) => x.tellingId === t.id && !x.talt && elevFor.has(x.elevId))) tell(l.elevId, 'manglet');
  }

  const flereAvvik = [...perElev.values()]
    .map((x) => ({ ...x, totalt: x.ikkeMott + x.aldriRegistrert + x.ikkeUtsjekket + x.manglet }))
    .filter((x) => x.totalt >= 2)
    .sort((a, b) => b.totalt - a.totalt || a.navn.localeCompare(b.navn, 'nb'));
  const dagerUtenTelling = g.dager.filter((d) => !d.ingenRegistreringer && d.tellinger === 0 && d.dato !== idag).map((d) => d.dato);

  const sammendrag = {
    tellingerMedAvvik: g.sammendrag.tellingerMedAvvik,
    barnSomManglet: g.sammendrag.barnSomManglet,
    ikkeMott: ikkeMott.length,
    aldriRegistrert: aldriRegistrert.length,
    ikkeUtsjekket: ikkeUtsjekket.length,
    dagerUtenTelling: dagerUtenTelling.length,
    dagerUtenRegistreringer: dagerUtenRegistreringer.length,
  };
  return {
    fra: g.fra,
    til: g.til,
    sfoDager: g.sammendrag.sfoDager,
    tellingAvvik: g.avvik,
    ikkeMott: ikkeMott.sort(sorter),
    aldriRegistrert: aldriRegistrert.sort(sorter),
    ikkeUtsjekket: ikkeUtsjekket.sort(sorter),
    dagerUtenTelling,
    dagerUtenRegistreringer,
    flereAvvik,
    sammendrag,
    ingenAvvik: Object.values(sammendrag).every((v) => v === 0),
  };
}
