// Fanen «Mer»: sikkerhetskopi (K-60–K-62), elevliste, innstillinger, teknisk test og utviklerverktøy.
import { h, visDialog, visMelding } from '../dom.js';
import {
  DATAVERSJON, erstattAltInnhold, hentAlle, hentInnstilling, lagreInnstilling, slettAltInnhold, tell,
} from '../db.js';
import { kontroller, lesTekst, oppsummer } from '../backup.js';
import { byttPassord, dekrypterKopi, erKryptert, kontrollerPassord, lagNokkel, MIN_PASSORD } from '../kryptering.js';
import { velgFil } from '../filer.js';
import { dagerMellom, klokkeslett, kortDato, langDato, lokalDato, tidspunktTekst } from '../dato.js';
import { slettegrense } from '../model/sletting.js';
import { lagSlettePlan, utforSletting } from '../sletting.js';
import { sjekkPlattform, testSkjermlas } from '../plattform.js';
import { lagTestdata } from '../dev/testdata.js';
import { APP_VERSJON } from '../versjon.js';
import { skjermTopp } from './felles.js';
import { hentMal, importerElevliste } from './import.js';
import { avsluttAdmin, byttKode, krevAdmin, laas } from './las.js';
import { erAdmin } from '../tilgang.js';
import { skrivUt } from '../filer.js';
import { kopiKnapp } from './sikkerhetskopi.js';

// Husker om «Teknisk test og utviklerverktøy» er åpen når skjermen tegnes på nytt.
let tekniskApen = false;

// Valg for varseltidspunkt (K-16): 14.50 til 15.30 hvert 5. minutt.
const VARSELTIDER = ['14:50', '14:55', '15:00', '15:05', '15:10', '15:15', '15:20', '15:25', '15:30'];

export async function visMer(oppfrisk) {
  const [elever, siste, testdata, varsel, sisteImport, lagringSkoleaar, sisteSletting, kopiNokkel] = await Promise.all([
    hentAlle('elever'), hentInnstilling('sisteSikkerhetskopi'), hentInnstilling('testdata'), hentInnstilling('varseltidspunkt'),
    hentInnstilling('sisteImport'), hentInnstilling('lagringSkoleaar'), hentInnstilling('sisteSletting'), hentInnstilling('kopi-nokkel'),
  ]);
  const aktive = elever.filter((e) => e.aktiv !== false).length;

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Mer', visDato: false }),
    seksjonSikkerhetskopi(siste, !!kopiNokkel, oppfrisk),
    h('section', { class: 'kort' },
      h('h2', {}, 'Elevliste'),
      h('p', {}, [`${aktive} aktive elever`, testdata ? 'fiktive testdata' : null, sisteImport ? `sist importert ${kortDato(sisteImport)}` : null].filter(Boolean).join(' · ')),
      h('div', { class: 'knappestabel' },
        h('button', { type: 'button', class: 'knapp knapp-omriss', id: 'importer', onclick: async () => { if (await krevAdmin('Import av elevliste krever administratorkode.')) importerElevliste(oppfrisk); } }, 'Importer fra Excel'),
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
      historikkInnstilling(lagringSkoleaar, sisteSletting, oppfrisk),
    ),
    seksjonTilgang(!!kopiNokkel, oppfrisk),
    h('section', { class: 'kort' },
      h('h2', {}, 'Rapporter'),
      h('a', { class: 'knapp knapp-omriss knapp-lenkeknapp', href: '#rapport/gruppe', id: 'apne-grupperapport' }, 'Grupperapport'),
      h('a', { class: 'knapp knapp-omriss knapp-lenkeknapp', href: '#rapport/elev', id: 'apne-elevrapport' }, 'Elevrapport'),
      h('a', { class: 'knapp knapp-omriss knapp-lenkeknapp', href: '#rapport/avvik', id: 'apne-avviksrapport' }, 'Avviksrapport'),
      h('p', { class: 'dempet liten' }, 'Grupperapport: tellinger, avvik og fravær for hele SFO. Elevrapport: inn- og utsjekk, fravær og tellinger for ett barn. Avviksrapport: bare det som skal følges opp, med linje for signatur. Velg dag, uke, måned eller egen periode, og skriv ut eller lagre som PDF. Papirliste kommer senere.')),
    seksjonTeknisk(oppfrisk),
    h('p', { class: 'fotnote' }, 'Alle data lagres bare på denne telefonen.'),
    h('p', { class: 'fotnote' }, `Versjon ${APP_VERSJON} · dataversjon ${DATAVERSJON}`),
  );
}

