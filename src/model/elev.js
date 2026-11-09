// Regler for elever: trinn, skolegrupper, ukedager, klokkeslett og kontroll av felter.
// Brukes både av Excel-importen og av skjemaet for å legge til og redigere elever.

/** Skolegrupper per trinn (kravspesifikasjonen kap. 7): 1.–3. trinn i Gruppe 1, 4. trinn i Gruppe 2. */
export const SKOLEGRUPPER = {
  1: ['Gruppe 1 blå', 'Gruppe 1 grønn'],
  2: ['Gruppe 1 blå', 'Gruppe 1 grønn'],
  3: ['Gruppe 1 blå', 'Gruppe 1 grønn'],
  4: ['Gruppe 2 oppe', 'Gruppe 2 nede'],
};

export const ALLE_SKOLEGRUPPER = ['Gruppe 1 blå', 'Gruppe 1 grønn', 'Gruppe 2 oppe', 'Gruppe 2 nede'];

/** Ukedager med SFO: 1 = mandag … 5 = fredag. */
export const UKEDAGER = [
  { nr: 1, kort: 'Man', navn: 'mandag' },
  { nr: 2, kort: 'Tir', navn: 'tirsdag' },
  { nr: 3, kort: 'Ons', navn: 'onsdag' },
  { nr: 4, kort: 'Tor', navn: 'torsdag' },
  { nr: 5, kort: 'Fre', navn: 'fredag' },
];

export const MAKS_MERKNAD = 500;

const enkel = (s) => String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
/** Navn og tekst: fjerner ekstra mellomrom. */
export const ryddTekst = enkel;

/** Nøkkel for å sammenligne navn uten hensyn til store/små bokstaver og mellomrom. */
export function navnNokkel(fornavn, etternavn) {
  return `${enkel(fornavn).toLocaleLowerCase('nb')}|${enkel(etternavn).toLocaleLowerCase('nb')}`;
}

/** «3», «3.», «3. trinn» eller 3 → 3. Returnerer null hvis ugyldig. */
export function tolkTrinn(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 1 && v <= 4 ? v : null;
  const m = enkel(v).match(/^([1-4])\.?(\s*trinn)?$/i);
  return m ? Number(m[1]) : null;
}

/** Finner riktig skrivemåte for en skolegruppe («gr. 1 Blå» → «Gruppe 1 blå»). Null hvis ukjent. */
export function tolkSkolegruppe(v) {
  const s = enkel(v).toLocaleLowerCase('nb').replace(/^gr\.?\s*(?=\d)/, 'gruppe ').replace(/^gruppe(\d)/, 'gruppe $1');
  return ALLE_SKOLEGRUPPER.find((g) => g.toLocaleLowerCase('nb') === s) ?? null;
}

/**
 * Klokkeslett fra Excel eller skjema → 'HH:MM'.
 * Godtar «15:30», «15.30», «1530», «15», og tall fra Excel (0.6458… = 15:30).
 * Tom verdi gir null. Ugyldig verdi kaster en feil.
 */
export function tolkKlokkeslett(v) {
  if (v === '' || v === null || v === undefined) return null;
  let timer;
  let minutter;
  if (typeof v === 'number') {
    const brok = v % 1; // Excel lagrer dato + klokkeslett som dager; klokkeslettet er desimaldelen
    const totalt = Math.round(brok * 1440) % 1440;
    timer = Math.floor(totalt / 60);
    minutter = totalt % 60;
  } else {
    const s = enkel(v);
    if (s === '') return null;
    const m = s.match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
    if (!m) throw new Error(`«${s}» er ikke et klokkeslett (skriv for eksempel 15:30)`);
    timer = Number(m[1]);
    minutter = Number(m[2] ?? 0);
  }
  if (timer > 23 || minutter > 59) throw new Error(`«${v}» er ikke et gyldig klokkeslett`);
  return `${String(timer).padStart(2, '0')}:${String(minutter).padStart(2, '0')}`;
}

/** X, ja, 1 → true. Tom, nei, 0 → false. Annet → feil. */
export function tolkDag(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === '' || v === null || v === undefined) return false;
  const s = enkel(v).toLowerCase();
  if (['x', 'ja', 'j', '1', '✓', 'yes'].includes(s)) return true;
  if (['', 'nei', 'n', '0', '-'].includes(s)) return false;
  throw new Error(`«${v}» (bruk X eller la cellen stå tom)`);
}

/**
 * Kontrollerer og rydder en elev. Inndata: { fornavn, etternavn, trinn, skolegruppe, ukedager,
 * gaarHjemAleneFra, fastHentetid, fritekst }. Returnerer { verdi, feil: [tekst] }.
 */
export function kontrollerElev(inn) {
  const feil = [];
  const fornavn = enkel(inn.fornavn);
  const etternavn = enkel(inn.etternavn);
  if (!fornavn) feil.push('Fornavn mangler');
  if (!etternavn) feil.push('Etternavn mangler');
  if (fornavn.length > 60 || etternavn.length > 60) feil.push('Navnet er for langt');

  const trinn = tolkTrinn(inn.trinn);
  if (trinn === null) feil.push(`Trinn må være 1, 2, 3 eller 4${inn.trinn !== '' && inn.trinn !== undefined ? ` (står «${inn.trinn}»)` : ''}`);

  const skolegruppe = tolkSkolegruppe(inn.skolegruppe);
  if (!skolegruppe) feil.push(`Ukjent skolegruppe${enkel(inn.skolegruppe) ? ` «${enkel(inn.skolegruppe)}»` : ''}. Bruk ${ALLE_SKOLEGRUPPER.join(', ')}`);
  else if (trinn !== null && !SKOLEGRUPPER[trinn].includes(skolegruppe)) {
    feil.push(`${skolegruppe} passer ikke med ${trinn}. trinn (${trinn <= 3 ? '1.–3. trinn hører til Gruppe 1' : '4. trinn hører til Gruppe 2'})`);
  }

  const ukedager = [...new Set(inn.ukedager ?? [])].filter((d) => d >= 1 && d <= 5).sort();
  if (ukedager.length === 0) feil.push('Eleven har ingen SFO-dager');

  let gaarHjemAleneFra = null;
  let fastHentetid = null;
  try { gaarHjemAleneFra = tolkKlokkeslett(inn.gaarHjemAleneFra); } catch (e) { feil.push(`Går hjem alene fra: ${e.message}`); }
  try { fastHentetid = tolkKlokkeslett(inn.fastHentetid); } catch (e) { feil.push(`Fast hentetid: ${e.message}`); }

  const fritekst = String(inn.fritekst ?? '').trim();
  if (fritekst.length > MAKS_MERKNAD) feil.push(`Merknaden er for lang (maks ${MAKS_MERKNAD} tegn)`);

  return {
    verdi: { fornavn, etternavn, trinn, skolegruppe, ukedager, gaarHjemAleneFra, fastHentetid, fritekst },
    feil,
  };
}

/** Lager avtale-raden (K-41) for en elev, eller null hvis eleven ikke har faste avtaler. */
export function avtaleFra(elevId, { gaarHjemAleneFra, fastHentetid, fritekst }) {
  if (!gaarHjemAleneFra && !fastHentetid && !fritekst) return null;
  return { elevId, gaarHjemAleneFra: gaarHjemAleneFra || null, fastHentetid: fastHentetid || null, fritekst: fritekst || '' };
}
