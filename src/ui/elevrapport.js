// Elevrapport (K-51): velg elev og periode, se inn- og utsjekk per dag, fravær og tellinger der
// barnet manglet, og skriv ut eller lagre som PDF. Navnet i selve rapporten forkortes som i
// grupperapporten. Fullt navn vises bare i valget på skjermen, ikke på utskriften.
import { h } from '../dom.js';
import { hent, hentAlle, hentIntervall } from '../db.js';
import { kortDatoMedDag, klokkeFra, langDato, lokalDato, tidspunktTekst } from '../dato.js';
import { elevrapport } from '../model/rapport.js';
import { STATUS } from '../model/status.js';
import { APP_VERSJON } from '../versjon.js';
import { elevRad, kortGruppe, pilVenstre, sorterElever } from './felles.js';
import { periodeKontroller, valgtPeriode } from './rapport.js';

export async function visElevrapport(elevId, oppfrisk) {
  const topp = [
    h('a', { class: 'tilbake ikke-utskrift', href: elevId ? '#rapport/elev' : '#mer' }, pilVenstre(), elevId ? 'Velg elev' : 'Mer'),
    h('div', { class: 'ikke-utskrift kort-topp' },
      h('h1', { class: 'sidetittel' }, 'Elevrapport'),
      h('p', { class: 'undertittel' }, 'Inn- og utsjekk, fravær og tellinger for ett barn')),
  ];
  const elev = elevId ? await hent('elever', elevId) : null;
  if (!elev) return h('div', { class: 'skjerm' }, ...topp, await elevvalg(elevId));

  const idag = lokalDato();
  const p = valgtPeriode(idag);
  return h('div', { class: 'skjerm' }, ...topp,
    h('section', { class: 'kort ikke-utskrift', id: 'valgt-elev' },
      h('h2', {}, 'Elev'),
      h('div', { class: 'valgt-elev' },
        h('div', {},
          h('p', { class: 'navn' }, `${elev.fornavn} ${elev.etternavn}`),
          h('p', { class: 'meta' }, [`${elev.trinn}. trinn`, kortGruppe(elev.skolegruppe), elev.aktiv === false ? 'deaktivert' : null].filter(Boolean).join(' · '))),
        h('a', { class: 'knapp knapp-omriss knapp-lenkeknapp', href: '#rapport/elev', id: 'bytt-elev' }, 'Bytt elev'))),
    periodeKontroller(p, idag, oppfrisk),
    p.feil ? null : await lagRapport(elev, p.fra, p.til, idag));
}

async function elevvalg(ukjentId) {
  const alle = await hentAlle('elever');
  const aktive = sorterElever(alle.filter((e) => e.aktiv !== false));
  const deaktiverte = sorterElever(alle.filter((e) => e.aktiv === false));
  const rad = (e) => elevRad(e, { lenke: `#rapport/elev/${encodeURIComponent(e.id)}` });
  const aktivListe = h('ul', { class: 'liste', id: 'rapport-elevliste' }, aktive.map(rad));
  const deaktivListe = deaktiverte.length ? h('ul', { class: 'liste' }, deaktiverte.map(rad)) : null;
  const deaktivTittel = deaktiverte.length ? h('h3', { class: 'gruppetittel' }, 'Deaktiverte elever') : null;
  const ingenTreff = h('p', { class: 'dempet', hidden: true }, 'Ingen elever passer søket.');

  const sok = h('input', {
    id: 'rapport-sok', type: 'search', placeholder: 'Navn, trinn eller gruppe', autocomplete: 'off',
    oninput: () => {
      const ord = sok.value.toLocaleLowerCase('nb').trim().split(/\s+/).filter(Boolean);
      let synlige = 0;
      let synligeDeaktiverte = 0;
      for (const liste of [aktivListe, deaktivListe].filter(Boolean)) {
        for (const li of liste.children) {
          const treff = ord.every((o) => li.dataset.sok.includes(o));
          li.hidden = !treff;
          if (treff) synlige += 1;
          if (treff && liste === deaktivListe) synligeDeaktiverte += 1;
        }
      }
      if (deaktivTittel) deaktivTittel.hidden = synligeDeaktiverte === 0;
      ingenTreff.hidden = synlige > 0;
    },
  });

  if (alle.length === 0) {
    return h('section', { class: 'kort' }, h('h2', {}, 'Velg elev'),
      h('p', {}, 'Ingen elever er lagt inn ennå. Importer elevlista under Mer.'));
  }
  return h('section', { class: 'kort', id: 'elevvalg' },
    h('h2', {}, 'Velg elev'),
    ukjentId ? h('p', { class: 'feilboks', role: 'alert' }, 'Fant ikke eleven. Velg på nytt.') : null,
    h('div', { class: 'felt' },
      h('label', { for: 'rapport-sok', class: 'feltnavn' }, 'Søk etter elev'),
      sok),
    aktivListe,
    deaktivTittel,
    deaktivListe,
    ingenTreff);
}

