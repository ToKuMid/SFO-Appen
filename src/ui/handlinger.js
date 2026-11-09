// Knapper og handlinger som brukes på flere skjermer: sjekk inn, sjekk ut, fravær, angre.
// Hver handling gir en melding med «Angre» (K-15).
import { h, visDialog, visMelding } from '../dom.js';
import { angre, ekstraDagOgInn, hentInitialer, registrer } from '../dag.js';
import { klokkeFra } from '../dato.js';
import { STATUS } from '../model/status.js';

const navn = (e) => `${e.fornavn} ${e.etternavn}`;
const ANGRE_GRENSE_MIN = 10;

function meldMedAngre(tekst, hendelse) {
  visMelding(tekst, 'ok', { handling: { tekst: 'Angre', onclick: () => angre(hendelse) } });
}

export async function sjekkInn(rad) {
  const hd = rad.status === STATUS.IKKE_SFO ? await ekstraDagOgInn(rad.elev.id) : await registrer(rad.elev.id, 'inn');
  meldMedAngre(`${navn(rad.elev)} sjekket inn ${klokkeFra(hd.tid)}`, hd);
}

export async function sjekkUt(rad) {
  const hd = await registrer(rad.elev.id, 'ut');
  meldMedAngre(`${navn(rad.elev)} sjekket ut ${klokkeFra(hd.tid)}`, hd);
}

/** Fravær: meldt fravær eller ikke møtt, med initialer (K-11, K-18). Returnerer true hvis fraværet ble lagret. */
export async function registrerFravaer(rad) {
  const initialer = await hentInitialer();
  const valg = (verdi, tittel, tekst, valgt) => h('label', { class: 'radiovalg' },
    h('input', { type: 'radio', name: 'fravaertype', value: verdi, checked: valgt }),
    h('span', {}, h('strong', {}, tittel), h('span', { class: 'dempet liten' }, tekst)));
  const svar = await visDialog({
    tittel: `Fravær for ${rad.elev.fornavn}`,
    innhold: [
      h('div', { class: 'radiogruppe' },
        valg('meldt-fravaer', 'Meldt fravær', 'Foresatte har gitt beskjed, for eksempel i Barn-nett.', true),
        valg('ikke-mott', 'Ikke møtt', 'Barnet kom ikke, og det er fulgt opp.', false)),
      h('p', { class: 'dempet liten', id: 'fravaer-initialer' }, `Registreres av ${initialer}.`),
    ],
    knapper: [{ tekst: 'Avbryt', verdi: 'avbryt' }, { tekst: 'Lagre fravær', verdi: 'lagre', type: 'primar' }],
  });
  if (svar !== 'lagre') return false;
  const type = document.querySelector('input[name="fravaertype"]:checked')?.value ?? 'meldt-fravaer';
  const hd = await registrer(rad.elev.id, type);
  meldMedAngre(`${navn(rad.elev)}: ${type === 'ikke-mott' ? 'ikke møtt' : 'meldt fravær'}`, hd);
  return true;
}

export async function angreSiste(rad) {
  if (!rad.siste) return;
  await angre(rad.siste);
  visMelding(`Angret for ${navn(rad.elev)}.`, 'ok');
}

/** Kan siste handling angres med én knapp? (de siste ti minuttene) */
export function kanAngres(rad, naa = new Date()) {
  return !!rad.siste && naa - new Date(rad.siste.tid) < ANGRE_GRENSE_MIN * 60000;
}

// ---------- Knapper ----------

export function knappSjekkUt(rad) {
  return h('button', { type: 'button', class: 'knapp knapp-omriss knapp-rad', 'data-handling': 'ut', onclick: () => sjekkUt(rad) }, 'Sjekk ut');
}

export function knappSjekkInn(rad, { tekst = 'Sjekk inn', stil = 'knapp-primar' } = {}) {
  return h('button', { type: 'button', class: `knapp ${stil} knapp-rad`, 'data-handling': 'inn', onclick: () => sjekkInn(rad) }, tekst);
}

export function knappFravaer(rad) {
  return h('button', { type: 'button', class: 'knapp knapp-rad', 'data-handling': 'fravaer', onclick: () => registrerFravaer(rad) }, 'Fravær');
}

export function knappAngre(rad) {
  return h('button', { type: 'button', class: 'knapp knapp-lenke knapp-rad', 'data-handling': 'angre', onclick: () => angreSiste(rad) }, 'Angre');
}
