// Dagsavslutning (K-20, K-21): lagrer at dagen er avsluttet, viser «Takk for i dag» og spør før
// registreringer etter at dagen er avsluttet.
import { h, visDialog } from '../dom.js';
import { hentEtterIndeks, hentInnstilling, lagreInnstilling } from '../db.js';
import { dagerMellom, klokkeFra, lokalDato } from '../dato.js';
import { hentDag, hentInitialer } from '../dag.js';
import { avslutningStatus, dagsoppsummering } from '../model/avslutning.js';
import { nullstillMerknader } from '../merknad.js';
import { kopiKnapp } from './sikkerhetskopi.js';

/** Status for dagens avslutning: null, eller { tid, endretEtter }. dag: fra hentDag(). */
export async function hentAvslutning(dag) {
  return avslutningStatus(await hentInnstilling('dagAvsluttet'), dag.dato, dag.hendelser);
}

/** Lagrer at dagen er avsluttet (tid og initialer), og sletter dagens merknader. */
export async function registrerAvslutning(naa = new Date()) {
  await lagreInnstilling('dagAvsluttet', { dato: lokalDato(naa), tid: naa.toISOString(), initialer: await hentInitialer() });
  await nullstillMerknader({ alle: true, naa });
}

/**
 * Før inn, ut, fravær og angre: er dagen avsluttet, spør appen først.
 * Returnerer true hvis registreringen skal gjøres.
 */
export async function bekreftEtterAvslutning() {
  const avsluttet = await hentInnstilling('dagAvsluttet');
  if (!avsluttet || avsluttet.dato !== lokalDato()) return true;
  const svar = await visDialog({
    tittel: 'Dagen er avsluttet',
    innhold: [
      h('p', {}, `Dagen ble avsluttet kl. ${klokkeFra(avsluttet.tid)}. Vil du registrere likevel?`),
      h('p', { class: 'dempet liten' }, 'Avslutt dagen på nytt etterpå, så det tas en ny sikkerhetskopi.'),
    ],
    knapper: [
      { tekst: 'Avbryt', verdi: 'avbryt' },
      { tekst: 'Registrer likevel', verdi: 'ja', type: 'primar', id: 'registrer-likevel' },
    ],
  });
  return svar === 'ja';
}

function hakeIkon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('class', 'ferdig-ikon');
  svg.setAttribute('aria-hidden', 'true');
  const sirkel = document.createElementNS(NS, 'circle');
  sirkel.setAttribute('cx', '24');
  sirkel.setAttribute('cy', '24');
  sirkel.setAttribute('r', '22');
  const hake = document.createElementNS(NS, 'path');
  hake.setAttribute('d', 'm14 25 7 7 13-15');
  svg.append(sirkel, hake);
  return svg;
}

const tall = (navn, verdi, id) => h('div', { class: 'ferdig-tall', id },
  h('dt', {}, navn), h('dd', {}, String(verdi)));

/** «Takk for i dag» (#ferdig): tall for dagen og status for sikkerhetskopien. Bare tall, ingen navn. */
export async function visFerdig(oppfrisk) {
  const d = await hentDag();
  const [avsluttet, tellinger, siste] = await Promise.all([
    hentAvslutning(d), hentEtterIndeks('tellinger', 'dato', d.dato), hentInnstilling('sisteSikkerhetskopi'),
  ]);
  if (!avsluttet) {
    return h('div', { class: 'skjerm' },
      h('section', { class: 'kort' },
        h('h1', { class: 'sidetittel' }, 'Dagen er ikke avsluttet'),
        h('p', {}, 'Avslutt dagen nederst på I dag.'),
        h('a', { class: 'knapp knapp-primar knapp-lenkeknapp', href: '#idag' }, 'Til I dag')));
  }
  const s = dagsoppsummering(d.tall, tellinger);
  const kopiIDag = siste && dagerMellom(siste) === 0;
  const ingenAvvik = !s.aldriRegistrert && !s.ikkeSjekketUt && !s.tellingerMedAvvik;

  return h('div', { class: 'skjerm ferdig', id: 'ferdig' },
    h('div', { class: 'ferdig-topp' },
      hakeIkon(),
      h('h1', { class: 'sidetittel' }, 'Dagen er avsluttet'),
      h('p', { class: 'undertittel' }, 'Takk for i dag!')),

    avsluttet.endretEtter ? h('p', { class: 'advarsel', id: 'ferdig-endret' },
      'Noe er registrert etter at dagen ble avsluttet. Avslutt dagen på nytt fra I dag.') : null,

    h('section', { class: 'kort', id: 'ferdig-oppsummering' },
      h('h2', {}, 'Oppsummering'),
      h('dl', { class: 'ferdig-tallrad' },
        tall('Møtt', s.mott, 'ferdig-mott'),
        tall('Meldt fravær', s.meldtFravaer, 'ferdig-fravaer'),
        tall('Ikke møtt', s.ikkeMott, 'ferdig-ikke-mott')),
      h('h3', { class: 'ferdig-undertittel' }, 'Avvik'),
      ingenAvvik
        ? h('p', { class: 'ok-linje', id: 'ferdig-ingen-avvik' }, s.tellinger ? `✓ Ingen avvik. ${s.tellinger} ${s.tellinger === 1 ? 'telling' : 'tellinger'} stemte.` : '✓ Ingen avvik.')
        : h('ul', { class: 'ferdig-avvik', id: 'ferdig-avvik' },
          s.aldriRegistrert ? h('li', {}, `${s.aldriRegistrert} forventet ble aldri registrert`) : null,
          s.ikkeSjekketUt ? h('li', {}, `${s.ikkeSjekketUt} ${s.ikkeSjekketUt === 1 ? 'barn står' : 'barn står'} fortsatt som inne`) : null,
          s.tellingerMedAvvik ? h('li', {}, `${s.tellingerMedAvvik} av ${s.tellinger} ${s.tellinger === 1 ? 'telling' : 'tellinger'} hadde avvik`) : null),
      !s.tellinger ? h('p', { class: 'dempet liten' }, 'Det ble ikke gjort noen telling i dag.') : null),

    h('section', { class: 'kort', id: 'ferdig-kopi' },
      h('h2', {}, 'Sikkerhetskopi'),
      kopiIDag
        ? h('p', { class: 'ok-linje', id: 'ferdig-kopi-ok' }, `✓ Sikkerhetskopi tatt kl. ${klokkeFra(siste)}.`)
        : [
          h('p', { class: 'advarsel', id: 'ferdig-kopi-mangler' }, 'Sikkerhetskopi er ikke tatt i dag.'),
          kopiKnapp({ tekst: 'Ta sikkerhetskopi nå', id: 'ferdig-ta-kopi', etter: oppfrisk }),
        ]),

    h('a', { class: 'knapp knapp-omriss knapp-stor knapp-lenkeknapp', href: '#idag', id: 'tilbake-idag' }, 'Tilbake til I dag'));
}
