// Fanen «Mer»: sikkerhetskopi (K-60–K-62), elevliste, innstillinger, teknisk test og utviklerverktøy.
import { h, visDialog, visMelding } from '../dom.js';
import {
  DATAVERSJON, erstattAltInnhold, hentAlle, hentAltInnhold, hentInnstilling, lagreInnstilling, slettAltInnhold, tell,
} from '../db.js';
import { byggSikkerhetskopi, filnavn, kontroller, lesTekst, oppsummer } from '../backup.js';
import { lagreFil, velgFil } from '../filer.js';
import { dagerMellom, klokkeslett, kortDato, tidspunktTekst } from '../dato.js';
import { sjekkPlattform, testSkjermlas } from '../plattform.js';
import { lagTestdata } from '../dev/testdata.js';
import { APP_VERSJON } from '../versjon.js';
import { skjermTopp } from './felles.js';
import { hentMal, importerElevliste } from './import.js';

// Husker om «Teknisk test og utviklerverktøy» er åpen når skjermen tegnes på nytt.
let tekniskApen = false;

// Valg for varseltidspunkt (K-16): 14.50 til 15.30 hvert 5. minutt.
const VARSELTIDER = ['14:50', '14:55', '15:00', '15:05', '15:10', '15:15', '15:20', '15:25', '15:30'];

export async function visMer(oppfrisk) {
  const [elever, siste, testdata, varsel, sisteImport] = await Promise.all([
    hentAlle('elever'), hentInnstilling('sisteSikkerhetskopi'), hentInnstilling('testdata'), hentInnstilling('varseltidspunkt'),
    hentInnstilling('sisteImport'),
  ]);
  const aktive = elever.filter((e) => e.aktiv !== false).length;

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Mer', visDato: false }),
    seksjonSikkerhetskopi(siste, oppfrisk),
    h('section', { class: 'kort' },
      h('h2', {}, 'Elevliste'),
      h('p', {}, [`${aktive} aktive elever`, testdata ? 'fiktive testdata' : null, sisteImport ? `sist importert ${kortDato(sisteImport)}` : null].filter(Boolean).join(' · ')),
      h('div', { class: 'knappestabel' },
        h('button', { type: 'button', class: 'knapp knapp-omriss', id: 'importer', onclick: () => importerElevliste(oppfrisk) }, 'Importer fra Excel'),
        h('button', { type: 'button', class: 'knapp knapp-lenke', id: 'hent-mal', onclick: () => hentMal() }, 'Hent tom Excel-mal')),
      h('p', { class: 'dempet liten' }, 'Elever som ikke står i fila, blir deaktivert. Historikken deres beholdes.')),
    h('section', { class: 'kort' },
      h('h2', {}, 'Innstillinger'),
      h('div', { class: 'felt-rad' },
        h('label', { for: 'varseltid' }, 'Varsel for uregistrerte barn'),
        h('select', {
          id: 'varseltid',
          onchange: async (e) => {
            await lagreInnstilling('varseltidspunkt', e.target.value);
            visMelding(`Varselet kommer kl. ${klokkeslett(e.target.value)}.`, 'ok');
          },
        }, VARSELTIDER.map((t) => h('option', { value: t, selected: t === varsel }, klokkeslett(t))))),
      h('div', { class: 'felt-rad' },
        h('span', { class: 'dempet' }, 'Rapporter'),
        h('span', { class: 'chip chip-dempet' }, 'Kommer i versjon 2'))),
    seksjonTeknisk(oppfrisk),
    h('p', { class: 'fotnote' }, 'Alle data lagres bare på denne telefonen.'),
    h('p', { class: 'fotnote' }, `Versjon ${APP_VERSJON} · dataversjon ${DATAVERSJON}`),
  );
}

// ---------- Sikkerhetskopi ----------

function sistTekst(siste) {
  if (!siste) return { tekst: 'Det er aldri tatt sikkerhetskopi.', varsel: true };
  const dager = dagerMellom(siste);
  if (dager <= 0) return { tekst: 'Siste sikkerhetskopi: i dag', varsel: false };
  if (dager === 1) return { tekst: 'Siste sikkerhetskopi: i går', varsel: false };
  return { tekst: `Siste sikkerhetskopi: ${dager} dager siden`, varsel: dager > 7 };
}

