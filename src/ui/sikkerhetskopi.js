// Sikkerhetskopi fra Mer og fra «Avslutt dagen» (K-20, K-60, K-62).
// Fila lages FØR trykket, slik at delingsarket kan åpnes med en gang brukeren trykker. Safari på
// iPhone avviser delingsarket hvis det går tid mellom trykket og åpningen. Skjer det likevel, får
// brukeren en knapp til å trykke på (fila er da klar).
import { h, visDialog, visMelding } from '../dom.js';
import { hentAltInnhold, hentInnstilling, lagreInnstilling } from '../db.js';
import { krypterKopi } from '../kryptering.js';
import { byggSikkerhetskopi, filnavn } from '../backup.js';
import { lagreFil } from '../filer.js';
import { klokkeFra } from '../dato.js';
import { APP_VERSJON } from '../versjon.js';

/**
 * Lager sikkerhetskopien som tekst. Er passord for sikkerhetskopier satt, krypteres den (DPIA T15).
 */
export async function lagKopi(naa = new Date()) {
  const [data, nokkel] = await Promise.all([hentAltInnhold(), hentInnstilling('kopi-nokkel')]);
  const kopi = byggSikkerhetskopi(data, { appversjon: APP_VERSJON, naa });
  const tekst = nokkel ? await krypterKopi(kopi, nokkel) : JSON.stringify(kopi);
  return { tekst, navn: filnavn(naa), naa, kryptert: !!nokkel };
}

/**
 * Lagrer en ferdig laget fil. Må kalles direkte fra et trykk. Avviser nettleseren delingsarket,
 * vises en dialog med en knapp som prøver igjen i et nytt trykk.
 * Returnerer 'delt', 'lastet-ned' eller 'avbrutt'.
 */
export function lagreFilMedTrykk(innhold, navn, type) {
  return lagreFil(innhold, navn, type).then((resultat) => {
    if (resultat !== 'trenger-trykk') return resultat;
    let nyttForsok = null;
    return visDialog({
      tittel: 'Fila er klar',
      innhold: [h('p', {}, `Trykk «Lagre» for å lagre ${navn}.`)],
      knapper: [
        { tekst: 'Avbryt', verdi: 'avbryt' },
        { tekst: 'Lagre', verdi: 'lagre', type: 'primar', id: 'lagre-igjen', vedTrykk: () => { nyttForsok = lagreFil(innhold, navn, type); } },
      ],
    }).then((svar) => (svar === 'lagre' && nyttForsok ? nyttForsok : 'avbrutt'))
      .then((r) => (r === 'trenger-trykk' ? 'avbrutt' : r));
  });
}

/**
 * Deler en ferdig sikkerhetskopi og husker tidspunktet (K-62). Må kalles direkte fra et trykk.
 * Returnerer true hvis kopien ble delt eller lastet ned.
 */
export function delKopi(kopi, { forTekst = '' } = {}) {
  return lagreFilMedTrykk(kopi.tekst, kopi.navn, 'application/json').then(async (resultat) => {
    if (resultat === 'avbrutt') {
      visMelding('Sikkerhetskopien ble ikke lagret.', 'advarsel');
      return false;
    }
    await lagreInnstilling('sisteSikkerhetskopi', kopi.naa.toISOString());
    visMelding(forTekst + (resultat === 'delt'
      ? `✓ Sikkerhetskopi kl. ${klokkeFra(kopi.naa.toISOString())}: ${kopi.navn}. Sjekk at den ligger i SFO-mappen i OneDrive.`
      : `✓ ${kopi.navn} er lastet ned. Flytt den til SFO-mappen i OneDrive.`), 'ok');
    return true;
  }).catch((e) => {
    visMelding(`Sikkerhetskopi feilet: ${e.message}`, 'feil');
    return false;
  });
}

/**
 * Knapp for sikkerhetskopi som lager fila i bakgrunnen med en gang knappen vises.
 * Trykkes det før fila er klar, venter knappen og lar brukeren trykke en gang til.
 */
export function kopiKnapp({ tekst = 'Ta sikkerhetskopi nå', id = 'eksporter', klasse = 'knapp knapp-primar knapp-stor', etter = () => {} } = {}) {
  let klar = null;
  const lofte = lagKopi().then((k) => { klar = k; }).catch(() => {});
  return h('button', {
    type: 'button', class: klasse, id,
    onclick: async () => {
      if (klar) { if (await delKopi(klar)) etter(); return; }
      await lofte;
      if (!klar) { visMelding('Sikkerhetskopien kunne ikke lages.', 'feil'); return; }
      // Fila ble klar etter trykket: delingsarket må få et nytt trykk.
      const svar = await visDialog({
        tittel: 'Sikkerhetskopien er klar',
        innhold: [h('p', {}, `Trykk «Lagre» for å lagre ${klar.navn}.`)],
        knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Lagre', verdi: 'lagre', type: 'primar', id: 'lagre-kopi', vedTrykk: () => { klar.lagring = delKopi(klar); } }],
      });
      if (svar === 'lagre' && klar.lagring && await klar.lagring) etter();
    },
  }, tekst);
}
