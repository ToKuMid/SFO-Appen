// Telling (K-30, K-31, K-32), som i mockupen: huk av barna du ser, avslutt med initialer,
// avvik lagres med navn og tidspunkt, og en kort kommentar kan legges til.
//
// En pågående telling lagres i innstillingene, slik at den ikke forsvinner hvis appen lukkes.
// Lista er alltid barna som er inne akkurat nå; et barn som sjekkes ut under tellingen forsvinner fra den.
import { h, visDialog, visMelding } from '../dom.js';
import { hentDag, hentInitialer, lagreInitialer } from '../dag.js';
import { hentEtterIndeks, hentInnstilling, lagreInnstilling, nyId, utforEndringer } from '../db.js';
import { klokkeFra } from '../dato.js';
import { STATUS, tellingResultat } from '../model/status.js';
import { skjermTopp, sorterElever } from './felles.js';

const NOKKEL = 'pagaendeTelling';

async function hentPagaende(dato) {
  const t = await hentInnstilling(NOKKEL);
  return t && t.dato === dato ? t : null;
}

export async function visTelling(oppfrisk) {
  const d = await hentDag();
  const pagaende = await hentPagaende(d.dato);
  const inne = d.etterStatus[STATUS.INNE];
  const rekkefolge = sorterElever(inne.map((r) => r.elev));
  const inneSortert = rekkefolge.map((e) => inne.find((r) => r.elev.id === e.id));
  return pagaende ? visPagaende(d, pagaende, inneSortert, oppfrisk) : visOversikt(d, inneSortert, oppfrisk);
}

// ---------- Ingen pågående telling: start og dagens tellinger ----------

async function visOversikt(d, inne, oppfrisk) {
  const tellinger = (await hentEtterIndeks('tellinger', 'dato', d.dato)).sort((a, b) => b.tid.localeCompare(a.tid));
  const navnFor = new Map(d.elever.map((e) => [e.id, `${e.fornavn} ${e.etternavn}`]));
  const linjer = new Map();
  await Promise.all(tellinger.map(async (t) => linjer.set(t.id, await hentEtterIndeks('tellingslinjer', 'tellingId', t.id))));

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Telling' }),
    h('section', { class: 'kort' },
      h('p', { class: 'statuslinje' }, inne.length ? `${inne.length} barn er inne nå.` : 'Ingen barn er inne nå.'),
      h('p', { class: 'dempet liten' }, 'Huk av hvert barn du ser. Barn som mangler, lagres som avvik med navn og tidspunkt.'),
      h('button', {
        type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'start-telling', disabled: inne.length === 0,
        onclick: async () => {
          await lagreInnstilling(NOKKEL, { id: nyId(), dato: d.dato, startet: new Date().toISOString(), talt: [] });
          oppfrisk();
        },
      }, 'Start telling')),
    tellinger.length ? [
      h('p', { class: 'seksjonstittel' }, `Dagens tellinger (${tellinger.length})`),
      h('ul', { class: 'liste', id: 'tellinger' }, tellinger.map((t) => {
        const mangler = (linjer.get(t.id) ?? []).filter((l) => !l.talt).map((l) => navnFor.get(l.elevId) ?? 'Ukjent');
        return h('li', { class: 'liste-rad telling-rad' },
          h('div', { class: 'rad-tekst' },
            h('p', { class: 'navn' }, `Kl. ${klokkeFra(t.tid)} · ${t.antallTalt} av ${t.antallForventet} talt`),
            h('div', { class: 'rad-meta' },
              mangler.length ? h('span', { class: 'chip chip-varsel' }, `${mangler.length} avvik`) : h('span', { class: 'chip chip-gronn' }, 'Alle talt'),
              t.initialer ? h('span', { class: 'meta' }, t.initialer) : null),
            mangler.length ? h('p', { class: 'meta' }, `Manglet: ${mangler.join(', ')}`) : null,
            t.kommentar ? h('p', { class: 'meta' }, `Kommentar: ${t.kommentar}`) : null));
      })),
    ] : null,
  );
}

// ---------- Pågående telling ----------

