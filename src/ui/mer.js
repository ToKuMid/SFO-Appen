// Fanen «Mer»: sikkerhetskopi (K-60–K-62), teknisk test og utviklerverktøy.
import { h, visDialog, visMelding } from '../dom.js';
import {
  DATAVERSJON, erstattAltInnhold, hentAltInnhold, hentInnstilling, lagreInnstilling, slettAltInnhold, tell,
} from '../db.js';
import { byggSikkerhetskopi, filnavn, kontroller, lesTekst, oppsummer } from '../backup.js';
import { lagreFil, velgFil } from '../filer.js';
import { dagerMellom, tidspunktTekst } from '../dato.js';
import { sjekkPlattform, testSkjermlas } from '../plattform.js';
import { lagTestdata } from '../dev/testdata.js';
import { APP_VERSJON } from '../versjon.js';

export async function visMer(oppfrisk) {
  const [elever, hendelser, tellinger, siste, testdata] = await Promise.all([
    tell('elever'), tell('hendelser'), tell('tellinger'),
    hentInnstilling('sisteSikkerhetskopi'), hentInnstilling('testdata'),
  ]);

  return h('div', { class: 'stabel' },
    seksjonSikkerhetskopi(siste, oppfrisk),
    h('section', { class: 'kort' },
      h('h2', {}, 'Data på denne telefonen'),
      testdata ? h('p', { class: 'merknad' }, 'Telefonen inneholder fiktive testdata.') : null,
      h('dl', { class: 'tall' },
        h('div', {}, h('dt', {}, 'Elever'), h('dd', {}, elever)),
        h('div', {}, h('dt', {}, 'Hendelser'), h('dd', {}, hendelser)),
        h('div', {}, h('dt', {}, 'Tellinger'), h('dd', {}, tellinger)))),
    seksjonTekniskTest(),
    seksjonUtvikler(oppfrisk),
    h('section', { class: 'kort' },
      h('h2', {}, 'Om appen'),
      h('p', {}, `Versjon ${APP_VERSJON} · dataversjon ${DATAVERSJON}`),
      h('p', { class: 'dempet' }, 'Alle data lagres bare på denne telefonen. Appen sender ingen data over nett.')),
  );
}

// ---------- Sikkerhetskopi ----------

function sistTekst(siste) {
  if (!siste) return { tekst: 'Det er aldri tatt sikkerhetskopi.', varsel: true };
  const dager = dagerMellom(siste);
  if (dager <= 0) return { tekst: 'Siste sikkerhetskopi: i dag.', varsel: false };
  if (dager === 1) return { tekst: 'Siste sikkerhetskopi: i går.', varsel: false };
  return { tekst: `Siste sikkerhetskopi: ${dager} dager siden.`, varsel: dager > 7 };
}

function seksjonSikkerhetskopi(siste, oppfrisk) {
  const s = sistTekst(siste);
  return h('section', { class: 'kort' },
    h('h2', {}, 'Sikkerhetskopi'),
    h('p', { class: s.varsel ? 'advarsel' : '', id: 'siste-sikkerhetskopi' }, s.tekst),
    h('p', { class: 'dempet' }, 'Lagre kopien i SFO-mappen i skolens OneDrive. Ta kopi ved dagsavslutning, eller minst én gang i uka.'),
    h('div', { class: 'knapperad' },
      h('button', { type: 'button', class: 'knapp knapp-primar', id: 'eksporter', onclick: () => eksporter(oppfrisk) }, 'Ta sikkerhetskopi'),
      h('button', { type: 'button', class: 'knapp', id: 'gjenopprett', onclick: () => gjenopprett(oppfrisk) }, 'Gjenopprett fra fil')));
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
  const naa = { elever: await tell('elever'), hendelser: await tell('hendelser') };
  const svar = await visDialog({
    tittel: 'Gjenopprette fra sikkerhetskopi?',
    innhold: [
      h('p', {}, `Fil: ${fil.navn}`),
      h('table', { class: 'sammenligning' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'I filen'), h('th', {}, 'På telefonen nå'))),
        h('tbody', {},
          h('tr', {}, h('th', {}, 'Elever'), h('td', {}, ny.elever), h('td', {}, naa.elever)),
          h('tr', {}, h('th', {}, 'Hendelser'), h('td', {}, ny.hendelser), h('td', {}, naa.hendelser)),
          h('tr', {}, h('th', {}, 'Tellinger'), h('td', {}, ny.tellinger), h('td', {}, '')))),
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

// ---------- Teknisk test ----------

function seksjonTekniskTest() {
  const liste = h('ul', { class: 'sjekkliste', id: 'teknisk-test' }, h('li', { class: 'dempet' }, 'Kjører test …'));
  sjekkPlattform().then((rader) => {
    liste.replaceChildren(...rader.map((r) => h('li', { class: `sjekk sjekk-${r.ok === true ? 'ok' : r.ok === false ? 'feil' : 'info'}` },
      h('span', { class: 'sjekk-navn' }, r.navn),
      h('span', { class: 'sjekk-verdi' }, r.verdi))));
  });
  return h('section', { class: 'kort' },
    h('h2', {}, 'Teknisk test'),
    h('p', { class: 'dempet' }, 'Viser hva denne telefonen støtter. Kjør testen på både testtelefonen og SFO-telefonen (kravspesifikasjonen kapittel 15).'),
    liste,
    h('div', { class: 'knapperad' },
      h('button', { type: 'button', class: 'knapp', onclick: async () => visMelding(await testSkjermlas(30)) }, 'Test skjermlås'),
      h('button', { type: 'button', class: 'knapp', onclick: () => window.print() }, 'Test utskrift/PDF')));
}

// ---------- Utviklerverktøy ----------

function seksjonUtvikler(oppfrisk) {
  return h('details', { class: 'kort utvikler' },
    h('summary', {}, 'Utviklerverktøy (bare for test)'),
    h('p', { class: 'advarsel' }, 'Brukes bare på testtelefonen. Begge knappene erstatter alle data på telefonen.'),
    h('div', { class: 'knapperad' },
      h('button', {
        type: 'button', class: 'knapp', id: 'last-testdata',
        onclick: async () => {
          const svar = await visDialog({
            tittel: 'Laste inn fiktive testdata?',
            innhold: [h('p', {}, 'Alle data på telefonen erstattes med 32 fiktive elever og 10 dager med registreringer.')],
            knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Last inn testdata', verdi: 'ja', type: 'fare' }],
          });
          if (svar !== 'ja') return;
          await erstattAltInnhold(lagTestdata());
          visMelding('Fiktive testdata er lastet inn.', 'ok');
          oppfrisk();
        },
      }, 'Last inn fiktive testdata'),
      h('button', {
        type: 'button', class: 'knapp knapp-fare', id: 'slett-alt',
        onclick: async () => {
          const svar = await visDialog({
            tittel: 'Slette alle data?',
            innhold: [h('p', {}, 'Alle elever, hendelser og tellinger på telefonen slettes. Dette kan ikke angres uten sikkerhetskopi.')],
            knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Slett alt', verdi: 'ja', type: 'fare' }],
          });
          if (svar !== 'ja') return;
          await slettAltInnhold();
          visMelding('Alle data er slettet.', 'ok');
          oppfrisk();
        },
      }, 'Slett alle data')));
}
