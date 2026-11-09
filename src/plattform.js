// Teknisk test av telefonen (kravspesifikasjonen kapittel 15).
// Viser hva nettleseren støtter, slik at samme test kan kjøres på Android og iPhone.

/** Returnerer en liste med { navn, verdi, ok } der ok er true, false eller null (ukjent/info). */
export async function sjekkPlattform() {
  const r = [];

  const installert = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  r.push({ navn: 'Startet fra hjemskjermen', verdi: installert ? 'Ja' : 'Nei, åpnet i nettleseren', ok: installert });

  const sw = 'serviceWorker' in navigator;
  const aktiv = sw && !!navigator.serviceWorker.controller;
  r.push({
    navn: 'Virker uten nett (service worker)',
    verdi: !sw ? 'Ikke støttet' : aktiv ? 'Aktiv' : 'Ikke aktiv ennå. Last siden på nytt.',
    ok: aktiv,
  });

  if (navigator.storage?.persisted) {
    const vedvarende = await navigator.storage.persisted();
    r.push({ navn: 'Vedvarende lagring', verdi: vedvarende ? 'Ja' : 'Nei', ok: vedvarende });
  } else {
    r.push({ navn: 'Vedvarende lagring', verdi: 'Ikke støttet', ok: false });
  }

  if (navigator.storage?.estimate) {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    r.push({ navn: 'Lagring brukt', verdi: `${mb(usage)} av ${mb(quota)}`, ok: null });
  }

  const testfil = new File(['{}'], 'test.json', { type: 'application/json' });
  const deling = !!navigator.canShare?.({ files: [testfil] });
  r.push({
    navn: 'Lagre sikkerhetskopi via delingsark',
    verdi: deling ? 'Ja' : 'Nei, bruker nedlasting i stedet',
    ok: deling ? true : null,
  });

  r.push({ navn: 'Holde skjermen på (Wake Lock)', verdi: 'wakeLock' in navigator ? 'Støttet' : 'Ikke støttet', ok: 'wakeLock' in navigator });

  r.push(await sjekkNettverkBlokkert());

  r.push({ navn: 'Nettleser', verdi: navigator.userAgent, ok: null });
  return r;
}

/** IF-02: prøver å hente en fil. Sikkerhetsregelen skal stoppe forsøket. */
export async function sjekkNettverkBlokkert() {
  const navn = 'Nettverkstrafikk blokkert (IF-02)';
  try {
    await fetch(`./manifest.webmanifest?nettverkstest=${Date.now()}`, { cache: 'no-store' });
    return { navn, verdi: 'NEI – appen kunne sende en forespørsel', ok: false };
  } catch {
    return { navn, verdi: 'Ja', ok: true };
  }
}

/** Holder skjermen på i et antall sekunder. Returnerer en tekst om resultatet. */
export async function testSkjermlas(sekunder = 30) {
  if (!('wakeLock' in navigator)) return 'Wake Lock støttes ikke i denne nettleseren.';
  try {
    const las = await navigator.wakeLock.request('screen');
    setTimeout(() => las.release(), sekunder * 1000);
    return `Skjermen holdes på i ${sekunder} sekunder. Sjekk at den ikke slukner.`;
  } catch (e) {
    return `Wake Lock feilet: ${e.message}`;
  }
}

function mb(bytes) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(1)} MB`;
}