function seksjonSikkerhetskopi(siste, oppfrisk) {
  const s = sistTekst(siste);
  return h('section', { class: `kort ${s.varsel ? 'kort-varsel' : ''}` },
    h('h2', {}, 'Sikkerhetskopi'),
    h('p', { class: `statuslinje ${s.varsel ? 'varsel' : ''}`, id: 'siste-sikkerhetskopi' }, s.tekst),
    h('div', { class: 'knappestabel' },
      h('button', { type: 'button', class: 'knapp knapp-primar knapp-stor', id: 'eksporter', onclick: () => eksporter(oppfrisk) }, 'Ta sikkerhetskopi nå'),
      h('button', { type: 'button', class: 'knapp', id: 'gjenopprett', onclick: () => gjenopprett(oppfrisk) }, 'Gjenopprett fra fil')),
    h('p', { class: 'dempet liten' }, 'Lagres via delingsarket i SFO-mappen på OneDrive. Ta kopi ved dagsavslutning, eller minst én gang i uka.'));
}

async function eksporter(oppfrisk) {
  try {
    const naa = new Date();
    const kopi = byggSikkerhetskopi(await hentAltInnhold(), { appversjon: APP_VERSJON, naa });
    const navn = filnavn(naa);
    const resultat = await lagreFil(JSON.stringify(kopi), navn);
    if (resultat === 'avbrutt') {
      visMelding('Sikkerhetskopien ble ikke lagret.', 'advarsel');
      return;
    }
    await lagreInnstilling('sisteSikkerhetskopi', naa.toISOString());
    visMelding(resultat === 'delt'
      ? `${navn} er sendt til valgt sted. Sjekk at den ligger i OneDrive-mappen.`
      : `${navn} er lastet ned. Flytt den til SFO-mappen i OneDrive.`, 'ok');
    oppfrisk();
  } catch (e) {
    visMelding(`Sikkerhetskopi feilet: ${e.message}`, 'feil');
  }
}

async function gjenopprett(oppfrisk) {
  const fil = await velgFil();
  if (!fil) return;

  let resultat;
  try {
    resultat = kontroller(lesTekst(fil.tekst));
  } catch (e) {
    resultat = { ok: false, feil: [e.message] };
  }

  if (!resultat.ok) {
    await visDialog({
      tittel: 'Kan ikke gjenopprette',
      innhold: [
        h('p', {}, `Filen «${fil.navn}» kan ikke brukes. Ingenting er endret.`),
        h('ul', {}, resultat.feil.map((f) => h('li', {}, f))),
        resultat.antallFeil > resultat.feil.length ? h('p', { class: 'dempet' }, `… og ${resultat.antallFeil - resultat.feil.length} feil til.`) : null,
      ],
      knapper: [{ tekst: 'Lukk', verdi: 'lukk', type: 'primar' }],
    });
    return;
  }

  const ny = oppsummer(resultat.kopi);
  const naa = { elever: await tell('elever'), hendelser: await tell('hendelser'), tellinger: await tell('tellinger') };
  const svar = await visDialog({
    tittel: 'Gjenopprette fra sikkerhetskopi?',
    innhold: [
      h('p', {}, `Fil: ${fil.navn}`),
      h('table', { class: 'sammenligning' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'I filen'), h('th', {}, 'På telefonen nå'))),
        h('tbody', {},
          h('tr', {}, h('th', {}, 'Elever'), h('td', {}, ny.elever), h('td', {}, naa.elever)),
          h('tr', {}, h('th', {}, 'Hendelser'), h('td', {}, ny.hendelser), h('td', {}, naa.hendelser)),
          h('tr', {}, h('th', {}, 'Tellinger'), h('td', {}, ny.tellinger), h('td', {}, naa.tellinger)))),
      h('p', {}, `Tatt: ${ny.eksportert ? tidspunktTekst(ny.eksportert) : 'ukjent'}`),
      h('p', {}, `Siste registrering i filen: ${ny.sisteDato ?? 'ingen'}`),
      h('p', { class: 'advarsel' }, 'Alt som ligger på telefonen nå, blir erstattet av innholdet i filen.'),
    ],
    knapper: [
      { tekst: 'Avbryt', verdi: 'avbryt' },
      { tekst: 'Erstatt alle data', verdi: 'erstatt', type: 'fare' },
    ],
  });
  if (svar !== 'erstatt') return;

  try {
    await erstattAltInnhold(resultat.kopi.data);
    if (ny.eksportert) await lagreInnstilling('sisteSikkerhetskopi', ny.eksportert);
    visMelding(`Gjenopprettet ${ny.elever} elever og ${ny.hendelser} hendelser.`, 'ok');
    oppfrisk();
  } catch (e) {
    visMelding(`Gjenoppretting feilet, ingenting er endret: ${e.message}`, 'feil');
  }
}

