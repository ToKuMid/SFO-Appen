// Felles for alle rapportene (K-50–K-54): periodevalg, datahenting, tabeller, topp og bunntekst.
// Endres utseendet her, endres det likt i grupperapport, elevrapport og avviksrapport.
import { h } from '../dom.js';
import { hentAlle, hentForVerdier, hentIntervall } from '../db.js';
import { langDato, lokalDato, tidspunktTekst } from '../dato.js';
import { kontrollerPeriode, periode } from '../model/rapport.js';
import { APP_VERSJON } from '../versjon.js';
import { skrivUt } from '../filer.js';

const VALG = [
  { type: 'dag', tekst: 'I dag' },
  { type: 'uke', tekst: 'Denne uka' },
  { type: 'maaned', tekst: 'Denne måneden' },
  { type: 'egen', tekst: 'Egen' },
];

// Valgt periode huskes mens appen er åpen.
let valgt = { type: 'uke', fra: null, til: null };

/** Periode valgt i rapportene. Den huskes mellom rapportene mens appen er åpen. */
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

/**
 * Data for en periode. Tellingslinjer hentes bare for tellingene i perioden, ikke hele historikken.
 */
export async function hentRapportdata(fra, til) {
  const [elever, hendelser, unntak, tellinger] = await Promise.all([
    hentAlle('elever'),
    hentIntervall('hendelser', 'dato', fra, til),
    hentIntervall('unntak', 'dato', fra, til),
    hentIntervall('tellinger', 'dato', fra, til),
  ]);
  const tellingslinjer = await hentForVerdier('tellingslinjer', 'tellingId', tellinger.map((t) => t.id));
  return { elever, hendelser, unntak, tellinger, tellingslinjer };
}

export const utskrevetNaa = () => tidspunktTekst(new Date().toISOString());
export const periodeTekst = (r) => (r.fra === r.til ? langDato(r.fra) : `${langDato(r.fra)} – ${langDato(r.til)}`);
export const avTekst = (t) => `${t.antallTalt}\u00a0av\u00a0${t.antallForventet}`;

/** Ett tall i sammendraget. varsel: uthev når tallet er større enn null. */
export const tall = (etikett, verdi, { varsel = false } = {}) => h('div', { class: `rapport-tall ${varsel && verdi > 0 ? 'varsel' : ''}` },
  h('dt', {}, etikett), h('dd', {}, verdi));

export const tabell = (kolonner, rader, klasse = '') => h('table', { class: `rapport-tabell ${klasse}` },
  h('thead', {}, h('tr', {}, kolonner.map((k) => h('th', { scope: 'col' }, k)))),
  h('tbody', {}, rader.map((rad) => h('tr', {}, rad.map((c) => h('td', {}, c))))));

/** Toppen av rapporten: skolelogo, rapporttype, tittel, eventuell undertittel og utskriftstid. */
export const rapportTopp = ({ type, tittel, tittelId, undertittel, utskrevet }) => h('header', { class: 'rapport-topp' },
  h('img', { class: 'rapport-logo', src: 'icons/skolelogo.png', alt: 'Bærum Montessoriskole' }),
  h('p', { class: 'rapport-type' }, `${type} · SFO`),
  h('h2', { class: 'rapport-tittel', id: tittelId }, tittel),
  undertittel ? h('p', { class: 'rapport-periode' }, undertittel) : null,
  h('p', { class: 'rapport-utskrift' }, `Skrevet ut ${utskrevet}`));

/** Bunnteksten: bare utskriftstid, app og versjon. Lagring og navneformat står i rutinebeskrivelsen. */
export const rapportBunn = (utskrevet) => h('footer', { class: 'rapport-bunn' }, `Skrevet ut ${utskrevet} · SFO-appen ${APP_VERSJON}`);
