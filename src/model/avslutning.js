// Dagsavslutning (K-20, K-21): når dagen ble avsluttet, om noe er registrert etter det, og tallene
// som vises på «Takk for i dag». Ren logikk uten DOM.

/**
 * Status for dagens avslutning. avsluttet: { dato, tid } fra innstillingen 'dagAvsluttet'.
 * Returnerer null hvis dagen ikke er avsluttet, ellers { tid, endretEtter }.
 * endretEtter: noen har registrert noe (inn, ut, fravær, angre) etter avslutningen.
 */
export function avslutningStatus(avsluttet, dato, hendelser = []) {
  if (!avsluttet || avsluttet.dato !== dato) return null;
  const endretEtter = hendelser.some((x) => x.dato === dato && x.tid > avsluttet.tid);
  return { tid: avsluttet.tid, endretEtter };
}

/**
 * Tallene for «Takk for i dag». tall: fra dagsoversikt. tellinger: dagens tellinger.
 * Bare tall, ingen navn.
 */
export function dagsoppsummering(tall, tellinger = []) {
  return {
    mott: tall.inne + tall.sjekketUt,
    meldtFravaer: tall.meldtFravaer,
    ikkeMott: tall.ikkeMott,
    aldriRegistrert: tall.ikkeRegistrert,
    ikkeSjekketUt: tall.inne,
    tellinger: tellinger.length,
    tellingerMedAvvik: tellinger.filter((t) => t.antallTalt < t.antallForventet).length,
  };
}