async function visPagaende(d, telling, inne, oppfrisk) {
  const talt = new Set(telling.talt);
  const initialer = await hentInitialer();

  const tallEl = h('span', { id: 'telling-talt' });
  const avEl = h('span', { class: 'telling-av' });
  const manglerEl = h('p', { class: 'telling-mangler', id: 'telling-mangler' });
  const fremdrift = h('div', { class: 'fremdrift-fyll' });
  const avsluttKnapp = h('button', { type: 'submit', class: 'knapp knapp-primar knapp-stor', id: 'avslutt-telling' });

  const rader = inne.map((r) => {
    const boks = h('input', { type: 'checkbox', checked: talt.has(r.elev.id), 'data-elev': r.elev.id });
    const merknad = h('span', { class: 'telling-trinn' });
    const label = h('label', { class: 'telling-valg' }, boks, h('span', { class: 'telling-navn' }, `${r.elev.fornavn} ${r.elev.etternavn}`), merknad);
    boks.addEventListener('change', async () => {
      if (boks.checked) talt.add(r.elev.id); else talt.delete(r.elev.id);
      oppdater();
      await lagreInnstilling(NOKKEL, { ...telling, talt: [...talt] });
    });
    return { r, label, merknad };
  });

  function oppdater() {
    const res = tellingResultat(inne, talt);
    tallEl.textContent = String(res.antallTalt);
    avEl.textContent = ` av ${res.antallForventet} talt`;
    manglerEl.textContent = res.mangler.length ? `${res.mangler.length} mangler` : 'Alle er talt';
    manglerEl.classList.toggle('ok', res.mangler.length === 0);
    fremdrift.style.width = `${res.antallForventet ? Math.round((res.antallTalt / res.antallForventet) * 100) : 0}%`;
    const fremheve = res.antallTalt > 0 && res.mangler.length <= 3;
    for (const { r, label, merknad } of rader) {
      const ikkeTalt = !talt.has(r.elev.id);
      label.classList.toggle('ikke-talt', ikkeTalt && fremheve);
      merknad.textContent = ikkeTalt && fremheve ? `${r.elev.trinn}. trinn · ikke talt` : `${r.elev.trinn}. trinn`;
    }
    avsluttKnapp.textContent = res.mangler.length ? `Avslutt med ${res.mangler.length} avvik` : 'Avslutt telling';
  }
  oppdater();

  const init = h('input', { id: 'telling-initialer', type: 'text', value: initialer, maxlength: 4, placeholder: 'F.eks. KT', autocapitalize: 'characters', autocomplete: 'off' });

  const avslutt = async () => {
    const res = tellingResultat(inne, talt);
    let kommentar = '';
    if (res.mangler.length) {
      const felt = h('textarea', { id: 'avvik-kommentar', rows: 3, maxlength: 300, placeholder: 'For eksempel: hentet uten utsjekk, på do' });
      const svar = await visDialog({
        tittel: `Avslutte med ${res.mangler.length} avvik?`,
        innhold: [
          h('p', {}, 'Ikke talt:'),
          h('ul', { class: 'importliste' }, res.mangler.map((r) => h('li', {}, `${r.elev.fornavn} ${r.elev.etternavn}`))),
          h('div', { class: 'felt' }, h('label', { for: 'avvik-kommentar', class: 'feltnavn' }, 'Kommentar (valgfritt)'), felt),
          h('p', { class: 'dempet liten' }, 'Avviket lagres med navn og tidspunkt.'),
        ],
        knapper: [{ tekst: 'Tilbake til telling', verdi: 'tilbake' }, { tekst: 'Avslutt telling', verdi: 'avslutt', type: 'primar' }],
      });
      if (svar !== 'avslutt') return;
      kommentar = felt.value.trim();
    }
    const initVerdi = init.value.trim().toUpperCase().slice(0, 4);
    if (initVerdi) await lagreInitialer(initVerdi);
    await utforEndringer({
      lagre: {
        tellinger: [{
          id: telling.id,
          dato: telling.dato,
          tid: telling.startet,
          avsluttet: new Date().toISOString(),
          antallForventet: res.antallForventet,
          antallTalt: res.antallTalt,
          initialer: initVerdi || null,
          kommentar,
        }],
        tellingslinjer: inne.map((r) => ({ id: nyId(), tellingId: telling.id, elevId: r.elev.id, talt: talt.has(r.elev.id) })),
      },
      slett: { innstillinger: [NOKKEL] },
    });
    visMelding(res.mangler.length ? `Telling lagret med ${res.mangler.length} avvik.` : `Telling lagret: alle ${res.antallTalt} er talt.`, res.mangler.length ? 'advarsel' : 'ok');
    oppfrisk();
  };

  const avbryt = async () => {
    const svar = await visDialog({
      tittel: 'Avbryte tellingen?',
      innhold: [h('p', {}, 'Avhukingen slettes, og ingenting lagres.')],
      knapper: [{ tekst: 'Fortsett telling', verdi: 'nei' }, { tekst: 'Avbryt telling', verdi: 'ja', type: 'fare' }],
    });
    if (svar !== 'ja') return;
    await utforEndringer({ slett: { innstillinger: [NOKKEL] } });
    oppfrisk();
  };

  return h('div', { class: 'skjerm telling' },
    h('div', { class: 'dato-linje' }, h('p', {}, `Telling startet kl. ${klokkeFra(telling.startet)}`)),
    h('h1', { class: 'sidetittel' }, 'Telling'),
    h('div', { class: 'kort telling-status' },
      h('div', { class: 'telling-tall-rad' },
        h('p', { class: 'telling-tall' }, tallEl, avEl),
        manglerEl),
      h('div', { class: 'fremdrift', role: 'presentation' }, fremdrift)),
    h('p', { class: 'seksjonstittel' }, 'Huk av barna du ser'),
    inne.length
      ? h('div', { class: 'telling-liste', id: 'telling-liste' }, rader.map((x) => x.label))
      : h('p', { class: 'dempet' }, 'Ingen barn er inne nå.'),
    h('button', { type: 'button', class: 'knapp knapp-lenke', id: 'avbryt-telling', onclick: avbryt }, 'Avbryt telling'),
    h('form', { class: 'bunnfelt telling-bunn', onsubmit: (e) => { e.preventDefault(); avslutt(); } },
      h('div', { class: 'telling-avslutt' },
        h('div', { class: 'felt init-felt' }, h('label', { for: 'telling-initialer', class: 'feltnavn' }, 'Initialer'), init),
        avsluttKnapp),
      h('p', { class: 'dempet liten' }, 'Avviket lagres med navn og tidspunkt. Du kan legge til en kommentar.')),
  );
}
