// Oppstart, faner og oppdatering av appen.
import { apneDb, beOmVedvarendeLagring, DATAVERSJON, hentInnstilling, lagreInnstilling } from './db.js';
import { datoTekst } from './dato.js';
import { visMelding } from './dom.js';
import { visMer } from './ui/mer.js';
import { visEleverListe, visPlassholder } from './ui/plassholder.js';

const FANER = ['idag', 'andre', 'telling', 'elever', 'mer'];
let aktivFane = 'idag';

async function visFane(fane) {
  aktivFane = FANER.includes(fane) ? fane : 'idag';
  for (const knapp of document.querySelectorAll('.fane')) {
    const valgt = knapp.dataset.fane === aktivFane;
    knapp.classList.toggle('valgt', valgt);
    if (valgt) knapp.setAttribute('aria-current', 'page');
    else knapp.removeAttribute('aria-current');
  }
  const innhold = document.getElementById('innhold');
  let side;
  try {
    if (aktivFane === 'mer') side = await visMer(() => visFane('mer'));
    else if (aktivFane === 'elever') side = await visEleverListe();
    else side = visPlassholder(aktivFane);
  } catch (e) {
    side = document.createTextNode(`Noe gikk galt: ${e.message}`);
  }
  innhold.replaceChildren(side);
  if (location.hash !== `#${aktivFane}`) history.replaceState(null, '', `#${aktivFane}`);
}

function oppdaterDato() {
  document.getElementById('dato').textContent = datoTekst();
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

  let lastetPaNytt = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (lastetPaNytt) return;
    lastetPaNytt = true;
    location.reload();
  });
}

async function start() {
  oppdaterDato();
  for (const knapp of document.querySelectorAll('.fane')) {
    knapp.addEventListener('click', () => visFane(knapp.dataset.fane));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') oppdaterDato();
  });

  try {
    await apneDb();
    if ((await hentInnstilling('dataversjon')) === undefined) await lagreInnstilling('dataversjon', DATAVERSJON);
    await beOmVedvarendeLagring();
  } catch (e) {
    visMelding(`Databasen kunne ikke åpnes: ${e.message}`, 'feil');
  }

  registrerServiceWorker();
  await visFane(location.hash.slice(1));
}

start();
