// Lagre og åpne filer. Appen sender aldri filer over nett; brukeren velger selv
// hvor filen skal (for eksempel OneDrive via delingsarket eller Filer-appen).

/**
 * Lagrer en fil.
 * 1. Delingsarket (iPhone: «Arkiver i Filer» → OneDrive. Android: OneDrive-appen) hvis støttet.
 * 2. Ellers vanlig nedlasting (Android: Nedlastinger-mappen).
 * Returnerer 'delt', 'lastet-ned' eller 'avbrutt'.
 */
export async function lagreFil(tekst, navn, type = 'application/json') {
  const fil = new File([tekst], navn, { type });
  if (navigator.canShare?.({ files: [fil] })) {
    try {
      await navigator.share({ files: [fil], title: navn });
      return 'delt';
    } catch (e) {
      if (e.name === 'AbortError') return 'avbrutt';
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

/** Lar brukeren velge en fil og returnerer { navn, tekst }, eller null hvis ingen fil ble valgt. */
export function velgFil(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const fil = input.files?.[0];
      resolve(fil ? { navn: fil.name, tekst: await fil.text() } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