async function lagRapport(elev, fra, til, idag) {
  const [elever, hendelser, unntak, tellinger, tellingslinjer] = await Promise.all([
    hentAlle('elever'),
    hentIntervall('hendelser', 'dato', fra, til),
    hentIntervall('unntak', 'dato', fra, til),
    hentIntervall('tellinger', 'dato', fra, til),
    hentAlle('tellingslinjer'),
  ]);
  const r = elevrapport({ elev, elever, hendelser, unntak, tellinger, tellingslinjer, fra, til, idag });
  const s = r.sammendrag;
  const utskrevet = tidspunktTekst(new Date().toISOString());
  const periodeTekst = r.fra === r.til ? langDato(r.fra) : `${langDato(r.fra)} – ${langDato(r.til)}`;

  const tall = (etikett, verdi, { varsel = false } = {}) => h('div', { class: `rapport-tall ${varsel && verdi > 0 ? 'varsel' : ''}` },
    h('dt', {}, etikett), h('dd', {}, verdi));
  const tabell = (kolonner, rader, klasse = '') => h('table', { class: `rapport-tabell ${klasse}` },
    h('thead', {}, h('tr', {}, kolonner.map((k) => h('th', { scope: 'col' }, k)))),
    h('tbody', {}, rader.map((rad) => h('tr', {}, rad.map((c) => h('td', {}, c))))));

  // Flere inn/ut samme dag vises på hver sin linje. * = tidspunktet er rettet i appen.
  const tider = (liste, medInitialer) => (liste.length === 0 ? '–'
    : liste.map((x, i) => [
      i > 0 ? h('br') : null,
      `${klokkeFra(x.tid)}${x.rettet ? '*' : ''}${medInitialer && x.initialer ? ` (${x.initialer})` : ''}`,
    ]).flat().filter(Boolean));

  const merknad = (d) => [
    d.ekstraDag ? 'Ekstra SFO-dag' : null,
    d.fravaer?.type === 'meldt-fravaer' ? `Meldt fravær${d.fravaer.initialer ? ` (${d.fravaer.initialer})` : ''}` : null,
    d.fravaer?.type === 'ikke-mott' ? `Ikke møtt${d.fravaer.initialer ? ` (${d.fravaer.initialer})` : ''}` : null,
    d.aldriRegistrert ? 'Aldri registrert' : null,
    d.ikkeUtsjekket ? 'Ikke sjekket ut' : null,
    d.dato === idag && d.status === STATUS.INNE ? 'Inne nå' : null,
    d.dato === idag && d.status === STATUS.FORVENTET ? 'Ikke kommet ennå' : null,
    ...d.mangletVedTelling.map((t) => `Manglet ved telling kl. ${klokkeFra(t.tid)}`),
  ].filter(Boolean).join('. ');

  return h('article', { class: 'rapport', id: 'rapport' },
    h('header', { class: 'rapport-topp' },
      h('img', { class: 'rapport-logo', src: 'icons/skolelogo.png', alt: 'Bærum Montessoriskole' }),
      h('p', { class: 'rapport-type' }, 'Elevrapport · SFO'),
      h('h2', { class: 'rapport-tittel', id: 'rapport-navn' }, r.navn),
      h('p', { class: 'rapport-periode' }, periodeTekst),
      h('p', { class: 'rapport-utskrift' }, `Skrevet ut ${utskrevet}`)),

    h('section', { class: 'rapport-del' },
      h('h3', {}, 'Sammendrag'),
      r.dager.length === 0
        ? h('p', {}, 'Ingen SFO-dager for eleven i perioden.')
        : h('dl', { class: 'rapport-sammendrag sammendrag-elev', id: 'rapport-sammendrag' },
          tall('SFO-dager', s.forventetDager),
          tall('Møtt', s.mottDager),
          tall('Meldt fravær', s.meldtFravaer),
          tall('Ikke møtt', s.ikkeMott, { varsel: true }),
          tall('Aldri registrert', s.aldriRegistrert, { varsel: true }),
          tall('Ikke sjekket ut', s.ikkeUtsjekket, { varsel: true }),
          tall('Manglet ved telling', s.mangletVedTelling, { varsel: true }),
          s.ekstraDager ? tall('Ekstra SFO-dager', s.ekstraDager) : null)),

    r.dager.length ? h('section', { class: 'rapport-del', id: 'rapport-dager' },
      h('h3', {}, 'Per dag'),
      tabell(['Dato', 'Inn', 'Ut (init.)', 'Merknad'],
        r.dager.map((d) => [kortDatoMedDag(d.dato), tider(d.inn, false), tider(d.ut, true), merknad(d)]), 'tabell-elev'),
      r.harRettelser ? h('p', { class: 'rapport-fotnote' }, '* Tidspunktet er rettet i appen.') : null) : null,

    h('section', { class: 'rapport-del', id: 'rapport-manglet' },
      h('h3', {}, `Tellinger der eleven manglet (${r.manglet.length})`),
      r.manglet.length
        ? tabell(['Dato', 'Kl.', 'Talt', 'Init.', 'Kommentar'],
          r.manglet.map((t) => [kortDatoMedDag(t.dato), klokkeFra(t.tid), `${t.antallTalt} av ${t.antallForventet}`, t.initialer ?? '', t.kommentar]))
        : h('p', {}, 'Eleven manglet ikke ved noen telling i perioden.')),

    h('footer', { class: 'rapport-bunn' },
      `Skrevet ut ${utskrevet} · SFO-appen ${APP_VERSJON}`));
}