// ---------- Historikk (K-63) ----------

const SKOLEAAR_TEKST = { 2: 'Inneværende og forrige skoleår', 1: 'Bare inneværende skoleår' };

function historikkInnstilling(lagringSkoleaar, sisteSletting, oppfrisk) {
  const grense = slettegrense(lokalDato(), lagringSkoleaar);
  const antall = sisteSletting?.antall;
  const slettetSist = antall ? (antall.hendelser + antall.tellinger + antall.unntak + antall.elever) : 0;
  const velger = h('select', {
    id: 'lagring',
    onchange: async (e) => {
      const ny = Number(e.target.value);
      if (!(await krevAdmin('Endring av lagringstid krever administratorkode.'))) { e.target.value = String(lagringSkoleaar); return; }
      const plan = await lagSlettePlan(slettegrense(lokalDato(), ny));
      if (!plan.tom) {
        const a = plan.antall;
        const svar = await visDialog({
          tittel: 'Slette eldre historikk nå?',
          innhold: [
            h('p', {}, `Alt som er eldre enn ${langDato(plan.grense)} slettes: ${a.hendelser} hendelser, ${a.tellinger} tellinger, ${a.unntak} unntak og ${a.elever} deaktiverte elever.`),
            h('p', { class: 'advarsel' }, 'Dette kan ikke angres. Ta sikkerhetskopi først hvis du er usikker.'),
          ],
          knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Slett og lagre', verdi: 'ja', type: 'fare' }],
        });
        if (svar !== 'ja') { e.target.value = String(lagringSkoleaar); return; }
      }
      await lagreInnstilling('lagringSkoleaar', ny);
      await utforSletting(plan);
      visMelding(plan.tom ? 'Lagringstiden er endret.' : 'Lagringstiden er endret, og eldre historikk er slettet.', 'ok');
      oppfrisk();
    },
  }, [2, 1].map((n) => h('option', { value: n, selected: n === lagringSkoleaar }, SKOLEAAR_TEKST[n])));
  return h('div', { class: 'felt', id: 'historikk-innstilling' },
    h('div', { class: 'felt-rad' }, h('label', { for: 'lagring' }, 'Historikk beholdes'), velger),
    h('p', { class: 'dempet liten', id: 'slettegrense' },
      `Hendelser, tellinger og unntak eldre enn ${langDato(grense)} slettes automatisk, og deaktiverte elever som ikke har nyere registreringer og ble deaktivert før det. Et skoleår starter 1. august.`,
      sisteSletting?.tid ? ` Sist sjekket ${kortDato(sisteSletting.tid)}${slettetSist ? `: ${slettetSist} slettet` : ''}.` : ''));
}

// ---------- Tilgang (K-71–K-73) ----------

function seksjonTilgang(kryptert, oppfrisk) {
  const admin = erAdmin();
  return h('section', { class: 'kort', id: 'tilgang' },
    h('h2', {}, 'Tilgang'),
    h('p', { class: `statuslinje ${admin ? 'varsel' : ''}`, id: 'admin-status' }, admin
      ? 'Administratormodus er på til appen låses.'
      : 'Appen låses hver gang den lukkes, byttes bort fra eller skjermen slås av.'),
    h('div', { class: 'knappestabel' },
      h('button', { type: 'button', class: 'knapp knapp-omriss', id: 'las-naa', onclick: () => laas() }, 'Lås appen nå'),
      admin ? h('button', { type: 'button', class: 'knapp knapp-omriss', id: 'avslutt-admin', onclick: () => { avsluttAdmin(); oppfrisk(); } }, 'Avslutt administratormodus') : null,
      h('button', { type: 'button', class: 'knapp', id: 'bytt-ansattkode', onclick: async () => { await byttKode('ansatt'); oppfrisk(); } }, 'Bytt kode for ansatte'),
      h('button', { type: 'button', class: 'knapp', id: 'bytt-adminkode', onclick: async () => { await byttKode('admin'); oppfrisk(); } }, 'Bytt administratorkode'),
      h('button', { type: 'button', class: 'knapp', id: 'kopi-passord', onclick: async () => { if (await settKopiPassord()) oppfrisk(); } },
        kryptert ? 'Bytt passord for sikkerhetskopier' : 'Sett passord for sikkerhetskopier')),
    h('p', { class: 'dempet liten' }, 'Import av elevliste, endring av elever og gjenoppretting krever administratorkode. Faste avtaler og merknader kan alle ansatte endre.'));
}

