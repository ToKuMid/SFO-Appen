// Grupperapport (K-50, K-52): velg periode, se rapporten og skriv ut eller lagre som PDF.
// Rapporten lages som en utskriftsvennlig side. Appen lagrer ingen PDF selv; det gjør telefonens
// utskriftsfunksjon, og brukeren velger SFO-mappen i skolens OneDrive (DPIA tiltak T7).
import { h } from '../dom.js';
import { hentAlle, hentIntervall } from '../db.js';
import { kortDatoMedDag, klokkeFra, langDato, lokalDato, tidspunktTekst } from '../dato.js';
import { grupperapport, kontrollerPeriode, periode } from '../model/rapport.js';
import { APP_VERSJON } from '../versjon.js';
import { skrivUt } from '../filer.js';
import { pilVenstre } from './felles.js';

const VALG = [
  { type: 'dag', tekst: 'I dag' },
  { type: 'uke', tekst: 'Denne uka' },
  { type: 'maaned', tekst: 'Denne måneden' },
  { type: 'egen', tekst: 'Egen' },
];

// Valgt periode huskes mens appen er åpen.
let valgt = { type: 'uke', fra: null, til: null };

/** Periode valgt i rapportene (felles for grupperapport og elevrapport). */
export function valgtPeriode(idag = lokalDato()) {
  if (valgt.type === 'egen') {
    const fra = valgt.fra ?? periode('maaned', idag).fra;
    const til = valgt.til ?? idag;
    return { fra, til, feil: kontrollerPeriode(fra, til, idag) };
  }
  return { ...periode(valgt.type, idag), feil: null };
}

/** Kort med periodevalg og utskriftsknapp. */
export function periodeKontroller({ fra, til, feil }, idag, oppfrisk) {
  return h('section', { class: 'kort ikke-utskrift rapport-kontroller' },
    h('h2', {}, 'Periode'),
    h('div', { class: 'segment', role: 'group', 'aria-label': 'Periode' },
      VALG.map((v) => h('button', {
        type: 'button',
        class: `segment-knapp ${valgt.type === v.type ? 'valgt' : ''}`,
        'aria-pressed': valgt.type === v.type ? 'true' : 'false',
        'data-periode': v.type,
        onclick: () => { valgt = { ...valgt, type: v.type }; oppfrisk(); },
      }, v.tekst))),
    valgt.type === 'egen' ? egenPeriode(fra, til, idag, oppfrisk) : null,
    feil ? h('p', { class: 'feilboks', role: 'alert' }, feil) : null,
    h('button', { type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'skriv-ut', disabled: !!feil, onclick: () => skrivUt() }, 'Skriv ut eller lagre som PDF'),
    h('p', { class: 'dempet liten' }, 'Velg «Lagre som PDF» i utskriftsvinduet, og lagre fila i SFO-mappen i skolens OneDrive. Rapporten inneholder personopplysninger om barn.'));
}

export async function visGrupperapport(oppfrisk) {
  const idag = lokalDato();
  const p = valgtPeriode(idag);
  return h('div', { class: 'skjerm' },
    h('a', { class: 'tilbake ikke-utskrift', href: '#mer' }, pilVenstre(), 'Mer'),
    h('div', { class: 'ikke-utskrift kort-topp' },
      h('h1', { class: 'sidetittel' }, 'Grupperapport'),
      h('p', { class: 'undertittel' }, 'Tellinger, avvik og fravær for SFO-leder og rektor')),
    periodeKontroller(p, idag, oppfrisk),
    p.feil ? null : await lagRapport(p.fra, p.til, idag));
}

function egenPeriode(fra, til, idag, oppfrisk) {
  const fraFelt = h('input', { id: 'rapport-fra', type: 'date', value: fra, max: idag });
  const tilFelt = h('input', { id: 'rapport-til', type: 'date', value: til, max: idag });
  const bruk = () => { valgt = { type: 'egen', fra: fraFelt.value, til: tilFelt.value }; oppfrisk(); };
  fraFelt.addEventListener('change', bruk);
  tilFelt.addEventListener('change', bruk);
  return h('div', { class: 'to-kolonner' },
    h('div', { class: 'felt' }, h('label', { for: 'rapport-fra', class: 'feltnavn' }, 'Fra'), fraFelt),
    h('div', { class: 'felt' }, h('label', { for: 'rapport-til', class: 'feltnavn' }, 'Til'), tilFelt));
}

