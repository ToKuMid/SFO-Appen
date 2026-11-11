// Kryptering av sikkerhetskopier (DPIA T15). Ren logikk med Web Crypto og CompressionStream,
// virker uten nett og kan testes med `npm test`.
//
// Ordning:
// - En tilfeldig datanøkkel (AES-GCM 256) ligger på telefonen. Den krypterer hver sikkerhetskopi,
//   så de ansatte slipper å skrive passord når de tar kopi.
// - Datanøkkelen ligger også i hver fil, låst med passordet for sikkerhetskopier (PBKDF2-SHA256,
//   600 000 runder, eget salt). Uten passordet kan ingen lese fila, heller ikke på en annen telefon.
// - Innholdet komprimeres (gzip) før det krypteres.
// Bare format, versjon og tidspunkt står i klartekst i fila.

export const KRYPTERT_FORMAT = 'sfo-appen-sikkerhetskopi-kryptert';
export const KRYPTERT_VERSJON = 1;
export const PASSORD_ITERASJONER = 600000;
export const MIN_PASSORD = 12;

const tilBase64 = (bytes) => {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fraBase64 = (tekst) => Uint8Array.from(atob(tekst), (c) => c.charCodeAt(0));
const tilfeldig = (n) => crypto.getRandomValues(new Uint8Array(n));

async function strom(bytes, transform) {
  const ut = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(ut).arrayBuffer());
}
export const komprimer = (bytes) => strom(bytes, new CompressionStream('gzip'));
export const dekomprimer = (bytes) => strom(bytes, new DecompressionStream('gzip'));

/** Kontrollerer et nytt passord. Returnerer feiltekst eller null. */
export function kontrollerPassord(passord, gjentatt) {
  if (typeof passord !== 'string' || passord.length < MIN_PASSORD) return `Passordet må ha minst ${MIN_PASSORD} tegn. En setning er lett å huske.`;
  if (/^(.)\1+$/.test(passord)) return 'Passordet kan ikke bare være samme tegn.';
  if (gjentatt !== undefined && passord !== gjentatt) return 'Passordene er ikke like.';
  return null;
}

async function laasenokkel(passord, salt, iterasjoner) {
  const grunn = await crypto.subtle.importKey('raw', new TextEncoder().encode(passord), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterasjoner },
    grunn, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const datanokkel = (raa, bruk) => crypto.subtle.importKey('raw', raa, 'AES-GCM', false, bruk);

/**
 * Lager ny datanøkkel låst med passordet. Det som lagres på telefonen: { raa, innpakket, satt }.
 * raa er selve datanøkkelen (base64). innpakket er nøkkelen låst med passordet, og legges i hver fil.
 */
export async function lagNokkel(passord, { iterasjoner = PASSORD_ITERASJONER, naa = new Date() } = {}) {
  const raa = tilfeldig(32);
  return { raa: tilBase64(raa), innpakket: await pakkInn(raa, passord, iterasjoner), satt: naa.toISOString() };
}

/** Låser den samme datanøkkelen med et nytt passord (bytte av passord). */
export async function byttPassord(nokkel, nyttPassord, { iterasjoner = PASSORD_ITERASJONER, naa = new Date() } = {}) {
  return { ...nokkel, innpakket: await pakkInn(fraBase64(nokkel.raa), nyttPassord, iterasjoner), satt: naa.toISOString() };
}

async function pakkInn(raa, passord, iterasjoner) {
  const salt = tilfeldig(16);
  const iv = tilfeldig(12);
  const laas = await laasenokkel(passord, salt, iterasjoner);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, laas, raa);
  return { salt: tilBase64(salt), iv: tilBase64(iv), iterasjoner, data: tilBase64(data) };
}

/** Låser opp datanøkkelen med passordet. Kaster «Feil passord» hvis passordet er feil. */
export async function pakkUt(innpakket, passord) {
  const laas = await laasenokkel(passord, fraBase64(innpakket.salt), innpakket.iterasjoner);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fraBase64(innpakket.iv) }, laas, fraBase64(innpakket.data)));
  } catch {
    throw new Error('Feil passord.');
  }
}

/** Krypterer sikkerhetskopien (objekt) med datanøkkelen. Returnerer fila som tekst (JSON). */
export async function krypterKopi(kopi, nokkel) {
  const iv = tilfeldig(12);
  const klar = await komprimer(new TextEncoder().encode(JSON.stringify(kopi)));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await datanokkel(fraBase64(nokkel.raa), ['encrypt']), klar);
  return JSON.stringify({
    format: KRYPTERT_FORMAT,
    versjon: KRYPTERT_VERSJON,
    eksportert: kopi.eksportert ?? null,
    appversjon: kopi.appversjon ?? null,
    nokkel: nokkel.innpakket,
    iv: tilBase64(iv),
    data: tilBase64(data),
  });
}

export const erKryptert = (obj) => obj?.format === KRYPTERT_FORMAT;

/**
 * Dekrypterer en kryptert fil med passordet. Returnerer { kopi, nokkel } der nokkel kan tas i bruk
 * på en ny telefon (samme passord videre).
 */
export async function dekrypterKopi(fil, passord) {
  if (!erKryptert(fil)) throw new Error('Fila er ikke en kryptert sikkerhetskopi.');
  if (fil.versjon > KRYPTERT_VERSJON) throw new Error('Fila er kryptert med en nyere versjon av appen. Oppdater appen først.');
  const raa = await pakkUt(fil.nokkel, passord);
  let klar;
  try {
    klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fraBase64(fil.iv) }, await datanokkel(raa, ['decrypt']), fraBase64(fil.data));
  } catch {
    throw new Error('Fila er skadet og kan ikke leses.');
  }
  const kopi = JSON.parse(new TextDecoder().decode(await dekomprimer(new Uint8Array(klar))));
  return { kopi, nokkel: { raa: tilBase64(raa), innpakket: fil.nokkel, satt: new Date().toISOString() } };
}