// ---------- Sikkerhetskopi ----------

function sistTekst(siste) {
  if (!siste) return { tekst: 'Det er aldri tatt sikkerhetskopi.', varsel: true };
  const dager = dagerMellom(siste);
  if (dager <= 0) return { tekst: 'Siste sikkerhetskopi: i dag', varsel: false };
  if (dager === 1) return { tekst: 'Siste sikkerhetskopi: i går', varsel: false };
  return { tekst: `Siste sikkerhetskopi: ${dager} dager siden`, varsel: dager > 7 };
}

function seksjonSikkerhetskopi(siste, kryptert, oppfrisk) {
  const s = sistTekst(siste);
  return h('section', { class: `kort ${s.varsel ? 'kort-varsel' : ''}` },
    h('h2', {}, 'Sikkerhetskopi'),
    h('p', { class: `statuslinje ${s.varsel ? 'varsel' : ''}`, id: 'siste-sikkerhetskopi' }, s.tekst),
    kryptert
      ? h('p', { class: 'ok-linje', id: 'kopi-kryptert' }, 'Sikkerhetskopiene krypteres med passord.')
      : h('p', { class: 'advarsel', id: 'kopi-kryptert' }, 'Sikkerhetskopiene er ikke kryptert. Administrator setter passord under Tilgang.'),
    h('div', { class: 'knappestabel' },
      kopiKnapp({ etter: oppfrisk }),
      h('button', { type: 'button', class: 'knapp', id: 'gjenopprett', onclick: async () => { if (await krevAdmin('Gjenoppretting fra sikkerhetskopi krever administratorkode.')) gjenopprett(oppfrisk); } }, 'Gjenopprett fra fil')),
    h('p', { class: 'dempet liten' }, 'Lagres via delingsarket i SFO-mappen på OneDrive. Ta kopi ved dagsavslutning, eller minst én gang i uka.'));
}

async function gjenopprett(oppfrisk) {
  const fil = await velgFil();
  if (!fil) return;

  let resultat;
  let filNokkel = null;
  try {
    let obj = lesTekst(fil.tekst);
    if (erKryptert(obj)) {
      const apnet = await apneKryptert(obj, fil.navn);
      if (!apnet) return;
      obj = apnet.kopi;
      filNokkel = apnet.nokkel;
    }
    resultat = kontroller(obj);
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
    // Ny telefon uten passord for sikkerhetskopier: samme passord brukes videre.
    if (filNokkel && !(await hentInnstilling('kopi-nokkel'))) await lagreInnstilling('kopi-nokkel', filNokkel);
    visMelding(`Gjenopprettet ${ny.elever} elever og ${ny.hendelser} hendelser.`, 'ok');
    oppfrisk();
  } catch (e) {
    visMelding(`Gjenoppretting feilet, ingenting er endret: ${e.message}`, 'feil');
  }
}

// ---------- Kryptering av sikkerhetskopier (DPIA T15) ----------

/** Ber om passordet og åpner en kryptert sikkerhetskopi. Returnerer { kopi, nokkel } eller null. */
async function apneKryptert(obj, navn) {
  let feil = '';
  for (;;) {
    const felt = h('input', { id: 'kopi-passord-felt', type: 'password', autocomplete: 'off' });
    const svar = await visDialog({
      tittel: 'Kryptert sikkerhetskopi',
      innhold: [
        h('p', {}, `«${navn}» er kryptert. Skriv passordet for sikkerhetskopier.`),
        h('div', { class: 'felt' }, h('label', { for: 'kopi-passord-felt', class: 'feltnavn' }, 'Passord'), felt),
        feil ? h('p', { class: 'feilboks', role: 'alert' }, feil) : null,
      ],
      knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Åpne', verdi: 'apne', type: 'primar', id: 'kopi-apne' }],
    });
    if (svar !== 'apne') return null;
    try {
      return await dekrypterKopi(obj, felt.value);
    } catch (e) {
      feil = e.message;
    }
  }
}

