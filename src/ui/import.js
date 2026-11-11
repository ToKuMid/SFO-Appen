// Import av elevlista fra Excel (K-01, K-02) og nedlasting av tom mal.
import { h, visDialog, visMelding } from '../dom.js';
import { hentAlle, hentInnstilling, nyId, utforEndringer } from '../db.js';
import { lesXlsx, skrivXlsx, XLSX_TYPE } from '../import/xlsx.js';
import { elevNavn, lagEndringer, lesElevliste, malForklaring, malRader, planleggImport } from '../import/elevliste.js';
import { velgFil } from '../filer.js';
import { lagreFilMedTrykk } from './sikkerhetskopi.js';
import { dagerMellom } from '../dato.js';
import { hentInitialer } from '../dag.js';

const MAL_FILNAVN = 'SFO-elevliste-mal.xlsx';

/** Lagrer en tom Excel-mal med forklaring (kravspesifikasjonen kap. 7). */
export async function hentMal() {
  const bytes = skrivXlsx([
    { navn: 'Elever', rader: malRader(), frysForsteRad: true, bredder: [14, 16, 7, 16, 6, 6, 6, 6, 6, 18, 14] },
    { navn: 'Forklaring', rader: malForklaring(), bredder: [22, 9, 70, 30] },
  ]);
  const resultat = await lagreFilMedTrykk(bytes, MAL_FILNAVN, XLSX_TYPE);
  if (resultat === 'lastet-ned') visMelding(`${MAL_FILNAVN} er lastet ned. Fyll den ut i Excel og lagre den i SFO-mappen i OneDrive.`, 'ok');
  else if (resultat === 'delt') visMelding(`${MAL_FILNAVN} er sendt til valgt sted.`, 'ok');
}

