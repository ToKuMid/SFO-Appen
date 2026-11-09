// Skjermene I dag, Andre og Telling. (Elever ligger i elever.js.)
// I fase 1 viser de data fra databasen, men inn- og utsjekk, telling og redigering kommer i fase 2.
import { h } from '../dom.js';
import { hentAlle } from '../db.js';
import { ukedagNr } from '../dato.js';
import { elevRad, skjermTopp, sorterElever } from './felles.js';

async function hentAktiveElever() {
  const [elever, avtaler] = await Promise.all([hentAlle('elever'), hentAlle('avtaler')]);
  const avtaleFor = new Map(avtaler.map((a) => [a.elevId, a]));
  return { elever: sorterElever(elever.filter((e) => e.aktiv !== false)), avtaleFor };
}

function kommerKort(tekst) {
  return h('section', { class: 'kort' }, h('p', { class: 'dempet' }, tekst));
}

export async function visIdag() {
  const { elever, avtaleFor } = await hentAktiveElever();
  const dag = ukedagNr();
  const forventet = elever.filter((e) => e.ukedager?.includes(dag));
  const helg = dag > 5;

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'I dag', visKlokke: true }),
    h('div', { class: 'hovedtall' },
      h('div', {},
        h('p', { class: 'hovedtall-etikett' }, 'Forventet i dag'),
        h('p', { class: 'hovedtall-tall', id: 'antall-forventet' }, helg ? '–' : forventet.length)),
      h('div', { class: 'hovedtall-side' },
        h('p', {}, helg ? 'Ingen SFO i helgen' : `av ${elever.length} elever`),
        h('p', {}, 'Inn og ut kommer i fase 2b'))),
    elever.length === 0
      ? kommerKort('Ingen elever ennå. For å teste kan du laste inn fiktive testdata under Mer → Teknisk test og utviklerverktøy.')
      : null,
    forventet.length > 0 && !helg ? [
      h('p', { class: 'seksjonstittel' }, `Forventet (${forventet.length})`),
      h('ul', { class: 'liste' }, forventet.map((e) => elevRad(e, { avtale: avtaleFor.get(e.id), lenke: `#elever/${e.id}` }))),
    ] : null);
}

export function visAndre() {
  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Andre', undertittel: 'Barn som ikke er inne akkurat nå' }),
    kommerKort('Forventet og ikke registrert, sjekket ut, fravær og ikke SFO i dag kommer i fase 2b.'));
}

export function visTelling() {
  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Telling' }),
    kommerKort('Telling med avhuking og avvik kommer i fase 2c.'));
}