async function lagRapport(fra, til, idag) {
  const [elever, hendelser, unntak, tellinger, tellingslinjer] = await Promise.all([
    hentAlle('elever'),
    hentIntervall('hendelser', 'dato', fra, til),
    hentIntervall('unntak', 'dato', fra, til),
    hentIntervall('tellinger', 'dato', fra, til),
    hentAlle('tellingslinjer'),
  ]);
  const r = grupperapport({ elever, hendelser, unntak, tellinger, tellingslinjer, fra, til, idag });
  const s = r.sammendrag;
  const utskrevet = tidspunktTekst(new Date().toISOString());
  const periodeTekst = r.fra === r.til ? langDato(r.fra) : `${langDato(r.fra)} – ${langDato(r.til)}`;

  const tall = (etikett, verdi, { varsel = false } = {}) => h('div', { class: `rapport-tall ${varsel && verdi > 0 ? 'varsel' : ''}` },
    h('dt', {}, etikett), h('dd', {}, verdi));

  const avTekst = (t) => `${t.antallTalt}\u00a0av\u00a0${t.antallForventet}`;
  const tabell = (kolonner, rader, klasse = '') => h('table', { class: `rapport-tabell ${klasse}` },
    h('thead', {}, h('tr', {}, kolonner.map((k) => h('th', { scope: 'col' }, k)))),
    h('tbody', {}, rader.map((rad) => h('tr', {}, rad.map((c) => h('td', {}, c))))));

  const merknader = (d) => [
    d.ingenRegistreringer ? 'Ingen registreringer' : null,
    d.ikkeRegistrert.length ? `Aldri registrert: ${d.ikkeRegistrert.join(', ')}` : null,
    d.ikkeUtsjekket.length ? `Ikke sjekket ut: ${d.ikkeUtsjekket.join(', ')}` : null,
    !d.ingenRegistreringer && d.tellinger === 0 ? 'Ingen telling' : null,
  ].filter(Boolean).join('. ');

  const fravaersdager = r.dager.filter((d) => d.meldtFravaer.length || d.ikkeMott.length);

  return h('article', { class: 'rapport', id: 'rapport' },
    h('header', { class: 'rapport-topp' },
      h('img', { class: 'rapport-logo', src: 'icons/skolelogo.png', alt: 'Bærum Montessoriskole' }),
      h('p', { class: 'rapport-type' }, 'Grupperapport · SFO'),
      h('h2', { class: 'rapport-tittel' }, periodeTekst),
      h('p', { class: 'rapport-utskrift' }, `Skrevet ut ${utskrevet}`)),

    h('section', { class: 'rapport-del' },
      h('h3', {}, 'Sammendrag'),
      r.dager.length === 0
        ? h('p', {}, 'Ingen SFO-dager i perioden.')
        : h('dl', { class: 'rapport-sammendrag', id: 'rapport-sammendrag' },
          tall('SFO-dager', s.sfoDager),
          tall('Tellinger', s.tellinger),
          tall('Tellinger med avvik', s.tellingerMedAvvik, { varsel: true }),
          tall('Barn som manglet ved telling', s.barnSomManglet, { varsel: true }),
          tall('Meldt fravær', s.meldtFravaer),
          tall('Ikke møtt', s.ikkeMott, { varsel: true }),
          tall('Aldri registrert', s.ikkeRegistrert, { varsel: true }),
          tall('Ikke sjekket ut', s.ikkeUtsjekket, { varsel: true }),
          tall('Dager uten telling', s.dagerUtenTelling, { varsel: true }))),

    h('section', { class: 'rapport-del', id: 'rapport-avvik' },
      h('h3', {}, `Avvik ved telling (${r.avvik.length})`),
      r.avvik.length
        ? tabell(['Dato', 'Kl.', 'Talt', 'Manglet', 'Init.', 'Kommentar'],
          r.avvik.map((t) => [kortDatoMedDag(t.dato), klokkeFra(t.tid), avTekst(t), t.mangler.join(', '), t.initialer ?? '', t.kommentar]))
        : h('p', {}, 'Ingen avvik ved telling i perioden.')),

    r.dager.length ? h('section', { class: 'rapport-del', id: 'rapport-dager' },
      h('h3', {}, 'Per dag'),
      tabell(['Dato', 'Forv.', 'Møtt', 'Fravær', 'Tell.', 'Merknad'],
        r.dager.map((d) => [
          kortDatoMedDag(d.dato),
          d.forventet,
          d.ingenRegistreringer ? '–' : d.mott,
          d.ingenRegistreringer ? '–' : d.meldtFravaer.length + d.ikkeMott.length,
          d.ingenRegistreringer ? '–' : d.tellingerMedAvvik ? `${d.tellinger} (${d.tellingerMedAvvik} avvik)` : d.tellinger,
          merknader(d),
        ]), 'tabell-dager')) : null,

    fravaersdager.length ? h('section', { class: 'rapport-del', id: 'rapport-fravaer' },
      h('h3', {}, 'Fravær per dag'),
      tabell(['Dato', 'Meldt fravær', 'Ikke møtt'],
        fravaersdager.map((d) => [kortDatoMedDag(d.dato), d.meldtFravaer.join(', ') || '–', d.ikkeMott.join(', ') || '–']))) : null,

    r.tellinger.length ? h('section', { class: 'rapport-del', id: 'rapport-tellinger' },
      h('h3', {}, `Alle tellinger (${r.tellinger.length})`),
      tabell(['Dato', 'Kl.', 'Talt', 'Avvik', 'Init.'],
        r.tellinger.map((t) => [kortDatoMedDag(t.dato), klokkeFra(t.tid), avTekst(t), t.avvik || '–', t.initialer ?? '']))) : null,

    h('footer', { class: 'rapport-bunn' },
      `Skrevet ut ${utskrevet} · SFO-appen ${APP_VERSJON}`));
}
