// Lagre og åpne filer. Appen sender aldri filer over nett; brukeren velger selv
// hvor filen skal (for eksempel OneDrive via delingsarket eller Filer-appen).

import { aapnerSystemvindu } from './tilgang.js';

const MAKS_FIL = 10 * 1024 * 1024;

/** Åpner utskrift (eller «Lagre som PDF») uten at appen låses mens vinduet er åpent. */
export function skrivUt() {
  aapnerSystemvindu();
  window.print();
}

/**
 * Lagrer en fil.
 * 1. Delingsarket (iPhone: «Arkiver i Filer» → OneDrive. Android: OneDrive-appen) hvis støttet.
 * 2. Ellers vanlig nedlasting (Android: Nedlastinger-mappen).
 * innhold: tekst eller Uint8Array. Returnerer 'delt', 'lastet-ned', 'avbrutt' eller 'trenger-trykk'.
 * 'trenger-trykk': nettleseren avviste delingsarket fordi det ikke kom rett etter et trykk
 * (Safari på iPhone er streng på dette). Da må brukeren trykke én gang til.
 * NB: Delingsarket åpnes før første await her. Kall derfor lagreFil direkte fra et trykk,
 * med innholdet ferdig laget på forhånd.
 */
export async function lagreFil(innhold, navn, type = 'application/json') {
  const fil = new File([innhold], navn, { type });
  aapnerSystemvindu();
  if (navigator.canShare?.({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil], title: navn });
      return 'delt';
    } catch (e) {
      if (e.name === 'AbortError') return 'avbrutt';
      if (e.name === 'NotAllowedError') return 'trenger-trykk';
      // Deling feilet av annen grunn: prøv nedlasting i stedet.
    }
  }
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
