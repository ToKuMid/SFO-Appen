// Felles byggeklosser for skjermene: topp med dato og overskrift, elevrader og brikker.
import { h } from '../dom.js';
import { datoTekst, klokkeTekst, klokkeslett } from '../dato.js';

/**
 * Topp på en skjerm: datolinje og stor overskrift (som i mockupen).
 * visKlokke: viser klokkeslett til høyre i datolinja (oppdateres av app.js).
 */
export function skjermTopp({ tittel, undertittel, visDato = true, visKlokke = false }) {
  return [
    visDato ? h('div', { class: 'dato-linje' },
      h('p', {}, datoTekst()),
      visKlokke ? h('p', { id: 'klokke' }, klokkeTekst()) : null) : null,
    h('h1', { class: 'sidetittel' }, tittel),
    undertittel ? h('p', { class: 'undertittel' }, undertittel) : null,
  ];
}

/** Kortnavn for skolegruppe: «Gruppe 1 blå» → «Gr. 1 blå» */
export function kortGruppe(gruppe) {
  return String(gruppe ?? '').replace(/^Gruppe /, 'Gr. ');
}

/** Brikker for faste avtaler (K-41): går hjem alene, fast hentetid, merknad. */
export function avtaleBrikker(avtale) {
  if (!avtale) return [];
  return [
    avtale.gaarHjemAleneFra ? h('span', { class: 'chip chip-gronn' }, `Går alene ${klokkeslett(avtale.gaarHjemAleneFra)}`) : null,
    avtale.fastHentetid ? h('span', { class: 'chip' }, `Hentes ${klokkeslett(avtale.fastHentetid)}`) : null,
    avtale.fritekst ? h('span', { class: 'chip' }, 'Merknad') : null,
  ].filter(Boolean);
}

/** Én elevrad: navn, trinn og gruppe, brikker og eventuell knapp til høyre. */
export function elevRad(elev, { avtale, ekstraMeta, handling } = {}) {
  return h('li', { class: 'liste-rad' },
    h('div', { class: 'rad-tekst' },
      h('p', { class: 'navn' }, `${elev.fornavn} ${elev.etternavn}`),
      h('div', { class: 'rad-meta' },
        h('span', { class: 'meta' }, [`${elev.trinn}. trinn`, kortGruppe(elev.skolegruppe), ekstraMeta].filter(Boolean).join(' · ')),
        avtaleBrikker(avtale))),
    handling ?? null);
}

/** Sorterer elever på trinn, etternavn og fornavn. */
export function sorterElever(elever) {
  return [...elever].sort((a, b) => a.trinn - b.trinn
    || a.etternavn.localeCompare(b.etternavn, 'nb')
    || a.fornavn.localeCompare(b.fornavn, 'nb'));
}
