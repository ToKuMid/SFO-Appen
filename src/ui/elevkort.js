// Elevkortet (kravspesifikasjonen kap. 5, mockupen «Elevkort»): status i dag, faste avtaler,
// dagens hendelser, og handlinger for inn/ut, fravær, rett tidspunkt (K-15) og unntak (K-19).
import { h, visDialog, visMelding } from '../dom.js';
import { hentDag, rettTidspunkt, settUnntakIDag } from '../dag.js';
import { elevStatus, gjeldendeHendelser, HENDELSE_TEKST, STATUS, STATUS_TEKST } from '../model/status.js';
import { UKEDAGER } from '../model/elev.js';
import { klokkeFra, klokkeslett, tidVerdiFra, tidspunktTekst } from '../dato.js';
import { pilVenstre } from './felles.js';
import { angreSiste, kanAngres, registrerFravaer, sjekkInn, sjekkUt } from './handlinger.js';

const FANENAVN = { idag: 'I dag', andre: 'Ikke inne', telling: 'Telling', elever: 'Elever', mer: 'Mer' };

export async function visElevkort(id, { tilbake = 'idag' } = {}) {
  const d = await hentDag();
  const elevUtenRad = d.elever.find((e) => e.id === id);
  const rad = d.rader.find((r) => r.elev.id === id)
    ?? (elevUtenRad ? elevStatus(elevUtenRad, d.dato, d.hendelser, d.unntak) : null);
  const tilbakeLenke = h('a', { class: 'tilbake', href: `#${tilbake}` }, pilVenstre(), FANENAVN[tilbake] ?? 'Tilbake');
  if (!rad) {
    return h('div', { class: 'skjerm' }, tilbakeLenke, h('section', { class: 'kort' }, h('p', {}, 'Fant ikke eleven.')));
  }
  const { elev, status } = rad;
  const avtale = d.avtaleFor.get(elev.id);
  const unntak = d.unntak.find((u) => u.elevId === elev.id);
  const dager = UKEDAGER.filter((u) => elev.ukedager?.includes(u.nr)).map((u) => u.navn).join(', ');

  // Status som brikke under navnet
  let statusTekst = STATUS_TEKST[status];
  if (status === STATUS.INNE && rad.innSiden) statusTekst = `Inne siden ${klokkeFra(rad.innSiden)}`;
  else if (status === STATUS.UT) statusTekst = `Sjekket ut ${klokkeFra(rad.siste.tid)}`;
  const statusKlasse = status === STATUS.INNE ? 'chip-gronn' : status === STATUS.FORVENTET && d.varselAktivt ? 'chip-varsel' : '';

  // Dagens historikk, også angrede og rettede hendelser (K-15: rettelser vises i historikken)
  const alleIDag = d.hendelser.filter((x) => x.elevId === elev.id).sort((a, b) => a.tid.localeCompare(b.tid));
  const { fjernet, rettetTil } = gjeldendeHendelser(alleIDag);
  const historikk = alleIDag.filter((x) => x.type !== 'angret');

  // Hovedhandling etter status
  let hoved = null;
  if (status === STATUS.INNE) hoved = h('button', { type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'kort-ut', onclick: () => sjekkUt(rad) }, 'Sjekk ut');
  else if (status === STATUS.UT) hoved = h('button', { type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'kort-inn', onclick: () => sjekkInn(rad) }, 'Sjekk inn igjen');
  else if (elev.aktiv !== false) hoved = h('button', { type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'kort-inn', onclick: () => sjekkInn(rad) }, status === STATUS.IKKE_SFO ? 'Sjekk inn (ekstra dag)' : 'Sjekk inn');

  const ekstra = [];
  // Etter fravær eller «ikke SFO i dag» går appen rett tilbake til I dag. Meldingen nederst har «Angre».
  const tilIdag = () => { location.hash = 'idag'; };
  if (status === STATUS.FORVENTET) {
    ekstra.push(h('button', {
      type: 'button', class: 'knapp', id: 'kort-fravaer',
      onclick: async () => { if (await registrerFravaer(rad)) tilIdag(); },
    }, 'Fravær'));
  }
  if (status === STATUS.FORVENTET && !unntak) {
    ekstra.push(h('button', {
      type: 'button', class: 'knapp', id: 'kort-ikke-sfo',
      onclick: async () => {
        await settUnntakIDag(elev.id, 'ikke-sfo');
        visMelding(`${elev.fornavn} ${elev.etternavn} har ikke SFO i dag.`, 'ok', {
          handling: { tekst: 'Angre', onclick: () => settUnntakIDag(elev.id, null) },
        });
        tilIdag();
      },
    }, 'Ikke SFO i dag'));
  }
  if (unntak && rad.hendelser.length === 0) {
    ekstra.push(h('button', { type: 'button', class: 'knapp', id: 'kort-fjern-unntak', onclick: async () => { await settUnntakIDag(elev.id, null); visMelding('Unntaket for i dag er fjernet.', 'ok'); } },
      unntak.type === 'ikke-sfo' ? 'Har SFO i dag likevel' : 'Fjern ekstra SFO-dag'));
  }
  if (rad.siste && kanAngres(rad)) ekstra.push(h('button', { type: 'button', class: 'knapp', id: 'kort-angre', onclick: () => angreSiste(rad) }, `Angre «${HENDELSE_TEKST[rad.siste.type].toLowerCase()}»`));

  return h('div', { class: 'skjerm elevkort' },
    tilbakeLenke,
    h('div', { class: 'kort-topp' },
      h('h1', { class: 'sidetittel' }, `${elev.fornavn} ${elev.etternavn}`),
      h('p', { class: 'undertittel' }, [`${elev.trinn}. trinn`, elev.skolegruppe, dager ? `SFO ${dager}` : null].filter(Boolean).join(' · ')),
      h('span', { class: `chip chip-stor ${statusKlasse}`, id: 'kort-status' }, statusTekst),
      unntak ? h('p', { class: 'dempet liten' }, unntak.type === 'ikke-sfo' ? 'Unntak i dag: ikke SFO.' : 'Unntak i dag: ekstra SFO-dag.') : null,
      elev.aktiv === false ? h('p', { class: 'advarsel' }, 'Eleven er deaktivert.') : null),

    h('section', { class: 'kort' },
      h('h2', {}, 'Faste avtaler'),
      h('div', { class: 'felt-rad' }, h('span', {}, 'Går hjem alene'), h('strong', {}, avtale?.gaarHjemAleneFra ? `Fra ${klokkeslett(avtale.gaarHjemAleneFra)}` : 'Nei')),
      h('div', { class: 'felt-rad' }, h('span', {}, 'Fast hentetid'), h('strong', {}, avtale?.fastHentetid ? klokkeslett(avtale.fastHentetid) : '–')),
      avtale?.fritekst ? h('div', { class: 'merknadsfelt' },
        h('span', { class: 'feltnavn' }, 'Merknad'),
        h('p', {}, avtale.fritekst)) : null,
      avtale?.endretAv ? h('p', { class: 'dempet liten', id: 'avtale-endret' }, `Sist endret ${tidspunktTekst(avtale.endret)} av ${avtale.endretAv}`) : null),

    h('section', { class: 'seksjon' },
      h('h2', { class: 'seksjonstittel' }, 'I dag'),
      historikk.length
        ? h('ol', { class: 'historikk', id: 'historikk' }, historikk.map((x) => {
          const hva = fjernet.get(x.id);
          const merknad = hva === 'angret' ? 'angret' : hva === 'rettet' ? `rettet til ${klokkeFra(rettetTil.get(x.id).tid)}` : x.erstatter ? 'rettet tidspunkt' : null;
          return h('li', { class: hva ? 'historikk-fjernet' : '' },
            h('span', { class: 'historikk-tid' }, klokkeFra(x.tid)),
            h('span', { class: 'historikk-tekst' }, HENDELSE_TEKST[x.type], merknad ? h('span', { class: 'dempet liten' }, ` (${merknad})`) : null),
            h('span', { class: 'historikk-init' }, x.initialer ?? ''));
        }))
        : h('p', { class: 'dempet' }, 'Ingen registreringer i dag.')),

    h('div', { class: 'bunnfelt' },
      hoved,
      h('div', { class: 'to-kolonner' },
        h('button', { type: 'button', class: 'knapp', id: 'rett-tid', disabled: rad.hendelser.length === 0, onclick: () => rettTid(rad) }, 'Rett tidspunkt'),
        h('a', { class: 'knapp knapp-lenkeknapp', href: `#elever/${elev.id}`, id: 'rediger' }, 'Rediger avtaler')),
      ekstra.length ? h('div', { class: 'knapperad' }, ekstra) : null),
  );
}