// ---------- Teknisk test og utviklerverktøy (sammenfoldet) ----------

function seksjonTeknisk(oppfrisk) {
  const tall = h('dl', { class: 'tall' }, h('div', {}, h('dt', {}, 'Laster …')));
  Promise.all([tell('elever'), tell('hendelser'), tell('tellinger')]).then(([e, hd, t]) => {
    tall.replaceChildren(
      h('div', {}, h('dt', {}, 'Elever'), h('dd', {}, e)),
      h('div', {}, h('dt', {}, 'Hendelser'), h('dd', {}, hd)),
      h('div', {}, h('dt', {}, 'Tellinger'), h('dd', {}, t)));
  });

  const liste = h('ul', { class: 'sjekkliste', id: 'teknisk-test' }, h('li', { class: 'dempet' }, 'Kjører test …'));
  sjekkPlattform().then((rader) => {
    liste.replaceChildren(...rader.map((r) => h('li', { class: `sjekk sjekk-${r.ok === true ? 'ok' : r.ok === false ? 'feil' : 'info'}` },
      h('span', { class: 'sjekk-navn' }, r.navn),
      h('span', { class: 'sjekk-verdi' }, r.verdi))));
  });

  const detaljer = h('details', { class: 'kort teknisk', id: 'teknisk', open: tekniskApen },
    h('summary', {}, 'Teknisk test og utviklerverktøy'),
    h('div', { class: 'teknisk-innhold' },
      h('p', { class: 'underoverskrift' }, 'Data på denne telefonen'),
      tall,
      h('p', { class: 'underoverskrift' }, 'Teknisk test'),
      h('p', { class: 'dempet liten' }, 'Viser hva denne telefonen støtter. Kjør testen på både testtelefonen og SFO-telefonen (kravspesifikasjonen kapittel 15).'),
      liste,
      h('div', { class: 'knapperad' },
        h('button', { type: 'button', class: 'knapp', onclick: async () => visMelding(await testSkjermlas(30)) }, 'Test skjermlås'),
        h('button', { type: 'button', class: 'knapp', onclick: () => window.print() }, 'Test utskrift/PDF')),
      h('p', { class: 'underoverskrift' }, 'Utviklerverktøy'),
      h('p', { class: 'advarsel' }, 'Brukes bare på testtelefonen. Begge knappene erstatter alle data på telefonen.'),
      h('div', { class: 'knapperad' },
        h('button', { type: 'button', class: 'knapp', id: 'last-testdata', onclick: () => lastTestdata(oppfrisk) }, 'Last inn fiktive testdata'),
        h('button', { type: 'button', class: 'knapp knapp-fare', id: 'slett-alt', onclick: () => slettAlt(oppfrisk) }, 'Slett alle data'))));
  detaljer.addEventListener('toggle', () => { tekniskApen = detaljer.open; });
  return detaljer;
}

async function lastTestdata(oppfrisk) {
  const svar = await visDialog({
    tittel: 'Laste inn fiktive testdata?',
    innhold: [h('p', {}, 'Alle data på telefonen erstattes med 32 fiktive elever og 10 dager med registreringer.')],
    knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Last inn testdata', verdi: 'ja', type: 'fare' }],
  });
  if (svar !== 'ja') return;
  await erstattAltInnhold(lagTestdata());
  visMelding('Fiktive testdata er lastet inn.', 'ok');
  oppfrisk();
}

async function slettAlt(oppfrisk) {
  const svar = await visDialog({
    tittel: 'Slette alle data?',
    innhold: [h('p', {}, 'Alle elever, hendelser og tellinger på telefonen slettes. Dette kan ikke angres uten sikkerhetskopi.')],
    knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Slett alt', verdi: 'ja', type: 'fare' }],
  });
  if (svar !== 'ja') return;
  await slettAltInnhold();
  visMelding('Alle data er slettet.', 'ok');
  oppfrisk();
}
