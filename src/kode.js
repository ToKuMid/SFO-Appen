// Koder for å åpne appen (ansattkode, 4 siffer) og for administrator (6 siffer).
// Ren logikk uten DOM, slik at den kan testes med `npm test`.
//
// Kodene lagres aldri i klartekst, bare som PBKDF2-hash med tilfeldig salt (Web Crypto, virker uten nett).
// NB: Koden beskytter mot at noen åpner appen på en ulåst telefon. Den krypterer ikke dataene.

export const ANSATT_LENGDE = 4;
export const ADMIN_LENGDE = 6;
export const ITERASJONER = 100000;

// Innstillinger som hører til tilgang og til denne telefonen. De tas ikke med i sikkerhetskopien,
// og beholdes ved gjenoppretting, testdata og «slett alle data».
export const KODE_NOKLER = ['kode-ansatt', 'kode-admin', 'kode-feil-ansatt', 'kode-feil-admin', 'sisteInitialer', 'kopi-nokkel'];
export const erKodeNokkel = (nokkel) => KODE_NOKLER.includes(nokkel);

const tilBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fraBase64 = (tekst) => Uint8Array.from(atob(tekst), (c) => c.charCodeAt(0));

async function avled(kode, salt, iterasjoner) {
  const nokkel = await crypto.subtle.importKey('raw', new TextEncoder().encode(kode), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterasjoner }, nokkel, 256);
}

/** Lager det som lagres for en kode: { salt, hash, iterasjoner, satt }. */
export async function lagKode(kode, naa = new Date()) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await avled(kode, salt, ITERASJONER);
  return { salt: tilBase64(salt), hash: tilBase64(hash), iterasjoner: ITERASJONER, satt: naa.toISOString() };
}

/** Sjekker en kode mot det som er lagret. */
export async function sjekkKode(kode, lagret) {
  if (!lagret?.salt || !lagret?.hash) return false;
  const hash = new Uint8Array(await avled(kode, fraBase64(lagret.salt), lagret.iterasjoner ?? ITERASJONER));
  const fasit = fraBase64(lagret.hash);
  if (hash.length !== fasit.length) return false;
  let ulik = 0;
  for (let i = 0; i < hash.length; i++) ulik |= hash[i] ^ fasit[i];
  return ulik === 0;
}

/**
 * Kontrollerer en ny kode. Returnerer feiltekst, eller null hvis koden kan brukes.
 * Avviser like sifre (0000) og rekker (1234, 4321), fordi de gjettes først.
 */
export function kontrollerNyKode(kode, lengde) {
  if (!new RegExp(`^\\d{${lengde}}$`).test(kode)) return `Koden må ha ${lengde} siffer.`;
  const s = [...kode].map(Number);
  if (s.every((x) => x === s[0])) return 'Velg en kode som ikke bare har like siffer.';
  const opp = s.every((x, i) => i === 0 || x === (s[i - 1] + 1) % 10);
  const ned = s.every((x, i) => i === 0 || x === (s[i - 1] + 9) % 10);
  if (opp || ned) return 'Velg en kode som ikke er en rekke, som 1234.';
  return null;
}

/**
 * Ventetid etter feil kode. De fem første forsøkene er frie. Deretter 30 sekunder,
 * og dobbelt så lenge for hver nye feil, høyst 15 minutter.
 * feil: { antall, sist } (sist = ISO-tid). Returnerer millisekunder som gjenstår.
 */
export const FRIE_FORSOK = 5;
export function gjenstaendeVent(feil, naa = Date.now()) {
  if (!feil || feil.antall < FRIE_FORSOK) return 0;
  const vent = Math.min(30000 * 2 ** (feil.antall - FRIE_FORSOK), 15 * 60000);
  return Math.max(0, new Date(feil.sist).getTime() + vent - naa);
}

/**
 * Initialer for den som bruker appen (K-18). 2–4 bokstaver, lagres med store bokstaver.
 * Returnerer { verdi } eller { feil }.
 */
export function kontrollerInitialer(tekst) {
  const verdi = String(tekst ?? '').trim().toLocaleUpperCase('nb').replace(/[\s.]/g, '');
  if (!/^[A-ZÆØÅ]{2,4}$/u.test(verdi)) return { feil: 'Skriv initialene dine med 2–4 bokstaver.' };
  return { verdi };
}

/**
 * Initialene følger telefonen (K-18): koden låser opp med initialene fra sist, til noen trykker «Bytt».
 * Appen spør likevel på nytt ved ny dag, og når appen ikke er brukt på en stund.
 */
export const INITIALER_GYLDIG_MIN = 30;

/** Normaliserer lagrede initialer. Eldre versjoner lagret bare teksten. */
export function lesLagredeInitialer(lagret) {
  if (!lagret) return null;
  if (typeof lagret === 'string') return { verdi: lagret, tid: null };
  return lagret.verdi ? { verdi: lagret.verdi, tid: lagret.tid ?? null } : null;
}

/** Må appen spørre etter initialer etter koden? */
export function maaSporeInitialer(lagret, { bytt = false, naa = new Date() } = {}) {
  const l = lesLagredeInitialer(lagret);
  if (bytt || !l || !l.tid) return true;
  const sist = new Date(l.tid);
  if (sist.toDateString() !== naa.toDateString()) return true;
  return naa - sist > INITIALER_GYLDIG_MIN * 60000;
}
