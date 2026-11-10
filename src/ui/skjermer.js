// Skjermene «I dag» og «Ikke inne» (adresse #andre) (K-12, K-13, K-16, K-20). Utseende og flyt som i mockupen.
import { h, visDialog } from '../dom.js';
import { hentDag } from '../dag.js';
import { aktiveInitialer, byttInitialer } from './las.js';
import { hentInnstilling } from '../db.js';
import { dagerMellom, klokkeFra, klokkeslett } from '../dato.js';
import { STATUS } from '../model/status.js';
import { elevRad, kortGruppe, skjermTopp, sorterElever } from './felles.js';
import { kanAngres, knappAngre, knappFravaer, knappSjekkInn, knappSjekkUt } from './handlinger.js';
import { eksporter } from './mer.js';

// Søketeksten huskes når skjermen tegnes på nytt etter en inn- eller utsjekk.
let sokTekst = '';

const lenkeTil = (r) => `#elev/${r.elev.id}`;
const sorter = (rader) => {
  const rekkefolge = new Map(sorterElever(rader.map((r) => r.elev)).map((e, i) => [e.id, i]));
  return [...rader].sort((a, b) => rekkefolge.get(a.elev.id) - rekkefolge.get(b.elev.id));
};

function varselIkon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'varsel-ikon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M12 3 2 20h20L12 3z', 'M12 10v4', 'M12 17h.01']) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

function filtrer(liste, tekst) {
  const ord = tekst.toLocaleLowerCase('nb').trim().split(/\s+/).filter(Boolean);
  for (const li of liste.querySelectorAll('li[data-sok]')) li.hidden = !ord.every((o) => li.dataset.sok.includes(o));
}

// ---------- I dag ----------

export async function visIdag() {
  const d = await hentDag();
  const { tall, etterStatus, avtaleFor } = d;
  const inne = sorter(etterStatus[STATUS.INNE]);
  const initialer = aktiveInitialer() ?? '';

  const inneListe = h('ul', { class: 'liste', id: 'inne-liste' }, inne.map((r) => elevRad(r.elev, {
    avtale: avtaleFor.get(r.elev.id),
    ekstraMeta: r.innSiden ? `inn ${klokkeFra(r.innSiden)}` : null,
    lenke: lenkeTil(r),
    handling: knappSjekkUt(r),
  })));

  const varselListe = d.uregistrert.length ? h('ul', { class: 'liste varsel-liste', id: 'varsel-liste' },
    sorter(d.uregistrert).map((r) => elevRad(r.elev, {
      meta: `${r.elev.trinn}. trinn · ${kortGruppe(r.elev.skolegruppe)} · forventet`,
      lenke: lenkeTil(r),
      handling: knappSjekkInn(r, { stil: 'knapp-varsel' }),
      klasse: 'rad-i-varsel',
    }))) : null;

  const sok = h('input', {
    id: 'sok', type: 'search', placeholder: 'Navn eller trinn', autocomplete: 'off', value: sokTekst,
    oninput: () => {
      sokTekst = sok.value;
      filtrer(inneListe, sokTekst);
      if (varselListe) filtrer(varselListe, sokTekst);
    },
  });
  if (sokTekst) {
    filtrer(inneListe, sokTekst);
    if (varselListe) filtrer(varselListe, sokTekst);
  }

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'I dag', visKlokke: true }),

    h('div', { class: 'hovedtall' },
      h('div', {},
        h('p', { class: 'hovedtall-etikett' }, 'Inne nå'),
        h('p', { class: 'hovedtall-tall', id: 'antall-inne' }, tall.inne)),
      h('div', { class: 'hovedtall-side' },
        h('p', {}, `av ${tall.forventet} forventet`),
        h('p', {}, `${tall.sjekketUt} sjekket ut`),
        h('p', {}, `${tall.meldtFravaer} meldt fravær`),
        tall.ikkeMott ? h('p', {}, `${tall.ikkeMott} ikke møtt`) : null)),

    // K-16: varsel for forventede barn som ikke er registrert etter varseltidspunktet
    varselListe ? h('section', { class: 'varselboks', id: 'varsel', 'aria-label': 'Varsel' },
      h('div', { class: 'varsel-topp' }, varselIkon(),
        h('p', {}, `${d.uregistrert.length} ${d.uregistrert.length === 1 ? 'barn er' : 'barn er'} ikke registrert etter ${klokkeslett(d.varseltid)}`)),
      varselListe) : null,

    !varselListe && tall.ikkeRegistrert > 0 ? h('a', { class: 'infolinje', href: '#andre' },
      h('span', {}, `${tall.ikkeRegistrert} forventet er ikke registrert ennå`),
      h('span', { class: 'infolinje-handling' }, 'Sjekk inn under Ikke inne')) : null,

    h('div', { class: 'sokerad' },
      h('div', { class: 'felt sok-felt' }, h('label', { for: 'sok', class: 'feltnavn' }, 'Søk etter barn'), sok),
      h('div', { class: 'felt init-felt' },
        h('span', { class: 'feltnavn' }, 'Initialer'),
        h('button', {
          type: 'button', class: 'knapp init-knapp', id: 'initialer', 'aria-label': `Initialer ${initialer}. Trykk for å bytte`,
          onclick: async () => { if (await byttInitialer()) window.dispatchEvent(new Event('sfo:endret')); },
        }, initialer || '–'))),

    h('p', { class: 'seksjonstittel' }, `Inne (${tall.inne})`),
    inne.length ? inneListe : h('p', { class: 'dempet' }, tall.forventet ? 'Ingen barn er sjekket inn ennå.' : 'Ingen barn er forventet i dag.'),

    h('button', { type: 'button', class: 'knapp knapp-lenke', id: 'avslutt-dagen', onclick: () => dagsavslutning() }, 'Avslutt dagen'),
  );
}

