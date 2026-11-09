// Dagens registreringer: henter dagens data og lagrer handlinger som hendelser.
// Etter hver endring sendes hendelsen «sfo:endret», slik at skjermen tegnes på nytt.
import { hentAlle, hentEtterIndeks, hentInnstilling, lagre, nyId, utforEndringer } from './db.js';
import { lokalDato } from './dato.js';
import { hentSesjonInitialer } from './tilgang.js';
import { dagsoversikt, lagHendelse, tidspunkt } from './model/status.js';

export function varsleEndring() {
  window.dispatchEvent(new CustomEvent('sfo:endret'));
}

/** Alt som trengs for dagens skjermer. */
export async function hentDag(naa = new Date()) {
  const dato = lokalDato(naa);
  const [elever, avtaler, hendelser, unntak, varseltid] = await Promise.all([
    hentAlle('elever'), hentAlle('avtaler'),
    hentEtterIndeks('hendelser', 'dato', dato), hentEtterIndeks('unntak', 'dato', dato),
    hentInnstilling('varseltidspunkt'),
  ]);
  const avtaleFor = new Map(avtaler.map((a) => [a.elevId, a]));
  const oversikt = dagsoversikt({ elever, hendelser, unntak, dato, naa, varseltid });
  return { dato, naa, elever, avtaleFor, hendelser, unntak, varseltid, ...oversikt };
}

// ---------- Initialer (K-18) ----------
// Initialene skrives hver gang appen låses opp, rett etter koden. Alle registreringer og endringer
// får initialene til den som låste opp, til appen låses igjen.

export async function hentInitialer() {
  const verdi = hentSesjonInitialer();
  if (!verdi) throw new Error('Initialer mangler. Lås appen og lås opp på nytt.');
  return verdi;
}

// ---------- Handlinger ----------

/** Registrerer inn, ut, meldt-fravaer eller ikke-mott. Returnerer hendelsen. */
export async function registrer(elevId, type) {
  const h = lagHendelse({ id: nyId(), elevId, type, initialer: await hentInitialer() });
  await lagre('hendelser', h);
  varsleEndring();
  return h;
}

/** Sjekker inn et barn som ikke har SFO i dag: lagrer ekstra dag (K-19) og inn-hendelse samlet. */
export async function ekstraDagOgInn(elevId) {
  const naa = new Date();
  const initialer = await hentInitialer();
  const h = lagHendelse({ id: nyId(), elevId, type: 'inn', naa, initialer });
  await utforEndringer({ lagre: { unntak: [{ id: nyId(), elevId, dato: lokalDato(naa), type: 'ekstra-dag', initialer }], hendelser: [h] } });
  varsleEndring();
  return h;
}

/** Angrer en hendelse (K-15). Den gamle hendelsen blir stående i historikken. */
export async function angre(hendelse) {
  const h = lagHendelse({ id: nyId(), elevId: hendelse.elevId, type: 'angret', erstatter: hendelse.id, initialer: await hentInitialer() });
  await lagre('hendelser', h);
  varsleEndring();
}

/** Retter tidspunktet for en hendelse (K-15). hhmm = 'HH:MM' samme dag. */
export async function rettTidspunkt(hendelse, hhmm) {
  const naa = tidspunkt(hendelse.dato, hhmm);
  const h = lagHendelse({ id: nyId(), elevId: hendelse.elevId, type: hendelse.type, naa, erstatter: hendelse.id, initialer: await hentInitialer() });
  await lagre('hendelser', h);
  varsleEndring();
}

/** Setter eller fjerner unntak for i dag (K-19). type: 'ikke-sfo' | 'ekstra-dag' | null */
export async function settUnntakIDag(elevId, type) {
  const dato = lokalDato();
  const eksisterende = (await hentEtterIndeks('unntak', 'elevDato', [elevId, dato]));
  await utforEndringer({
    slett: { unntak: eksisterende.map((u) => u.id) },
    lagre: type ? { unntak: [{ id: nyId(), elevId, dato, type, initialer: await hentInitialer() }] } : {},
  });
  varsleEndring();
}
