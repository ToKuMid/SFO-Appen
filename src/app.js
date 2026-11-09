// Oppstart, faner og oppdatering av appen.
import { apneDb, beOmVedvarendeLagring, DATAVERSJON, hentInnstilling, lagreInnstilling } from './db.js';
import { klokkeTekst, lokalDato } from './dato.js';
import { visMelding } from './dom.js';
import { visMer } from './ui/mer.js';
import { visAndre, visIdag, visTelling } from './ui/skjermer.js';
import { visElevSkjema, visEleverListe } from './ui/elever.js';

// Adresser: #idag, #andre, #telling, #elever, #elever/<id>, #elever/ny, #mer
const SKJERMER = {
  idag: visIdag,
  andre: visAndre,
  telling: visTelling,
  elever: (param) => (param ? visElevSkjema(param, naviger) : visEleverListe()),
  mer: () => visMer(() => visFane('mer', null, { behold: true })),
};
let aktivFane = 'idag';
let aktivParam = null;
let visningsdato = lokalDato();

/** Går til en adresse. Gir tilbake-knappen på Android noe å gå tilbake til. */
export function naviger(adresse) {
  if (location.hash === `#${adresse}`) visAdresse();
  else location.hash = adresse;
}

function visAdresse() {
  const [fane, param] = location.hash.slice(1).split('/');
  return visFane(fane, param ? decodeURIComponent(param) : null);
}

async function visFane(fane, param = null, { behold = false } = {}) {
  aktivFane = fane in SKJERMER ? fane : 'idag';
  aktivParam = param;
  for (const knapp of document.querySelectorAll('.fane')) {
    const valgt = knapp.dataset.fane === aktivFane;
    knapp.classList.toggle('valgt', valgt);
    if (valgt) knapp.setAttribute('aria-current', 'page');
    else knapp.removeAttribute('aria-current');
  }
  const innhold = document.getElementById('innhold');
  const rullet = window.scrollY;
  let side;
  try {
    side = await SKJERMER[aktivFane](aktivParam);
  } catch (e) {
    side = document.createTextNode(`Noe gikk galt: ${e.message}`);
  }
  innhold.replaceChildren(side);
  // Ved bytte av fane: til toppen. Ved oppfrisking av samme skjerm: bli stående.
  window.scrollTo(0, behold ? rullet : 0);
  visningsdato = lokalDato();
  if (!location.hash) history.replaceState(null, '', `#${aktivFane}`);
}

// Klokka på «I dag» og ny dag (K-10): sjekkes hvert 20. sekund og når appen åpnes igjen.
function oppdaterTid() {
  if (lokalDato() !== visningsdato) {
    visFane(aktivFane, aktivParam, { behold: true });
    return;
  }
  const klokke = document.getElementById('klokke');
  if (klokke) klokke.textContent = klokkeTekst();
}

// Ny versjon av appen: vis knapp, og bytt først når brukeren trykker (oppdatering endrer aldri data, IF-09).
function registrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const banner = document.getElementById('oppdatering');
  let venter = null;

  const visBanner = (sw) => {
    venter = sw;
    banner.hidden = false;
  };

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) visBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const ny = reg.installing;
      ny?.addEventListener('statechange', () => {
        if (ny.state === 'installed' && navigator.serviceWorker.controller) visBanner(ny);
      });
    });
    // Se etter ny versjon når appen åpnes igjen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Service worker ble ikke registrert:', e));

  document.getElementById('oppdater-knapp').addEventListener('click', () => {
    venter?.postMessage('HOPP_OVER_VENTING');
  });

  // Første installasjon gir også «controllerchange». Da skal siden ikke lastes på nytt,
  // bare når en ny versjon tar over etter at brukeren har trykket «Oppdater».
  let haddeKontroller = !!navigator.serviceWorker.controller;
  let lastetPaNytt = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!haddeKontroller) {
      haddeKontroller = true;
      return;
    }
    if (lastetPaNytt) return;
    lastetPaNytt = true;
    location.reload();
  });
}

async function start() {
  for (const knapp of document.querySelectorAll('.fane')) {
    knapp.addEventListener('click', () => naviger(knapp.dataset.fane));
  }
  setInterval(oppdaterTid, 20000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') oppdaterTid();
  });

  try {
    await apneDb();
    if ((await hentInnstilling('dataversjon')) === undefined) await lagreInnstilling('dataversjon', DATAVERSJON);
    await beOmVedvarendeLagring();
  } catch (e) {
    visMelding(`Databasen kunne ikke åpnes: ${e.message}`, 'feil');
  }

  registrerServiceWorker();
  window.addEventListener('hashchange', visAdresse);
  await visAdresse();
}

start();