/** K-15: velg en av dagens registreringer og sett nytt klokkeslett. */
async function rettTid(rad) {
  const hendelser = rad.hendelser;
  const valg = h('select', { id: 'rett-hendelse' },
    hendelser.map((x, i) => h('option', { value: x.id, selected: i === hendelser.length - 1 }, `${klokkeFra(x.tid)} ${HENDELSE_TEKST[x.type]}`)));
  const tid = h('input', { id: 'rett-ny-tid', type: 'time', value: tidVerdiFra(hendelser[hendelser.length - 1].tid) });
  valg.addEventListener('change', () => { tid.value = tidVerdiFra(hendelser.find((x) => x.id === valg.value).tid); });

  const svar = await visDialog({
    tittel: 'Rett tidspunkt',
    innhold: [
      h('div', { class: 'felt' }, h('label', { for: 'rett-hendelse', class: 'feltnavn' }, 'Registrering'), valg),
      h('div', { class: 'felt' }, h('label', { for: 'rett-ny-tid', class: 'feltnavn' }, 'Riktig klokkeslett'), tid),
      h('p', { class: 'dempet liten' }, 'Det gamle tidspunktet blir stående i historikken som rettet.'),
    ],
    knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Lagre', verdi: 'lagre', type: 'primar' }],
  });
  if (svar !== 'lagre' || !tid.value) return;
  const hendelse = hendelser.find((x) => x.id === valg.value);
  if (tidVerdiFra(hendelse.tid) === tid.value) return;
  await rettTidspunkt(hendelse, tid.value);
  visMelding(`Tidspunktet er rettet til ${klokkeslett(tid.value)}.`, 'ok');
}
