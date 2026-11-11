// Avviksrapport (K-54): bare det som skal følges opp, med linje for gjennomgang og signatur.
// Samme periodevalg, logo, forkortede navn og utskrift som de andre rapportene.
import { h } from '../dom.js';
import { kortDatoMedDag, klokkeFra, lokalDato } from '../dato.js';
import { avviksrapport } from '../model/rapport.js';
import { pilVenstre } from './felles.js';
import {
  avTekst, hentRapportdata, periodeKontroller, periodeTekst, rapportBunn, rapportTopp, tabell, tall, utskrevetNaa, valgtPeriode,
} from './rapportfelles.js';

export async function visAvviksrapport(oppfrisk) {
  const idag = lokalDato();
  const p = valgtPeriode(idag);
  return h('div', { class: 'skjerm' },
    h('a', { class: 'tilbake ikke-utskrift', href: '#mer' }, pilVenstre(), 'Mer'),
    h('div', { class: 'ikke-utskrift kort-topp' },
      h('h1', { class: 'sidetittel' }, 'Avviksrapport'),
      h('p', { class: 'undertittel' }, 'Det som skal følges opp: tellinger, ikke møtt og manglende registreringer')),
    periodeKontroller(p, idag, oppfrisk),
    p.feil ? null : await lagRapport(p.fra, p.til, idag));
}

async function lagRapport(fra, til, idag) {
  const r = avviksrapport({ ...await hentRapportdata(fra, til), fra, til, idag });
  const s = r.sammendrag;
  const utskrevet = utskrevetNaa();
  const varsel = { varsel: true };
  const del = (id, tittel, antall, innhold, tomTekst) => h('section', { class: 'rapport-del', id },
    h('h3', {}, `${tittel} (${antall})`),
    antall ? innhold() : h('p', {}, tomTekst));
  const kl = (iso) => (iso ? klokkeFra(iso) : '–');
  const deler = (x) => [
    x.manglet ? `manglet ved telling ${x.manglet}` : null,
    x.ikkeMott ? `ikke møtt ${x.ikkeMott}` : null,
    x.aldriRegistrert ? `aldri registrert ${x.aldriRegistrert}` : null,
    x.ikkeUtsjekket ? `ikke sjekket ut ${x.ikkeUtsjekket}` : null,
  ].filter(Boolean).join(', ');

  return h('article', { class: 'rapport', id: 'rapport' },
    rapportTopp({ type: 'Avviksrapport', tittel: periodeTekst(r), utskrevet }),

    h('section', { class: 'rapport-del' },
      h('h3', {}, 'Sammendrag'),
      r.sfoDager === 0 && r.dagerUtenRegistreringer.length === 0
        ? h('p', {}, 'Ingen SFO-dager i perioden.')
        : h('div', {},
          r.ingenAvvik ? h('p', { class: 'rapport-ok', id: 'ingen-avvik' }, 'Ingen avvik i perioden.') : null,
          h('dl', { class: 'rapport-sammendrag', id: 'rapport-sammendrag' },
            tall('Tellinger med avvik', s.tellingerMedAvvik, varsel),
            tall('Barn som manglet ved telling', s.barnSomManglet, varsel),
            tall('Ikke møtt', s.ikkeMott, varsel),
            tall('Aldri registrert', s.aldriRegistrert, varsel),
            tall('Ikke sjekket ut', s.ikkeUtsjekket, varsel),
            tall('Dager uten telling', s.dagerUtenTelling, varsel),
            s.dagerUtenRegistreringer ? tall('Dager uten registreringer', s.dagerUtenRegistreringer, varsel) : null))),

    del('avvik-telling', 'Avvik ved telling', r.tellingAvvik.length,
      () => tabell(['Dato', 'Kl.', 'Talt', 'Manglet', 'Init.', 'Kommentar'],
        r.tellingAvvik.map((t) => [kortDatoMedDag(t.dato), klokkeFra(t.tid), avTekst(t), t.mangler.join(', '), t.initialer ?? '', t.kommentar])),
      'Ingen avvik ved telling.'),

    del('avvik-ikke-mott', 'Ikke møtt', r.ikkeMott.length,
      () => h('div', {},
        h('p', { class: 'rapport-forklaring' }, 'Barnet kom ikke, uten meldt fravær. En ansatt har registrert det som fulgt opp.'),
        tabell(['Dato', 'Barn', 'Registrert', 'Init.'], r.ikkeMott.map((x) => [kortDatoMedDag(x.dato), x.navn, kl(x.tid), x.initialer ?? '']))),
      'Ingen barn registrert som ikke møtt.'),

    del('avvik-aldri', 'Aldri registrert', r.aldriRegistrert.length,
      () => h('div', {},
        h('p', { class: 'rapport-forklaring' }, 'Barnet var forventet, men ingenting ble registrert. Det finnes ingen registrering av at det ble fulgt opp.'),
        tabell(['Dato', 'Barn'], r.aldriRegistrert.map((x) => [kortDatoMedDag(x.dato), x.navn]))),
      'Alle forventede barn ble registrert.'),

    del('avvik-ikke-ut', 'Ikke sjekket ut', r.ikkeUtsjekket.length,
      () => tabell(['Dato', 'Barn', 'Sjekket inn'], r.ikkeUtsjekket.map((x) => [kortDatoMedDag(x.dato), x.navn, kl(x.inn)])),
      'Alle barn ble sjekket ut.'),

    r.dagerUtenTelling.length || r.dagerUtenRegistreringer.length ? h('section', { class: 'rapport-del', id: 'avvik-dager' },
      h('h3', {}, 'Dager uten telling eller registreringer'),
      tabell(['Dato', 'Avvik'], [
        ...r.dagerUtenTelling.map((d) => [d, 'Ingen telling']),
        ...r.dagerUtenRegistreringer.map((d) => [d.dato, `Ingen registreringer (${d.forventet} forventet). SFO stengt, eller appen ikke brukt?`]),
      ].sort((a, b) => a[0].localeCompare(b[0])).map(([d, t]) => [kortDatoMedDag(d), t]))) : null,

    r.flereAvvik.length ? h('section', { class: 'rapport-del', id: 'avvik-flere' },
      h('h3', {}, `Barn med flere avvik i perioden (${r.flereAvvik.length})`),
      tabell(['Barn', 'Antall', 'Hva'], r.flereAvvik.map((x) => [x.navn, x.totalt, deler(x)]))) : null,

    h('section', { class: 'rapport-del rapport-signatur', id: 'gjennomgang' },
      h('h3', {}, 'Gjennomgang'),
      h('div', { class: 'signatur-rad' },
        h('div', { class: 'signatur-felt' }, h('span', {}, 'Gjennomgått av')),
        h('div', { class: 'signatur-felt' }, h('span', {}, 'Dato'))),
      h('div', { class: 'signatur-felt signatur-bred' }, h('span', {}, 'Oppfølging og tiltak'))),

    rapportBunn(utskrevet));
}
