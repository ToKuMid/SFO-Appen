// Service worker for SFO-appen.
// Oppgave: legge appens egne filer i hurtigbuffer slik at appen virker i flymodus (IF-01).
// Den rører ALDRI databasen (IndexedDB). Oppdateringer endrer derfor ikke data (IF-09).
//
// Ved ny versjon: øk APP_VERSJON her OG i src/versjon.js (en test sjekker at de er like).

const APP_VERSJON = '0.12.4';
// Testmiljøet (…/SFO-Appen-test/) ligger på samme domene, og har derfor eget navn på hurtigbufferet.
const PREFIKS = /\/sfo-appen-test\//i.test(self.location.pathname) ? 'sfo-appen-test-' : 'sfo-appen-';
const CACHE = `${PREFIKS}${APP_VERSJON}`;
// Gamle versjoner av DETTE miljøet (prefiks fulgt av versjonsnummer), aldri det andre miljøets.
const egenGammel = (n) => n.startsWith(PREFIKS) && /^\d/.test(n.slice(PREFIKS.length)) && n !== CACHE;

// Alle filer appen trenger. En test sjekker at listen stemmer med filene i repoet.
const FILER = [
  './',
  './index.html',
  './manifest.webmanifest',
  './manifest-test.webmanifest',
  './icons/app-192.png',
  './icons/app-512.png',
  './icons/app-maskable-512.png',
  './icons/app-apple-touch.png',
  './icons/test-192.png',
  './icons/test-512.png',
  './icons/test-maskable-512.png',
  './icons/test-apple-touch.png',
  './icons/skolelogo.png',
  './src/style.css',
  './src/app.js',
  './src/versjon.js',
  './src/miljo.js',
  './src/db.js',
  './src/backup.js',
  './src/filer.js',
  './src/dato.js',
  './src/dom.js',
  './src/kode.js',
  './src/kryptering.js',
  './src/tilgang.js',
  './src/ui/las.js',
  './src/plattform.js',
  './src/ui/mer.js',
  './src/ui/felles.js',
  './src/ui/skjermer.js',
  './src/ui/elever.js',
  './src/ui/elevkort.js',
  './src/ui/telling.js',
  './src/ui/handlinger.js',
  './src/ui/sikkerhetskopi.js',
  './src/model/status.js',
  './src/model/rapport.js',
  './src/ui/rapport.js',
  './src/ui/rapportfelles.js',
  './src/ui/elevrapport.js',
  './src/ui/avviksrapport.js',
  './src/dag.js',
  './src/sletting.js',
  './src/model/sletting.js',
  './src/ui/import.js',
  './src/model/elev.js',
  './src/import/xlsx.js',
  './src/import/elevliste.js',
  './fonts/fraunces-latin-600-normal.woff2',
  './fonts/work-sans-latin-400-normal.woff2',
  './fonts/work-sans-latin-500-normal.woff2',
  './fonts/work-sans-latin-600-normal.woff2',
  './src/dev/testdata.js',
];

// Hver fil hentes med versjonsnummeret i adressen (?v=0.12.4). GitHub Pages kan i noen minutter etter
// en publisering sende ut gamle filer fra mellomlageret sitt. En ny adresse tvinger fram de nye filene,
// slik at en ny versjon aldri blir lagret med gamle filer. Filene lagres under vanlig adresse.
const medVersjon = (f) => `${f}${f.includes('?') ? '&' : '?'}v=${encodeURIComponent(APP_VERSJON)}`;

async function hentFil(f) {
  const svar = await fetch(new Request(medVersjon(f), { cache: 'reload' }));
  if (!svar.ok) throw new Error(`${f}: ${svar.status}`);
  return svar;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const svar = await Promise.all(FILER.map(hentFil));
    // Ekstra kontroll: versjonsfila må ha samme versjon som service workeren. Ellers avbrytes
    // installasjonen, og nettleseren prøver igjen neste gang appen åpnes.
    const versjon = await svar[FILER.indexOf('./src/versjon.js')].clone().text();
    if (!versjon.includes(`'${APP_VERSJON}'`)) throw new Error('Fikk gammel versjon av appens filer. Prøver igjen senere.');
    const cache = await caches.open(CACHE);
    await Promise.all(FILER.map((f, i) => cache.put(f, svar[i])));
  })());
  // Ny versjon venter til brukeren trykker «Oppdater», så en registrering midt i noe ikke avbrytes.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((navn) => Promise.all(navn.filter(egenGammel).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'HOPP_OVER_VENTING') self.skipWaiting();
});

// Cache først: appen starter alltid fra hurtigbufferen, også uten nett.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((treff) => {
      if (treff) return treff;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return fetch(req);
    })
  );
});
