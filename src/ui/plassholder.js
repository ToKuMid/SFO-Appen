// Midlertidige skjermer for fanene som bygges i fase 2.
import { h } from '../dom.js';
import { hentAlle } from '../db.js';

const KOMMER = {
  idag: { tittel: 'I dag', tekst: 'Hovedlisten med barn som er inne, teller og varsel kommer i fase 2b.' },
  andre: { tittel: 'Andre', tekst: 'Forventet, sjekket ut og fravær kommer i fase 2b.' },
  telling: { tittel: 'Telling', tekst: 'Telling med avhuking kommer i fase 2c.' },
};

export function visPlassholder(fane) {
  const k = KOMMER[fane];
  return h('section', { class: 'kort' },
    h('h2', {}, k.tittel),
    h('p', { class: 'dempet' }, k.tekst));
}

/** Enkel, skrivebeskyttet elevliste, slik at gjenoppretting kan kontrolleres. Redigering kommer i fase 2a. */
export async function visEleverListe() {
  const elever = (await hentAlle('elever'))
    .filter((e) => e.aktiv !== false)
    .sort((a, b) => a.trinn - b.trinn || a.etternavn.localeCompare(b.etternavn, 'nb') || a.fornavn.localeCompare(b.fornavn, 'nb'));

  if (elever.length === 0) {
    return h('section', { class: 'kort' },
      h('h2', {}, 'Elever'),
      h('p', { class: 'dempet' }, 'Ingen elever ennå. Import fra Excel og redigering kommer i fase 2a. For å teste kan du laste inn fiktive testdata under Mer.'));
  }

  return h('section', { class: 'kort' },
    h('h2', {}, `Elever (${elever.length})`),
    h('p', { class: 'dempet' }, 'Bare visning. Import og redigering kommer i fase 2a.'),
    h('ul', { class: 'liste' },
      elever.map((e) => h('li', { class: 'liste-rad' },
        h('span', { class: 'navn' }, `${e.fornavn} ${e.etternavn}`),
        h('span', { class: 'merke' }, `${e.trinn}. trinn · ${e.skolegruppe}`)))));
}
