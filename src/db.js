// Lokal database (IndexedDB) for SFO-appen. Alle data ligger bare på telefonen.
//
// Datamodellen følger kravspesifikasjonen kapittel 6. Hver handling lagres som en hendelse;
// dagens status regnes ut fra hendelsene og lagres ikke som eget felt.
//
// DATAVERSJON styrer formatet på data og sikkerhetskopier. Ved endringer i datamodellen:
//   1. øk DATAVERSJON og DB_VERSJON
//   2. legg til et steg i OPPGRADERINGER under (endrer aldri eller sletter eksisterende data, IF-09)
//   3. legg til tilsvarende migrering for sikkerhetskopier i backup.js

export const DB_NAVN = 'sfo-appen';
export const DB_VERSJON = 1;
export const DATAVERSJON = 1;

/**
 * Tabellene i databasen. `nokkel` er feltet som identifiserer en rad.
 *
 * elever          { id, fornavn, etternavn, trinn (1–4), skolegruppe, ukedager [1–5], aktiv }
 * avtaler         { elevId, gaarHjemAleneFra ('HH:MM'|null), fastHentetid ('HH:MM'|null), fritekst }
 * unntak          { id, elevId, dato ('ÅÅÅÅ-MM-DD'), type ('ekstra-dag'|'ikke-sfo') }
 * hendelser       { id, elevId, dato, tid (ISO), type ('inn'|'ut'|'meldt-fravaer'|'ikke-mott'|'angret'), initialer, erstatter }
 * tellinger       { id, dato, tid, antallForventet, antallTalt, initialer, kommentar }
 * tellingslinjer  { id, tellingId, elevId, talt (true/false) }
 * innstillinger   { nokkel, verdi }
 */
export const TABELLER = {
  elever: { nokkel: 'id', indekser: [] },
  avtaler: { nokkel: 'elevId', indekser: [] },
  unntak: { nokkel: 'id', indekser: [['dato', 'dato'], ['elevDato', ['elevId', 'dato']]] },
  hendelser: { nokkel: 'id', indekser: [['dato', 'dato'], ['elevDato', ['elevId', 'dato']]] },
  tellinger: { nokkel: 'id', indekser: [['dato', 'dato']] },
  tellingslinjer: { nokkel: 'id', indekser: [['tellingId', 'tellingId']] },
  innstillinger: { nokkel: 'nokkel', indekser: [] },
};

export const TABELLNAVN = Object.keys(TABELLER);

export const STANDARD_INNSTILLINGER = {
  varseltidspunkt: '15:00',
};

// Ett steg per databaseversjon. Steg N kjøres når databasen oppgraderes fra versjon N-1 til N.
const OPPGRADERINGER = {
  1(db) {
    for (const [navn, def] of Object.entries(TABELLER)) {
      const store = db.createObjectStore(navn, { keyPath: def.nokkel });
      for (const [indeks, felt] of def.indekser) store.createIndex(indeks, felt);
    }
  },
};

let dbLofte = null;

/** Åpner databasen (og oppretter eller oppgraderer den ved behov). */
export function apneDb() {
  if (dbLofte) return dbLofte;
  dbLofte = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAVN, DB_VERSJON);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion + 1; v <= DB_VERSJON; v++) OPPGRADERINGER[v](db, req.transaction);
    };
    req.onsuccess = () => {
      const db = req.result;
      // En nyere fane/versjon vil oppgradere: lukk, så den ikke blokkeres.
      db.onversionchange = () => { db.close(); dbLofte = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Databasen er i bruk i en annen fane. Lukk andre faner med appen.'));
  });
  return dbLofte;
}

function somLofte(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function ferdig(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaksjonen ble avbrutt'));
  });
}

export async function hentAlle(tabell) {
  const db = await apneDb();
  return somLofte(db.transaction(tabell).objectStore(tabell).getAll());
}

export async function hent(tabell, nokkel) {
  const db = await apneDb();
  return somLofte(db.transaction(tabell).objectStore(tabell).get(nokkel));
}

/** Alle rader der en indeks har en bestemt verdi, for eksempel hendelser for én dato. */
export async function hentEtterIndeks(tabell, indeks, verdi) {
  const db = await apneDb();
  return somLofte(db.transaction(tabell).objectStore(tabell).index(indeks).getAll(verdi));
}

/** Alle rader der en indeks ligger mellom fra og til (begge med), for eksempel hendelser i en periode. */
export async function hentIntervall(tabell, indeks, fra, til) {
  const db = await apneDb();
  return somLofte(db.transaction(tabell).objectStore(tabell).index(indeks).getAll(IDBKeyRange.bound(fra, til)));
}

export async function lagre(tabell, rad) {
  const db = await apneDb();
  const tx = db.transaction(tabell, 'readwrite');
  tx.objectStore(tabell).put(rad);
  return ferdig(tx);
}

export async function tell(tabell) {
  const db = await apneDb();
  return somLofte(db.transaction(tabell).objectStore(tabell).count());
}

export async function hentInnstilling(nokkel) {
  const rad = await hent('innstillinger', nokkel);
  return rad ? rad.verdi : STANDARD_INNSTILLINGER[nokkel];
}

export function lagreInnstilling(nokkel, verdi) {
  return lagre('innstillinger', { nokkel, verdi });
}

/** Leser hele databasen som et vanlig objekt { tabellnavn: [rader] }. */
export async function hentAltInnhold() {
  const db = await apneDb();
  const tx = db.transaction(TABELLNAVN);
  const data = {};
  await Promise.all(TABELLNAVN.map(async (navn) => {
    data[navn] = await somLofte(tx.objectStore(navn).getAll());
  }));
  return data;
}

/**
 * Erstatter ALLE data i databasen med innholdet i `data`, i én transaksjon.
 * Går noe galt, rulles alt tilbake og de gamle dataene står urørt.
 */
export async function erstattAltInnhold(data) {
  const db = await apneDb();
  const tx = db.transaction(TABELLNAVN, 'readwrite');
  for (const navn of TABELLNAVN) {
    const store = tx.objectStore(navn);
    store.clear();
    for (const rad of data[navn] || []) store.put(rad);
  }
  return ferdig(tx);
}

/**
 * Lagrer og sletter rader i flere tabeller i én transaksjon (alt eller ingenting).
 * endringer: { lagre: { tabell: [rader] }, slett: { tabell: [nøkler] } }
 */
export async function utforEndringer({ lagre = {}, slett = {} }) {
  const tabeller = [...new Set([...Object.keys(lagre), ...Object.keys(slett)])];
  if (tabeller.length === 0) return;
  const db = await apneDb();
  const tx = db.transaction(tabeller, 'readwrite');
  for (const [tabell, nokler] of Object.entries(slett)) for (const k of nokler) tx.objectStore(tabell).delete(k);
  for (const [tabell, rader] of Object.entries(lagre)) for (const r of rader) tx.objectStore(tabell).put(r);
  return ferdig(tx);
}

/** Sletter alle data (brukes bare fra utviklerverktøy). */
export function slettAltInnhold() {
  return erstattAltInnhold({});
}

/**
 * Ber nettleseren om vedvarende lagring, slik at data ikke slettes når telefonen
 * får lite plass (kravspesifikasjonen kapittel 9).
 */
export async function beOmVedvarendeLagring() {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/** Lager en ny unik ID. */
export function nyId() {
  return crypto.randomUUID();
}
