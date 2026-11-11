// Lagre og åpne filer. Appen sender aldri filer over nett; brukeren velger selv
// hvor filen skal (for eksempel OneDrive via delingsarket eller Filer-appen).

import { aapnerSystemvindu } from './tilgang.js';

const MAKS_FIL = 10 * 1024 * 1024;

let delingsfeil = null;
export const sisteDelingsfeil = () => delingsfeil;

/** Åpner utskrift (eller «Lagre som PDF») uten at appen låses mens vinduet er åpent. */
export function skrivUt() {
  aapnerSystemvindu();
  window.print();
}

/**
 * Lagrer en fil.
 * 1. Delingsarket (iPhone: «Arkiver i Filer» → OneDrive. Android: OneDrive-appen) hvis støttet.
 * 2. Ellers vanlig nedlasting (Android: Nedlastinger-mappen). Også når nettleseren nekter å dele
 *    filtypen (Samsung Internet og Chrome på Android med .json).
 * innhold: tekst eller Uint8Array. Returnerer 'delt', 'lastet-ned', 'avbrutt' eller 'trenger-trykk'.
 * 'trenger-trykk': nettleseren avviste delingsarket fordi det ikke kom rett etter et trykk
 * (Safari på iPhone er streng på dette). Da må brukeren trykke én gang til.
 * sisteDelingsfeil() gir navnet på feilen hvis delingsarket ble avvist og fila lastet ned i stedet.
 * NB: Delingsarket åpnes før første await her. Kall derfor lagreFil direkte fra et trykk,
 * med innholdet ferdig laget på forhånd.
 */
export async function lagreFil(innhold, navn, type = 'application/json') {
  const fil = new File([innhold], navn, { type });
  aapnerSystemvindu();
  delingsfeil = null;
  if (navigator.canShare?.({ files: [fil] })) {
    // Var trykket ferskt? Da betyr «ikke tillatt» at nettleseren nekter å dele filtypen, ikke at det
    // gikk for lang tid fra trykket. Et nytt trykk hjelper da ikke, så fila lastes ned i stedet.
    const ferskTrykk = navigator.userActivation?.isActive === true;
    try {
      await navigator.share({ files: [fil], title: navn });
      return 'delt';
    } catch (e) {
      if (e.name === 'AbortError') return 'avbrutt';
      if (e.name === 'NotAllowedError' && !ferskTrykk) return 'trenger-trykk';
      // Deling feilet av annen grunn: last ned i stedet.
      delingsfeil = e.name || 'ukjent feil';
    }
  }
  return lastNed(fil, navn);
}

/** Vanlig nedlasting (Android: Nedlastinger. iPhone: Filer → Nedlastinger). Returnerer 'lastet-ned'. */
export function lastNed(innhold, navn, type = 'application/json') {
  const fil = innhold instanceof File ? innhold : new File([innhold], navn, { type });
  const url = URL.createObjectURL(fil);
  const a = document.createElement('a');
  a.href = url;
  a.download = navn;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'lastet-ned';
}

/**
 * Lar brukeren velge en fil. Returnerer null hvis ingen fil ble valgt.
 * Som tekst: { navn, tekst }. Med binar: true: { navn, data: ArrayBuffer }.
 */
export function velgFil({ accept = '.json,application/json', binar = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const fil = input.files?.[0];
      if (!fil) { resolve(null); return; }
      if (fil.size > MAKS_FIL) { reject(new Error(`Filen «${fil.name}» er for stor.`)); return; }
      resolve(binar ? { navn: fil.name, data: await fil.arrayBuffer() } : { navn: fil.name, tekst: await fil.text() });
    });
    input.addEventListener('cancel', () => resolve(null));
    aapnerSystemvindu();
    input.click();
  });
}
