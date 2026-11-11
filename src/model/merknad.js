// Merknad for dagen (K-40, ønske fra SFO-leder): korte beskjeder for i dag, for eksempel fra Barn-nett
// («hentes av bestemor i dag»). Merknaden gjelder bare den datoen den ble skrevet, og slettes når
// dagen avsluttes og senest ved første oppstart neste dag. Ren logikk uten DOM.

/** Teksten i merknaden hvis den gjelder denne datoen, ellers tom tekst. */
export const merknadIDag = (avtale, dato) => (avtale?.fritekst && avtale.fritekstDato === dato ? avtale.fritekst : '');

/**
 * Hvilke merknader skal slettes? Uten `alle` slettes bare merknader fra andre datoer enn `dato`
 * (også eldre merknader uten dato). Med `alle` slettes også dagens (når dagen avsluttes).
 * En avtale uten noe annet enn merknaden slettes helt.
 * Returnerer { lagre: [avtaler], slett: [elevId] }.
 */
export function nullstillPlan(avtaler, dato, { alle = false } = {}) {
  const lagre = [];
  const slett = [];
  for (const a of avtaler) {
    if (!a.fritekst && !a.fritekstDato) continue;
    if (!alle && a.fritekst && a.fritekstDato === dato) continue;
    if (!a.gaarHjemAleneFra && !a.fastHentetid) slett.push(a.elevId);
    else lagre.push({ ...a, fritekst: '', fritekstDato: null });
  }
  return { lagre, slett };
}