/** Hele importen: velg fil → kontroll → eventuelle valg → forhåndsvisning → lagring. */
export async function importerElevliste(oppfrisk) {
  let fil;
  try {
    fil = await velgFil({ accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', binar: true });
  } catch (e) {
    visMelding(e.message, 'feil');
    return;
  }
  if (!fil) return;

  // 1. Les og kontroller fila. Ingenting lagres hvis fila har feil.
  let resultat;
  try {
    const { ark } = await lesXlsx(fil.data);
    resultat = lesElevliste(ark[0]);
  } catch (e) {
    resultat = { elever: [], feil: [e.message], advarsler: [] };
  }
  if (resultat.feil.length) {
    await visDialog({
      tittel: 'Kan ikke importere',
      innhold: [
        h('p', {}, `Fila «${fil.navn}» har ${resultat.feil.length === 1 ? 'en feil' : `${resultat.feil.length} feil`}. Ingenting er endret i appen.`),
        h('ul', { class: 'importliste' }, resultat.feil.slice(0, 20).map((f) => h('li', {}, f))),
        resultat.feil.length > 20 ? h('p', { class: 'dempet' }, `… og ${resultat.feil.length - 20} feil til.`) : null,
        h('p', {}, 'Rett feilene i Excel-fila og importer på nytt.'),
      ],
      knapper: [{ tekst: 'Lukk', verdi: 'lukk', type: 'primar' }],
    });
    return;
  }

  // 2. Match mot elevene i appen.
  const [elever, avtaler] = await Promise.all([hentAlle('elever'), hentAlle('avtaler')]);
  const plan = planleggImport(resultat.elever, elever, avtaler);

  // 3. Navnelikhet: den ansatte velger riktig elev.
  const valg = {};
  const tvetydige = plan.rader.filter((r) => r.type === 'tvetydig');
  if (tvetydige.length) {
    const ok = await velgTvetydige(tvetydige, elever, valg);
    if (!ok) return;
  }

  let endringer;
  try {
    endringer = lagEndringer(plan, valg, { nyId });
  } catch (e) {
    visMelding(e.message, 'feil');
    return;
  }
  const s = endringer.sammendrag;
  const naa = new Date().toISOString();

  if (s.ingenEndringer) {
    await utforEndringer({ lagre: { innstillinger: [{ nokkel: 'sisteImport', verdi: naa }] } });
    await visDialog({
      tittel: 'Ingen endringer',
      innhold: [h('p', {}, `Alle ${s.uendret} elevene i «${fil.navn}» er allerede oppdatert i appen.`)],
      knapper: [{ tekst: 'OK', verdi: 'ok', type: 'primar' }],
    });
    oppfrisk();
    return;
  }

  // 4. Forhåndsvisning før lagring (K-01).
  const sisteKopi = await hentInnstilling('sisteSikkerhetskopi');
  const mangeDeaktiveres = s.aktiveFor >= 4 && s.deaktiveres.length > s.aktiveFor / 2;
  const svar = await visDialog({
    tittel: 'Importere elevlista?',
    innhold: [
      h('p', {}, `Fil: ${fil.navn}`),
      h('table', { class: 'sammenligning' }, h('tbody', {},
        [['Nye elever', s.nye.length], ['Oppdatert', s.oppdatert.length], ['Gått opp et trinn', s.gattOpp.length],
          ['Aktivert igjen', s.reaktivert.length], ['Deaktiveres', s.deaktiveres.length], ['Uendret', s.uendret]]
          .map(([navn, n]) => h('tr', {}, h('th', {}, navn), h('td', {}, n))))),
      del('Nye elever', s.nye),
      del('Oppdatert', s.oppdatert.map((l) => `${l.navn}: ${l.endringer.join(', ')}`)),
      del('Gått opp et trinn', s.gattOpp.map((l) => `${l.navn}${l.endringer.length > 1 ? `: ${l.endringer.join(', ')}` : ''}`)),
      del('Aktivert igjen', s.reaktivert.map((l) => l.navn)),
      del('Deaktiveres (står ikke i fila)', s.deaktiveres),
      mangeDeaktiveres ? h('p', { class: 'advarsel' }, `${s.deaktiveres.length} av ${s.aktiveFor} elever blir deaktivert. Sjekk at du har valgt riktig fil.`) : null,
      resultat.advarsler.length ? h('p', { class: 'dempet liten' }, resultat.advarsler.join(' ')) : null,
      h('p', { class: 'dempet liten' }, 'Historikk slettes aldri. Deaktiverte elever kan aktiveres igjen.'),
      !sisteKopi || dagerMellom(sisteKopi) > 0 ? h('p', { class: 'dempet liten' }, 'Tips: Ta sikkerhetskopi før du importerer.') : null,
    ],
    knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Importer', verdi: 'importer', type: 'primar' }],
  });
  if (svar !== 'importer') return;

  // 5. Lagre alt i én transaksjon.
  try {
    const stempel = { endretAv: await hentInitialer(), endret: naa };
    await utforEndringer({
      lagre: {
        elever: endringer.elever.map((e) => ({ ...e, ...stempel })),
        avtaler: endringer.avtalerLagre.map((a) => ({ ...a, ...stempel })),
        innstillinger: [{ nokkel: 'sisteImport', verdi: naa }],
      },
      slett: { avtaler: endringer.avtalerSlett },
    });
    visMelding(`Elevlista er importert: ${s.aktiveEtter} aktive elever.`, 'ok');
    oppfrisk();
  } catch (e) {
    visMelding(`Importen feilet, ingenting er endret: ${e.message}`, 'feil');
  }
}

function del(tittel, linjer) {
  if (!linjer.length) return null;
  return h('details', { class: 'importdel' },
    h('summary', {}, `${tittel} (${linjer.length})`),
    h('ul', { class: 'importliste' }, linjer.map((l) => h('li', {}, l))));
}

async function velgTvetydige(tvetydige, elever, valg) {
  const elevFor = new Map(elever.map((e) => [e.id, e]));
  const felter = tvetydige.map((r) => {
    const id = `valg-${r.imp.rad}`;
    const select = h('select', { id },
      h('option', { value: '' }, 'Velg …'),
      r.kandidater.map((k) => {
        const e = elevFor.get(k);
        return h('option', { value: k }, `${elevNavn(e)}, ${e.skolegruppe}${e.aktiv === false ? ', deaktivert' : ''}`);
      }),
      h('option', { value: 'ny' }, 'En ny elev'));
    return { r, select, el: h('div', { class: 'valgrad' },
      h('label', { for: id }, `Rad ${r.imp.rad}: ${elevNavn(r.imp)}, ${r.imp.skolegruppe}`), select) };
  });

  while (true) {
    const svar = await visDialog({
      tittel: 'Samme navn',
      innhold: [
        h('p', {}, 'Appen har flere elever med samme navn. Velg hvem hver rad i fila gjelder.'),
        felter.map((f) => f.el),
      ],
      knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Fortsett', verdi: 'videre', type: 'primar' }],
    });
    if (svar !== 'videre') return false;
    const mangler = felter.filter((f) => !f.select.value);
    const valgte = felter.map((f) => f.select.value).filter((v) => v && v !== 'ny');
    if (mangler.length) visMelding('Velg for alle radene.', 'advarsel');
    else if (new Set(valgte).size !== valgte.length) visMelding('Samme elev er valgt for flere rader.', 'advarsel');
    else {
      for (const f of felter) valg[f.r.imp.rad] = f.select.value;
      return true;
    }
  }
}
