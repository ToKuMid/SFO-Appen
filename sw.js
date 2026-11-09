// Service worker for SFO-appen.
// Oppgave: legge appens egne filer i hurtigbuffer slik at appen virker i flymodus (IF-01).
// Den rører ALDRI databasen (IndexedDB). Oppdateringer endrer derfor ikke data (IF-09).
//
// Ved ny versjon: øk APP_VERSJON her OG i src/versjon.js (en test sjekker at de er like).

const APP_VERSJON = '0.3.0';
const CACHE = `sfo-appen-${APP_VERSJON}`;

// Alle filer appen trenger. En test sjekker at listen stemmer med filene i repoet.
const FILER = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './src/style.css',
  './src/app.js',
  './src/versjon.js',
  './src/db.js',
  './src/backup.js',
  './src/filer.js',
  './src/dato.js',
  './src/dom.js',
  './src/plattform.js',
  './src/ui/mer.js',
  './src/ui/felles.js',
  './src/ui/skjermer.js',
  './src/ui/elever.js',
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
