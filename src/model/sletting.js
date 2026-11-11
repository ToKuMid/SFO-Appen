// Automatisk sletting av gammel historikk (K-63, DPIA kapittel 5).
// Regel: hendelser, unntak og tellinger fra inneværende og forrige skoleår beholdes (standard).
// Det som er eldre, slettes. Et skoleår starter 1. august. Deaktiverte elever slettes når de ikke
// lenger har noen registreringer igjen, og ble deaktivert før grensen.
// Ren logikk uten database, slik at regelen kan testes.

export const SKOLEAAR_START = '08-01';
export const STANDARD_SKOLEAAR = 2;
export const SKOLEAAR_VALG = [1, 2];

/** Første dag i skoleåret som datoen hører til, for eksempel 2026-11-10 → 2026-08-01. */
export function skoleaarStart(dato) {
  const aar = Number(dato.slice(0, 4));
  return dato.slice(5) >= SKOLEAAR_START ? `${aar}-${SKOLEAAR_START}` : `${aar - 1}-${SKOLEAAR_START}`;
}

/**
 * Datoen alt eldre enn slettes. Med 2 skoleår: starten av forrige skoleår.
 * 2026-11-10 → 2025-08-01. 2026-07-31 → 2024-08-01.
 */
export function slettegrense(idag, antallSkoleaar = STANDARD_SKOLEAAR) {
  const n = SKOLEAAR_VALG.includes(antallSkoleaar) ? antallSkoleaar : STANDARD_SKOLEAAR;
  const start = skoleaarStart(idag);
  return `${Number(start.slice(0, 4)) - (n - 1)}-${SKOLEAAR_START}`;
}

/** Dagen før en dato ('ÅÅÅÅ-MM-DD'), for å hente alt som er eldre enn grensen. */
export function dagenFor(dato) {
  const [a, m, d] = dato.split('-').map(Number);
  const x = new Date(a, m - 1, d - 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/**
 * Hva som skal slettes.
 * gamle: rader eldre enn grensen { hendelser, unntak, tellinger, tellingslinjer } (linjer for de gamle tellingene).
 * elever, avtaler: alle. elevMedNyereData: Set med elev-ID-er som har registreringer fra grensen og senere.
 */
export function slettePlan({ grense, gamle, elever, avtaler, elevMedNyereData }) {
  const eldre = (r) => typeof r.dato === 'string' && r.dato < grense;
  const hendelser = gamle.hendelser.filter(eldre);
  const unntak = gamle.unntak.filter(eldre);
  const tellinger = gamle.tellinger.filter(eldre);
  const tellingIder = new Set(tellinger.map((t) => t.id));
  const tellingslinjer = gamle.tellingslinjer.filter((l) => tellingIder.has(l.tellingId));
  const avtaleFor = new Set(avtaler.map((a) => a.elevId));
  // Deaktiverte elever slettes når de ikke har registreringer fra grensen og senere, og ble
  // deaktivert før grensen. En elev som ble deaktivert i år, kan derfor aktiveres igjen.
  const deaktivertFor = (e) => !e.endret || e.endret.slice(0, 10) < grense;
  const elevSlett = elever.filter((e) => e.aktiv === false && !elevMedNyereData.has(e.id) && deaktivertFor(e));

  const slett = {
    hendelser: hendelser.map((r) => r.id),
    unntak: unntak.map((r) => r.id),
    tellinger: tellinger.map((r) => r.id),
    tellingslinjer: tellingslinjer.map((r) => r.id),
    elever: elevSlett.map((e) => e.id),
    avtaler: elevSlett.filter((e) => avtaleFor.has(e.id)).map((e) => e.id),
  };
  const antall = Object.fromEntries(Object.entries(slett).map(([k, v]) => [k, v.length]));
  return { grense, slett, antall, tom: Object.values(antall).every((n) => n === 0) };
}
