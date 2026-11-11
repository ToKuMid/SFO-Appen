// Oppstart, faner og oppdatering av appen.
import { ER_TEST } from './miljo.js';
import { apneDb, beOmVedvarendeLagring, DATAVERSJON, hentInnstilling, lagreInnstilling } from './db.js';
import { klokkeTekst, lokalDato } from './dato.js';
import { visMelding } from './dom.js';
import { visMer } from './ui/mer.js';
import { visAndre, visIdag } from './ui/skjermer.js';
import { visTelling } from './ui/telling.js';
import { visElevSkjema, visEleverListe } from './ui/elever.js';
import { visElevkort } from './ui/elevkort.js';
import { visGrupperapport } from './ui/rapport.js';
import { visElevrapport } from './ui/elevrapport.js';
import { visAvviksrapport } from './ui/avviksrapport.js';
import { avsluttAdmin, startTilgang } from './ui/las.js';
import { erAdmin } from './tilgang.js';
import { kjorAutomatiskSletting } from './sletting.js';
import { nullstillMerknader } from './merknad.js';
import { visFerdig } from './ui/avslutning.js';

const oppfrisk = () => visFane(aktivFane, aktivParam, { behold: true });

// Adresser: #idag, #andre, #telling, #elever, #elever/<id> (rediger), #elever/ny, #elev/<id> (elevkort), #mer,
// #rapport/gruppe (grupperapport), #rapport/elev (velg elev), #rapport/elev/<id> (elevrapport),
// #rapport/avvik (avviksrapport), #ferdig («Takk for i dag» etter dagsavslutning)
const SKJERMER = {
  idag: visIdag,
  andre: visAndre,
  telling: () => visTelling(oppfrisk),
  elever: (param) => (param ? visElevSkjema(param, naviger) : visEleverListe()),
  elev: (param) => visElevkort(param, { tilbake: forrigeFane }),
  mer: () => visMer(oppfrisk),
  ferdig: () => visFerdig(oppfrisk),
  rapport: (param) => {
    if (param?.startsWith('elev')) return visElevrapport(param.split('/')[1] ?? null, oppfrisk);
    if (param === 'avvik') return visAvviksrapport(oppfrisk);
    return visGrupperapport(oppfrisk);
  },
};
const FANER = ['idag', 'andre', 'telling', 'elever', 'mer'];
let aktivFane = 'idag';
let aktivParam = null;
let forrigeFane = 'idag'; // fanen elevkortet ble åpnet fra, til «tilbake»-lenken
let visningsdato = lokalDato();
let visningsminutt = new Date().getMinutes();
let tegning = 0;

/** Går til en adresse. Gir tilbake-knappen på Android noe å gå tilbake til. */
export function naviger(adresse) {
  if (location.hash === `#${adresse}`) visAdresse();
  else location.hash = adresse;
}

function visAdresse() {
  const [fane, ...resten] = location.hash.slice(1).split('/');
  const param = resten.map(decodeURIComponent).join('/');
  return visFane(fane, param || null);
}

async function visFane(fane, param = null, { behold = false } = {}) {
  aktivFane = fane in SKJERMER ? fane : 'idag';
  aktivParam = param;
  if (FANER.includes(aktivFane) && !param) forrigeFane = aktivFane;
  const merketFane = aktivFane === 'elev' ? forrigeFane : aktivFane === 'rapport' ? 'mer' : aktivFane === 'ferdig' ? 'idag' : aktivFane;
  for (const knapp of document.querySelectorAll('.fane')) {
    const valgt = knapp.dataset.fane === merketFane;
    knapp.classList.toggle('valgt', valgt);
    if (valgt) knapp.setAttribute('aria-current', 'page');
    else knapp.removeAttribute('aria-current');
  }
  const innhold = document.getElementById('innhold');
  const rullet = window.scrollY;
  // Hvis en nyere tegning er startet mens denne ventet på data, vinner den nyeste.
  const nr = ++tegning;
  let side;
  try {
    side = await SKJERMER[aktivFane](aktivParam);
  } catch (e) {
    side = document.createTextNode(`Noe gikk galt: ${e.message}`);
  }
  if (nr !== tegning) return;
  innhold.replaceChildren(side);
  // Ved bytte av fane: til toppen. Ved oppfrisking av samme skjerm: bli stående.
  window.scrollTo(0, behold ? rullet : 0);
  visningsdato = lokalDato();
  visningsminutt = new Date().getMinutes();
  if (!location.hash) history.replaceState(null, '', `#${aktivFane}`);
}