/** Setter eller bytter passord for sikkerhetskopier (krever administratorkode). */
async function settKopiPassord() {
  if (!(await krevAdmin('Passord for sikkerhetskopier krever administratorkode.'))) return false;
  const finnes = await hentInnstilling('kopi-nokkel');
  let feil = '';
  for (;;) {
    const p1 = h('input', { id: 'nytt-kopi-passord', type: 'password', autocomplete: 'off', minlength: MIN_PASSORD });
    const p2 = h('input', { id: 'gjenta-kopi-passord', type: 'password', autocomplete: 'off', minlength: MIN_PASSORD });
    const svar = await visDialog({
      tittel: finnes ? 'Bytt passord for sikkerhetskopier' : 'Passord for sikkerhetskopier',
      innhold: [
        h('p', {}, `Sikkerhetskopiene krypteres, så ingen kan lese dem uten passordet. Bruk minst ${MIN_PASSORD} tegn, gjerne en setning.`),
        h('p', { class: 'advarsel' }, 'Skriv passordet ned og oppbevar det sammen med administratorkoden. Glemmes passordet, kan sikkerhetskopiene ikke åpnes.'),
        finnes ? h('p', { class: 'dempet liten' }, 'Nye kopier bruker det nye passordet. Eldre kopier åpnes fortsatt med det gamle.') : null,
        h('div', { class: 'felt' }, h('label', { for: 'nytt-kopi-passord', class: 'feltnavn' }, 'Nytt passord'), p1),
        h('div', { class: 'felt' }, h('label', { for: 'gjenta-kopi-passord', class: 'feltnavn' }, 'Gjenta passordet'), p2),
        feil ? h('p', { class: 'feilboks', role: 'alert' }, feil) : null,
      ],
      knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Lagre passord', verdi: 'lagre', type: 'primar', id: 'lagre-kopi-passord' }],
    });
    if (svar !== 'lagre') return false;
    feil = kontrollerPassord(p1.value, p2.value) ?? '';
    if (feil) continue;
    await lagreInnstilling('kopi-nokkel', finnes ? await byttPassord(finnes, p1.value) : await lagNokkel(p1.value));
    visMelding(finnes ? 'Passordet for sikkerhetskopier er byttet.' : 'Sikkerhetskopiene krypteres fra nå av. Ta en ny sikkerhetskopi.', 'ok');
    return true;
  }
}

// ---------- Teknisk test og utviklerverktøy (sammenfoldet) ----------

function seksjonTeknisk(oppfrisk) {
  // Hele delen krever administratorkode (appen er i bruk med ekte elevdata). Uten administratormodus
  // vises bare en knapp, og teknisk test kjøres ikke.
  if (!erAdmin()) {
    return h('section', { class: 'kort', id: 'teknisk-last' },
      h('h2', {}, 'Teknisk test og utviklerverktøy'),
      h('p', { class: 'dempet liten' }, 'Krever administratorkode.'),
      h('button', {
        type: 'button', class: 'knapp', id: 'teknisk-las-opp',
        onclick: async () => {
          if (await krevAdmin('Teknisk test og utviklerverktøy krever administratorkode.')) { tekniskApen = true; oppfrisk(); }
        },
      }, 'Åpne med administratorkode'));
  }
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
        h('button', { type: 'button', class: 'knapp', onclick: () => skrivUt() }, 'Test utskrift/PDF')),
      h('p', { class: 'underoverskrift' }, 'Utviklerverktøy'),
      h('p', { class: 'advarsel' }, 'Brukes bare på testtelefonen. Begge knappene erstatter alle data på telefonen.'),
      h('div', { class: 'knapperad' },
        h('button', { type: 'button', class: 'knapp', id: 'last-testdata', onclick: async () => { if (await krevAdmin('Utviklerverktøy krever administratorkode.')) lastTestdata(oppfrisk); } }, 'Last inn fiktive testdata'),
        h('button', { type: 'button', class: 'knapp knapp-fare', id: 'slett-alt', onclick: async () => { if (await krevAdmin('Utviklerverktøy krever administratorkode.')) slettAlt(oppfrisk); } }, 'Slett alle data'))));
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
