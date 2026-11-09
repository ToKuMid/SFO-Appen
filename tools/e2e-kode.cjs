// Hjelpere for nettlesertestene: koder for låseskjermen (K-71–K-73). Bare fiktive testkoder.
const ANSATT = '2580';
const ADMIN = '739164';

async function skriv(page, kode) {
  for (const d of kode) await page.click(`#las[open] button[data-siffer="${d}"]`);
}
async function tittel(page, tekst) {
  await page.waitForFunction((t) => document.querySelector('#las[open] #las-tittel')?.textContent === t, tekst);
}
/** Initialer etter koden (K-18). Uten verdi brukes forslaget (forrige initialer). */
async function initialer(page, verdi) {
  await tittel(page, 'Initialer');
  if (verdi !== undefined) await page.fill('#las-initialer', verdi);
  await page.click('#las-fortsett');
  await page.waitForSelector('#las', { state: 'hidden' });
}
/** Første start: velg ansattkode og administratorkode. */
async function velgKoder(page, init = 'KT') {
  await tittel(page, 'Velg kode for ansatte');
  await skriv(page, ANSATT);
  await tittel(page, 'Gjenta koden');
  await skriv(page, ANSATT);
  await tittel(page, 'Velg administratorkode');
  await skriv(page, ADMIN);
  await tittel(page, 'Gjenta koden');
  await skriv(page, ADMIN);
  await initialer(page, init);
}
/** Lås opp med ansattkoden, og bekreft initialene. */
async function lasOpp(page, init) {
  await tittel(page, 'SFO-appen');
  await skriv(page, ANSATT);
  await initialer(page, init);
}
/** Skriv administratorkoden når appen ber om den. */
async function admin(page) {
  await tittel(page, 'Administratorkode');
  await skriv(page, ADMIN);
  await page.waitForSelector('#las', { state: 'hidden' });
}
module.exports = { ANSATT, ADMIN, skriv, tittel, initialer, velgKoder, lasOpp, admin };
