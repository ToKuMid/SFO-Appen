// Sletter merknader for dagen (se model/merknad.js). Kjøres ved oppstart, ved ny dag og når dagen avsluttes.
import { hentAlle, utforEndringer } from './db.js';
import { lokalDato } from './dato.js';
import { nullstillPlan } from './model/merknad.js';

/** Sletter gamle merknader. Med alle: true slettes også dagens. Returnerer antall slettede merknader. */
export async function nullstillMerknader({ alle = false, naa = new Date() } = {}) {
  const plan = nullstillPlan(await hentAlle('avtaler'), lokalDato(naa), { alle });
  const antall = plan.lagre.length + plan.slett.length;
  if (antall) await utforEndringer({ lagre: { avtaler: plan.lagre }, slett: { avtaler: plan.slett } });
  return antall;
}
