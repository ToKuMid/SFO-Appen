// Tilstand for låsing og administrator, uten DOM. Brukes av låseskjermen (ui/las.js),
// dialoger (dom.js) og filer/utskrift (som åpner systemvinduer).

let last = true;
let admin = false;
let systemvindu = null; // { siden } mens et systemvindu (filvelger, delingsark, utskrift) er åpent
let ventende = [];

// Kommer brukeren tilbake fra et systemvindu innen denne tiden, låses ikke appen.
export const SYSTEMVINDU_MAKS = 2 * 60000;

export const erLast = () => last;
export const erAdmin = () => admin;

export function settLast(verdi) {
  last = verdi;
  if (last) admin = false;
  if (!last) {
    const v = ventende;
    ventende = [];
    v.forEach((f) => f());
  }
}

export function settAdmin(verdi) { admin = verdi && !last; }

/** Løses når appen er låst opp (med en gang hvis den ikke er låst). */
export function naarOpplast() {
  return last ? new Promise((r) => ventende.push(r)) : Promise.resolve();
}

/**
 * Kalles rett før appen åpner filvelger, delingsark eller utskrift. Da forlater brukeren appen et
 * øyeblikk uten at den skal låses. Den låses likevel hvis det går mer enn to minutter.
 */
export function aapnerSystemvindu() {
  systemvindu = { siden: Date.now() };
  if (typeof window === 'undefined') return;
  // Kommer det ingen «skjult», er vinduet ferdig ved neste trykk i appen.
  setTimeout(() => window.addEventListener('pointerdown', () => { if (systemvindu && !systemvindu.skjult) systemvindu = null; }, { once: true }), 0);
}

/** Avgjør om appen skal låses når den blir skjult eller synlig igjen. */
export function skalLases(synlig, naa = Date.now()) {
  if (!synlig) {
    if (systemvindu) { systemvindu.skjult = naa; return false; }
    return true;
  }
  if (systemvindu?.skjult) {
    const lenge = naa - systemvindu.skjult > SYSTEMVINDU_MAKS;
    systemvindu = null;
    return lenge;
  }
  return false;
}
