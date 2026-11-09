// Sikkerhetskopi: bygge, kontrollere, oppgradere og oppsummere (K-60, K-61, K-62).
// Ren logikk uten nettleser-API-er, slik at den kan testes med `npm test`.
//
// Format:
// {
//   "format": "sfo-appen-sikkerhetskopi",
//   "dataversjon": 1,
//   "appversjon": "0.1.0",
//   "eksportert": "2026-11-09T15:30:00.000Z",
//   "data": { "elever": [...], "avtaler": [...], ... }
// }

import { DATAVERSJON, TABELLER, TABELLNAVN } from './db.js';
import { lokalDato } from './dato.js';

export const FORMAT = 'sfo-appen-sikkerhetskopi';

/** Filnavn etter kravspesifikasjonen kapittel 9: SFO-backup-ÅÅÅÅ-MM-DD.json */
export function filnavn(d = new Date()) {
  return `SFO-backup-${lokalDato(d)}.json`;
}

export function byggSikkerhetskopi(data, { appversjon, naa = new Date() } = {}) {
  const kopi = {};
  for (const navn of TABELLNAVN) kopi[navn] = Array.isArray(data[navn]) ? data[navn] : [];
  return {
    format: FORMAT,
    dataversjon: DATAVERSJON,
    appversjon: appversjon ?? null,
    eksportert: naa.toISOString(),
    data: kopi,
  };
}

/** Gjør om tekst til et objekt. Kaster en forståelig feil hvis filen ikke er JSON. */
export function lesTekst(tekst) {
  try {
    return JSON.parse(tekst);
  } catch {
    throw new Error('Filen er ikke en gyldig sikkerhetskopi (ikke lesbar som JSON).');
  }
}

/**
 * Oppgraderinger av eldre sikkerhetskopier. Steg N gjør en kopi fra dataversjon N-1 til N.
 * Ingen steg ennå, fordi dataversjon 1 er den første.
 */
const MIGRERINGER = {
  // 2(kopi) { ...; return kopi; },
};

export function oppgrader(kopi) {
  let k = kopi;
  for (let v = k.dataversjon + 1; v <= DATAVERSJON; v++) {
    const steg = MIGRERINGER[v];
    if (!steg) throw new Error(`Mangler oppgradering til dataversjon ${v}.`);
    k = { ...steg(structuredClone(k)), dataversjon: v };
  }
  return k;
}

const erTekst = (v) => typeof v === 'string' && v.trim() !== '';
const erDato = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Kontrollerer en sikkerhetskopi før gjenoppretting.
 * Returnerer { ok, feil: [tekst], kopi } der kopi er oppgradert til gjeldende dataversjon.
 */
export function kontroller(obj) {
  const feil = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, feil: ['Filen inneholder ikke en sikkerhetskopi.'] };
  }
  if (obj.format !== FORMAT) {
    return { ok: false, feil: ['Filen er ikke en sikkerhetskopi fra SFO-appen.'] };
  }
  if (!Number.isInteger(obj.dataversjon) || obj.dataversjon < 1) {
    return { ok: false, feil: ['Sikkerhetskopien mangler gyldig dataversjon.'] };
  }
  if (obj.dataversjon > DATAVERSJON) {
    return {
      ok: false,
      feil: [`Sikkerhetskopien er laget med en nyere versjon av appen (dataversjon ${obj.dataversjon}). Oppdater appen først.`],
    };
  }
  if (!obj.data || typeof obj.data !== 'object') {
    return { ok: false, feil: ['Sikkerhetskopien mangler data.'] };
  }

  let kopi;
  try {
    kopi = oppgrader(obj);
  } catch (e) {
    return { ok: false, feil: [e.message] };
  }

  for (const navn of TABELLNAVN) {
    const rader = kopi.data[navn] ?? [];
    if (!Array.isArray(rader)) {
      feil.push(`«${navn}» er ikke en liste.`);
      continue;
    }
    const nokkel = TABELLER[navn].nokkel;
    const sett = new Set();
    rader.forEach((rad, i) => {
      const k = rad?.[nokkel];
      if (!erTekst(k)) feil.push(`«${navn}» rad ${i + 1} mangler ${nokkel}.`);
      else if (sett.has(k)) feil.push(`«${navn}» har ${nokkel} «${k}» flere ganger.`);
      else sett.add(k);
    });
  }

  const elevIder = new Set((kopi.data.elever ?? []).map((e) => e?.id));
  (kopi.data.elever ?? []).forEach((e, i) => {
    if (!e) return;
    if (!erTekst(e.fornavn) || !erTekst(e.etternavn)) feil.push(`Elev ${i + 1} mangler navn.`);
    if (![1, 2, 3, 4].includes(e.trinn)) feil.push(`Elev ${i + 1} har ugyldig trinn.`);
  });
  for (const navn of ['avtaler', 'unntak', 'hendelser', 'tellingslinjer']) {
    (kopi.data[navn] ?? []).forEach((rad, i) => {
      if (rad && !elevIder.has(rad.elevId)) feil.push(`«${navn}» rad ${i + 1} viser til en elev som ikke finnes.`);
    });
  }
  for (const navn of ['unntak', 'hendelser', 'tellinger']) {
    (kopi.data[navn] ?? []).forEach((rad, i) => {
      if (rad && !erDato(rad.dato)) feil.push(`«${navn}» rad ${i + 1} har ugyldig dato.`);
    });
  }

  // Vis bare de første feilene, så meldingen blir lesbar.
  return { ok: feil.length === 0, feil: feil.slice(0, 10), antallFeil: feil.length, kopi };
}

/** Oppsummering til forhåndsvisning før gjenoppretting (K-61) og etter eksport. */
export function oppsummer(kopi) {
  const d = kopi.data;
  const datoer = [...(d.hendelser ?? []), ...(d.tellinger ?? [])].map((r) => r.dato).filter(Boolean).sort();
  return {
    elever: (d.elever ?? []).length,
    aktiveElever: (d.elever ?? []).filter((e) => e.aktiv !== false).length,
    hendelser: (d.hendelser ?? []).length,
    tellinger: (d.tellinger ?? []).length,
    forsteDato: datoer[0] ?? null,
    sisteDato: datoer[datoer.length - 1] ?? null,
    eksportert: kopi.eksportert ?? null,
    dataversjon: kopi.dataversjon,
  };
}