// ---------- Ikke inne (#andre) ----------

export async function visAndre() {
  const d = await hentDag();
  const { etterStatus, avtaleFor, naa } = d;
  const forventet = sorter(etterStatus[STATUS.FORVENTET]);
  const ute = sorter(etterStatus[STATUS.UT]);
  const fravaer = sorter([...etterStatus[STATUS.MELDT_FRAVAER], ...etterStatus[STATUS.IKKE_MOTT]]);
  const ikkeSfo = sorter(etterStatus[STATUS.IKKE_SFO]);

  const seksjon = (tittel, rader, lagRad, { varsel = false, id } = {}) => (rader.length ? h('section', { class: 'seksjon', id },
    h('h2', { class: `seksjonstittel ${varsel ? 'varsel' : ''}` }, `${tittel} (${rader.length})`),
    h('ul', { class: 'liste' }, rader.map(lagRad))) : null);

  const tom = !forventet.length && !ute.length && !fravaer.length;

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Ikke inne', undertittel: 'Forventet, sjekket ut og fravær' }),

    seksjon(d.varselAktivt ? 'Forventet, ikke registrert' : 'Forventet', forventet, (r) => elevRad(r.elev, {
      avtale: avtaleFor.get(r.elev.id),
      lenke: lenkeTil(r),
      klasse: d.varselAktivt ? 'rad-varsel' : '',
      handling: h('div', { class: 'radknapper' }, knappSjekkInn(r), knappFravaer(r)),
    }), { varsel: d.varselAktivt, id: 'forventet' }),

    seksjon('Sjekket ut', ute, (r) => elevRad(r.elev, {
      meta: [`${r.elev.trinn}. trinn`, `ut ${klokkeFra(r.siste.tid)}`, r.siste.initialer].filter(Boolean).join(' · '),
      lenke: lenkeTil(r),
      handling: kanAngres(r, naa) ? knappAngre(r) : knappSjekkInn(r, { tekst: 'Sjekk inn igjen', stil: '' }),
    }), { id: 'sjekket-ut' }),

    seksjon('Fravær', fravaer, (r) => elevRad(r.elev, {
      meta: [`${r.elev.trinn}. trinn`, r.status === STATUS.IKKE_MOTT ? 'ikke møtt' : 'meldt fravær', r.siste.initialer].filter(Boolean).join(' · '),
      lenke: lenkeTil(r),
      handling: kanAngres(r, naa) ? knappAngre(r) : knappSjekkInn(r, { stil: '' }),
    }), { id: 'fravaer' }),

    tom ? h('section', { class: 'kort' }, h('p', { class: 'dempet' }, 'Alle forventede barn er inne.')) : null,

    ikkeSfo.length ? h('details', { class: 'ikke-sfo', id: 'ikke-sfo' },
      h('summary', {}, `Ikke SFO i dag (${ikkeSfo.length})`),
      h('p', { class: 'dempet liten' }, 'Kommer et av disse barna likevel, sjekk det inn her. Det lagres som ekstra SFO-dag.'),
      h('ul', { class: 'liste' }, ikkeSfo.map((r) => elevRad(r.elev, {
        lenke: lenkeTil(r),
        handling: knappSjekkInn(r, { stil: '' }),
      })))) : null,
  );
}

// ---------- Dagsavslutning (K-20) ----------

async function dagsavslutning() {
  const d = await hentDag();
  const inne = sorter(d.etterStatus[STATUS.INNE]);
  const uregistrert = sorter(d.etterStatus[STATUS.FORVENTET]);
  const siste = await hentInnstilling('sisteSikkerhetskopi');
  const kopiIDag = siste && dagerMellom(siste) === 0;
  const navneliste = (rader) => h('ul', { class: 'importliste' }, rader.map((r) => h('li', {}, `${r.elev.fornavn} ${r.elev.etternavn}`)));

  const svar = await visDialog({
    tittel: 'Avslutte dagen',
    innhold: [
      inne.length
        ? [h('p', { class: 'advarsel' }, `${inne.length} ${inne.length === 1 ? 'barn står' : 'barn står'} fortsatt som inne. Sjekk ut eller rett før du går.`), navneliste(inne)]
        : h('p', {}, 'Ingen barn står som inne.'),
      uregistrert.length
        ? [h('p', {}, `${uregistrert.length} forventet ble aldri registrert. Marker fravær eller sjekk inn under Ikke inne.`), navneliste(uregistrert)]
        : null,
      h('p', { class: kopiIDag ? '' : 'advarsel' }, kopiIDag ? 'Sikkerhetskopi er tatt i dag.' : 'Husk sikkerhetskopi før du går.'),
    ],
    knapper: [
      { tekst: 'Lukk', verdi: 'lukk' },
      kopiIDag ? null : { tekst: 'Ta sikkerhetskopi nå', verdi: 'kopi', type: 'primar' },
    ].filter(Boolean),
  });
  if (svar === 'kopi') await eksporter(() => {});
}
