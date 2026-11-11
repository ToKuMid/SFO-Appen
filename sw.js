// Service worker for SFO-appen.
// Oppgave: legge appens egne filer i hurtigbuffer slik at appen virker i flymodus (IF-01).
// Den rører ALDRI databasen (IndexedDB). Oppdateringer endrer derfor ikke data (IF-09).
//
// Ved ny versjon: øk APP_VERSJON her OG i src/versjon.js (en test sjekker at de er like).

const APP_VERSJON = '0.12.2';
const CACHE = `sfo-appen-${APP_VERSJON}`;

// Alle filer appen trenger. En test sjekker at listen stemmer med filene i repoet.
const FILER = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/app-192.png',
  './icons/app-512.png',
  './icons/app-maskable-512.png',
  './icons/app-apple-touch.png',
  './icons/skolelogo.png',
  './src/style.css',
  './src/app.js',
  './src/versjon.js',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILER.map((f) => new Request(f, { cache: 'reload' }))))
  );
  // Ny versjon venter til brukeren trykker «Oppdater», så en registrering midt i noe ikke avbrytes.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((navn) => Promise.all(navn.filter((n) => n.startsWith('sfo-appen-') && n !== CACHE).map((n) => caches.delete(n))))
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
