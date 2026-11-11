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

/**
 * Én elevrad: navn, trinn og gruppe (eller egen `meta`), brikker og eventuell knapp til høyre.
 * Med `lenke` og uten knapp blir hele raden en lenke. Med både lenke og knapp er navnet lenken.
 */
export function elevRad(elev, { avtale, ekstraMeta, meta, handling, lenke, klasse = '' } = {}) {
  const tekst = [
    h('p', { class: 'navn' }, `${elev.fornavn} ${elev.etternavn}`),
    h('div', { class: 'rad-meta' },
      h('span', { class: 'meta' }, meta ?? [`${elev.trinn}. trinn`, kortGruppe(elev.skolegruppe), ekstraMeta].filter(Boolean).join(' · ')),
      avtaleBrikker(avtale)),
  ];
  const sok = `${elev.fornavn} ${elev.etternavn} ${elev.trinn}. trinn ${elev.skolegruppe}`.toLocaleLowerCase('nb');
  if (lenke && !handling) {
    return h('li', { 'data-sok': sok },
      h('a', { class: `liste-rad lenke-rad ${klasse}`, href: lenke }, h('div', { class: 'rad-tekst' }, tekst), pilHoyre()));
  }
  const tekstdel = lenke
    ? h('a', { class: 'rad-tekst rad-lenke', href: lenke }, tekst)
    : h('div', { class: 'rad-tekst' }, tekst);
  return h('li', { class: `liste-rad ${klasse}`, 'data-sok': sok }, tekstdel, handling ?? null);
}

const SVG = 'http://www.w3.org/2000/svg';
/** Ikon-pil (›) til høyre i lenkerader. */
export function pilHoyre() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'pil');
  svg.setAttribute('aria-hidden', 'true');
  const sti = document.createElementNS(SVG, 'path');
  sti.setAttribute('d', 'm9 18 6-6-6-6');
  svg.append(sti);
  return svg;
}

/** Ikon-pil (‹) for tilbake-lenker. */
export function pilVenstre() {
  const svg = pilHoyre();
  svg.firstChild.setAttribute('d', 'm15 18-6-6 6-6');
  return svg;
}

/** Sorterer elever på trinn, etternavn og fornavn. */
export function sorterElever(elever) {
  // Alfabetisk på fornavn, så etternavn og trinn (ønske fra piloten).
  return [...elever].sort((a, b) => a.fornavn.localeCompare(b.fornavn, 'nb')
    || a.etternavn.localeCompare(b.etternavn, 'nb')
    || a.trinn - b.trinn);
}

/** Søkefelt med rødt kryss til høyre som tømmer søket. Krysset vises bare når det står noe i feltet. */
export function sokMedKryss(input) {
  const kryss = h('button', {
    type: 'button', class: 'sok-kryss', 'aria-label': 'Tøm søket', hidden: !input.value,
    onclick: () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    },
  }, '×');
  input.addEventListener('input', () => { kryss.hidden = !input.value; });
  return h('div', { class: 'sok-boks' }, input, kryss);
}
