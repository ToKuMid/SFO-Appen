// Grupperapport (K-50, K-52): velg periode, se rapporten og skriv ut eller lagre som PDF.
// Rapporten lages som en utskriftsvennlig side. Appen lagrer ingen PDF selv; det gjør telefonens
// utskriftsfunksjon, og brukeren velger SFO-mappen i skolens OneDrive (DPIA tiltak T7).
import { h } from '../dom.js';
import { kortDatoMedDag, klokkeFra, lokalDato } from '../dato.js';
import { grupperapport } from '../model/rapport.js';
import { pilVenstre } from './felles.js';
import {
  avTekst, hentRapportdata, periodeKontroller, periodeTekst, rapportBunn, rapportTopp, tabell, tall, utskrevetNaa, valgtPeriode,
} from './rapportfelles.js';

// Brukes også av elevrapporten og avviksrapporten (felles periodevalg).
export { periodeKontroller, valgtPeriode };

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

async function lagRapport(fra, til, idag) {
  const r = grupperapport({ ...await hentRapportdata(fra, til), fra, til, idag });
  const s = r.sammendrag;
  const utskrevet = utskrevetNaa();

  const merknader = (d) => [
    d.ingenRegistreringer ? 'Ingen registreringer' : null,
    d.ikkeRegistrert.length ? `Aldri registrert: ${d.ikkeRegistrert.join(', ')}` : null,
    d.ikkeUtsjekket.length ? `Ikke sjekket ut: ${d.ikkeUtsjekket.join(', ')}` : null,
    !d.ingenRegistreringer && d.tellinger === 0 ? 'Ingen telling' : null,
  ].filter(Boolean).join('. ');

  const fravaersdager = r.dager.filter((d) => d.meldtFravaer.length || d.ikkeMott.length);

  return h('article', { class: 'rapport', id: 'rapport' },
    rapportTopp({ type: 'Grupperapport', tittel: periodeTekst(r), utskrevet }),

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

    rapportBunn(utskrevet));
}