// Klokka, varselet (K-16) og ny dag (K-10): sjekkes hvert 15. sekund og når appen åpnes igjen.
// «I dag» og «Ikke inne» tegnes på nytt hvert minutt, så varselet kommer av seg selv på varseltidspunktet.
// Det skjer ikke mens noen skriver i et felt eller har en dialog åpen.
function oppdaterTid() {
  if (lokalDato() !== visningsdato) {
    slettGammelHistorikk().then(oppfrisk);
    return;
  }
  const klokke = document.getElementById('klokke');
  if (klokke) klokke.textContent = klokkeTekst();
  const opptatt = document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (new Date().getMinutes() !== visningsminutt && ['idag', 'andre'].includes(aktivFane) && !opptatt) oppfrisk();
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

// K-63: gammel historikk slettes automatisk, høyst én gang per dag. Feil her stopper ikke appen.
// Merknader fra tidligere dager slettes også her (ved oppstart og ved ny dag).
async function slettGammelHistorikk() {
  try {
    await kjorAutomatiskSletting();
  } catch (e) {
    console.warn('Automatisk sletting feilet:', e);
  }
  // Merknader gjelder bare én dag. Ble ikke dagen avsluttet, slettes gårsdagens her.
  try {
    await nullstillMerknader();
  } catch (e) {
    console.warn('Sletting av merknader feilet:', e);
  }
}

// Manifestet legges inn her og ikke i index.html. Står det i index.html, kan Chrome lese SFO-appens
// manifest før koden rekker å bytte det, og test-appen får da samme app-ID som SFO-appen.
const manifest = document.createElement('link');
manifest.rel = 'manifest';
manifest.href = ER_TEST ? 'manifest-test.webmanifest' : 'manifest.webmanifest';
document.head.append(manifest);

// Testmiljø: gult banner, eget navn og ikon med gul TEST-stripe i fanen og på hjemskjermen.
function visTestmiljo() {
  if (!ER_TEST) return;
  document.getElementById('test-banner').hidden = false;
  document.title = 'SFO TEST';
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'SFO TEST');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', 'icons/test-apple-touch.png');
  document.querySelector('link[rel="icon"]')?.setAttribute('href', 'icons/test-192.png');
}

async function start() {
  visTestmiljo();
  for (const knapp of document.querySelectorAll('.fane')) {
    knapp.addEventListener('click', () => naviger(knapp.dataset.fane));
  }
  setInterval(oppdaterTid, 15000);
  // Etter hver registrering (inn, ut, fravær, angre …) tegnes skjermen på nytt.
  window.addEventListener('sfo:endret', oppfrisk);
  // Rødt banner øverst så lenge administratormodus er på. Når modusen slås av, tegnes skjermen på
  // nytt, så felt som krever administratorkode låses igjen.
  const adminBanner = document.getElementById('admin-banner');
  document.getElementById('admin-banner-avslutt').addEventListener('click', () => avsluttAdmin());
  window.addEventListener('sfo:admin', () => {
    adminBanner.hidden = !erAdmin();
    if (!erAdmin()) oppfrisk();
  });
  // Etter opplåsing: skjermer som viser initialene tegnes på nytt. Skjemaer beholder det som er skrevet.
  window.addEventListener('sfo:opplast', () => { if (['idag', 'andre', 'telling', 'mer'].includes(aktivFane)) oppfrisk(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') oppdaterTid();
  });

  try {
    await apneDb();
    if ((await hentInnstilling('dataversjon')) === undefined) await lagreInnstilling('dataversjon', DATAVERSJON);
    await beOmVedvarendeLagring();
    await slettGammelHistorikk();
  } catch (e) {
    visMelding(`Databasen kunne ikke åpnes: ${e.message}`, 'feil');
  }

  // Låseskjermen kommer før noe annet vises (K-71). Første gang velges kodene.
  await startTilgang();
  registrerServiceWorker();
  window.addEventListener('hashchange', visAdresse);
  await visAdresse();
}

start();
