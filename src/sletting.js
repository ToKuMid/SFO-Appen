// Kjører automatisk sletting av gammel historikk (K-63) mot databasen.
// Kjøres ved oppstart og når datoen skifter, høyst én gang per dag. Regelen ligger i model/sletting.js.
import {
  hentAlle, hentForVerdier, hentInnstilling, hentIntervall, lagreInnstilling, tellIntervall, utforEndringer,
} from './db.js';
import { lokalDato } from './dato.js';
import { dagenFor, slettegrense, slettePlan } from './model/sletting.js';

/** Lager slettelisten for en grense (uten å slette noe). */
export async function lagSlettePlan(grense) {
  const forGrensen = dagenFor(grense);
  const [hendelser, unntak, tellinger, elever, avtaler] = await Promise.all([
    hentIntervall('hendelser', 'dato', '0000-01-01', forGrensen),
    hentIntervall('unntak', 'dato', '0000-01-01', forGrensen),
    hentIntervall('tellinger', 'dato', '0000-01-01', forGrensen),
    hentAlle('elever'),
    hentAlle('avtaler'),
  ]);
  const tellingslinjer = await hentForVerdier('tellingslinjer', 'tellingId', tellinger.map((t) => t.id));
  // Deaktiverte elever beholdes så lenge de har registreringer fra grensen og senere.
  const elevMedNyereData = new Set();
  await Promise.all(elever.filter((e) => e.aktiv === false).map(async (e) => {
    const [h, u] = await Promise.all([
      tellIntervall('hendelser', 'elevDato', [e.id, grense], [e.id, '9999-12-31']),
      tellIntervall('unntak', 'elevDato', [e.id, grense], [e.id, '9999-12-31']),
    ]);
    if (h + u > 0) elevMedNyereData.add(e.id);
  }));
  for (const e of elever) if (e.aktiv !== false) elevMedNyereData.add(e.id);
  return slettePlan({ grense, gamle: { hendelser, unntak, tellinger, tellingslinjer }, elever, avtaler, elevMedNyereData });
}

/** Sletter etter planen og husker når det ble gjort. */
export async function utforSletting(plan, naa = new Date()) {
  if (!plan.tom) await utforEndringer({ slett: plan.slett });
  await lagreInnstilling('sisteSletting', { tid: naa.toISOString(), grense: plan.grense, antall: plan.antall });
  return plan;
}

/**
 * Automatisk sletting, høyst én gang per dag. Returnerer planen hvis noe ble slettet, ellers null.
 */
export async function kjorAutomatiskSletting(naa = new Date()) {
  const idag = lokalDato(naa);
  const forrige = await hentInnstilling('sisteSletting');
  if (forrige?.tid && lokalDato(new Date(forrige.tid)) === idag) return null;
  const grense = slettegrense(idag, await hentInnstilling('lagringSkoleaar'));
  const plan = await lagSlettePlan(grense);
  await utforSletting(plan, naa);
  return plan.tom ? null : plan;
}
