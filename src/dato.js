// Dato- og tidshjelpere. Datoer lagres som lokal dato 'ÅÅÅÅ-MM-DD' slik at
// «ny dag» (K-10) følger telefonens klokke (norsk tid), ikke UTC.

const to = (n) => String(n).padStart(2, '0');

/** Lokal dato som 'ÅÅÅÅ-MM-DD'. */
export function lokalDato(d = new Date()) {
  return `${d.getFullYear()}-${to(d.getMonth() + 1)}-${to(d.getDate())}`;
}

/** Hele dager mellom to tidspunkt, regnet på lokale datoer. */
export function dagerMellom(fra, til = new Date()) {
  const a = new Date(fra);
  const b = new Date(til);
  const aDag = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDag = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDag - aDag) / 86400000);
}

const UKEDAGER = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/** «mandag 9. november» */
export function datoTekst(d = new Date()) {
  return `${UKEDAGER[d.getDay()]} ${d.getDate()}. ${MANEDER[d.getMonth()]}`;
}

/** «9.11.2026 kl. 14.45» */
export function tidspunktTekst(iso) {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} kl. ${to(d.getHours())}.${to(d.getMinutes())}`;
}

/** Ukedag 1 (mandag) til 7 (søndag). */
export function ukedagNr(d = new Date()) {
  return ((d.getDay() + 6) % 7) + 1;
}
