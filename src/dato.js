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

/** «Mandag 9. november» */
export function datoTekst(d = new Date()) {
  const dag = UKEDAGER[d.getDay()];
  return `${dag[0].toUpperCase()}${dag.slice(1)} ${d.getDate()}. ${MANEDER[d.getMonth()]}`;
}

/** «12. august» */
export function kortDato(iso) {
  const d = new Date(iso);
  return `${d.getDate()}. ${MANEDER[d.getMonth()]}`;
}

/** ISO-tidspunkt → «14.47» */
export function klokkeFra(iso) {
  const d = new Date(iso);
  return `${to(d.getHours())}.${to(d.getMinutes())}`;
}

/** ISO-tidspunkt → '14:47' (verdi til <input type="time">) */
export function tidVerdiFra(iso) {
  const d = new Date(iso);
  return `${to(d.getHours())}:${to(d.getMinutes())}`;
}

/** «Kl. 15.12» */
export function klokkeTekst(d = new Date()) {
  return `Kl. ${to(d.getHours())}.${to(d.getMinutes())}`;
}

/** '15:30' → '15.30' (norsk skrivemåte for klokkeslett) */
export function klokkeslett(hhmm) {
  return hhmm ? hhmm.replace(':', '.') : '';
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
