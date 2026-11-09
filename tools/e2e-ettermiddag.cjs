// Nettlesertest av fase 2b/2c: en hel fiktiv ettermiddag fra 14.45 til stengetid.
// Krever Playwright (se README). Start appen med «npm run serve», kjør så «npm run e2e:ettermiddag».
// Klokka i nettleseren styres av testen, så varselet kl. 15.00 kan testes uten å vente.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL_APP = process.env.SFO_URL || 'http://localhost:8080/';
const SP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sfo-ettermiddag-'));
const kode = require('./e2e-kode.cjs');
const ok = (c, m) => { if (!c) { console.log('FEIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
const tall = (s) => Number(String(s).trim());

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const feil = [];
  page.on('pageerror', (e) => feil.push(e.message));
  // Mandag 9. november 2026 kl. 14.40
  await page.clock.install({ time: new Date(2026, 10, 9, 14, 40) });
  await page.goto(`${URL_APP}#mer`);
  const knapp = (tekst) => page.click(`#dialog button:text-is("${tekst}")`);

  // Fiktive testdata
  await kode.velgKoder(page);
  await page.waitForSelector('#teknisk');
  await page.click('#teknisk summary');
  await page.click('#last-testdata');
  await kode.admin(page);
  await knapp('Last inn testdata');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '32');

  // 14.45: I dag – ingen inne, lenke til Andre
  await page.clock.fastForward('05:00');
  await page.click('[data-fane=idag]');
  await page.waitForSelector('#antall-inne');
  ok(tall(await page.textContent('#antall-inne')) === 0, 'I dag: 0 inne ved start');
  const forventetTekst = await page.textContent('.hovedtall-side');
  const forventet = Number(forventetTekst.match(/av (\d+) forventet/)[1]);
  ok(forventet > 5, `I dag: ${forventet} forventet etter ukeplan (K-10)`);
  ok(await page.isVisible('.infolinje'), 'før varseltid: lenke «Sjekk inn under Andre» i stedet for varsel');
  await page.screenshot({ path: `${SP}/1-idag-start.png` });

  // Andre: sjekk inn alle unntatt tre, ett meldt fravær
  await page.click('[data-fane=andre]');
  await page.waitForSelector('#forventet');
  for (let i = 0; i < forventet - 3; i++) {
    await page.click('#forventet li:first-child button[data-handling=inn]');
    await page.waitForFunction((n) => document.querySelectorAll('#forventet li').length === n, forventet - i - 1);
  }
  ok((await page.$$('#forventet li')).length === 3, 'Andre: tre forventede igjen etter innsjekk (K-14)');
  await page.click('#forventet li:first-child button[data-handling=fravaer]');
  await page.waitForSelector('#dialog[open] input[name=fravaertype]');
  ok(/Registreres av KT/.test(await page.textContent('#fravaer-initialer')), 'fravær får initialene fra opplåsingen (K-18)');
  await knapp('Lagre fravær');
  await page.waitForSelector('#fravaer li');
  ok(/meldt fravær · KT/.test(await page.textContent('#fravaer')), 'meldt fravær med initialer vises under Fravær (K-11, K-18)');
  await page.screenshot({ path: `${SP}/2-andre.png` });

  // 15.01: varsel på I dag
  await page.click('[data-fane=idag]');
  await page.waitForSelector('#antall-inne');
  ok(!(await page.isVisible('#varsel')), 'ingen varsel før 15.00');
  await page.clock.fastForward('16:00');
  await page.waitForSelector('#varsel', { timeout: 5000 });
  ok(/2 barn er ikke registrert etter 15\.00/.test(await page.textContent('#varsel')), 'kl. 15.01: varsel for 2 uregistrerte (K-16)');
  ok(tall(await page.textContent('#antall-inne')) === forventet - 3, `I dag: ${forventet - 3} inne (K-12)`);
  await page.screenshot({ path: `${SP}/3-idag-varsel.png` });

  await page.click('#varsel-liste li:first-child button[data-handling=inn]');
  await page.waitForFunction(() => document.querySelectorAll('#varsel-liste li').length === 1);
  ok(true, 'sjekk inn fra varselet');

  // Sjekk ut og angre fra meldingen (K-15)
  const forUt = tall(await page.textContent('#antall-inne'));
  await page.click('#inne-liste li:first-child button[data-handling=ut]');
  await page.waitForFunction((n) => document.querySelector('#antall-inne')?.textContent === String(n), forUt - 1);
  await page.click('#melding .melding-knapp');
  await page.waitForFunction((n) => document.querySelector('#antall-inne')?.textContent === String(n), forUt);
  ok(true, 'utsjekk kan angres fra meldingen (K-15)');

  // En annen ansatt tar over: bytt initialer på I dag (K-18)
  await page.click('[data-fane=idag]');
  await page.click('#initialer');
  await kode.initialer(page, 'mh');
  await page.waitForFunction(() => document.querySelector('#initialer')?.textContent === 'MH');
  ok(true, 'initialene kan byttes på I dag');

  // Telling med ett avvik (K-30–K-32)
  await page.click('[data-fane=telling]');
  await page.click('#start-telling');
  await page.waitForSelector('#telling-liste');
  const bokser = await page.$$('#telling-liste input[type=checkbox]');
  for (const b of bokser.slice(1)) await b.check();
  ok(/1 mangler/.test(await page.textContent('#telling-mangler')), 'telling viser 1 mangler');
  ok((await page.textContent('#avslutt-telling')).includes('Avslutt med 1 avvik'), 'knappen sier «Avslutt med 1 avvik»');
  await page.screenshot({ path: `${SP}/4-telling.png` });
  ok((await page.textContent('#telling-initialer')) === 'MH', 'tellingen viser hvem som teller');
  await page.click('#avslutt-telling');
  await page.waitForSelector('#avvik-kommentar');
  await page.fill('#avvik-kommentar', 'Var på do');
  await knapp('Avslutt telling');
  await page.waitForSelector('#tellinger li');
  const tellingTekst = await page.textContent('#tellinger');
  ok(/1 avvik/.test(tellingTekst) && /MH/.test(tellingTekst) && /Kommentar: Var på do/.test(tellingTekst), 'telling lagret med avvik, initialer og kommentar (K-31, K-32)');
  await page.screenshot({ path: `${SP}/5-telling-resultat.png` });

  // Elevkort: rett tidspunkt (K-15)
  await page.click('[data-fane=idag]');
  await page.click('#inne-liste li:first-child a.rad-lenke');
  await page.waitForSelector('#kort-status');
  ok(/Inne siden/.test(await page.textContent('#kort-status')), 'elevkortet viser «Inne siden …»');
  await page.click('#rett-tid');
  await page.fill('#rett-ny-tid', '14:50');
  await knapp('Lagre');
  await page.waitForFunction(() => /rettet til 14\.50/.test(document.querySelector('#historikk')?.textContent ?? ''));
  ok(/Inne siden 14\.50/.test(await page.textContent('#kort-status')), 'rettet tidspunkt vises, gammelt står i historikken som rettet');
  await page.screenshot({ path: `${SP}/6-elevkort.png`, fullPage: true });
  await page.click('#kort-ut');
  await page.waitForFunction(() => /Sjekket ut/.test(document.querySelector('#kort-status')?.textContent ?? ''));
  ok(true, 'sjekk ut fra elevkortet');

  // Flere inn og ut samme dag (K-17)
  await page.click('#kort-inn');
  await page.waitForFunction(() => /Inne siden/.test(document.querySelector('#kort-status')?.textContent ?? ''));
  ok((await page.$$('#historikk li')).length >= 4, 'inn igjen etter ut samme dag (K-17)');

  // 16.30: alle hentes, dagsavslutning (K-20)
  await page.clock.fastForward('01:30:00');
  await page.click('.tilbake');
  await page.waitForSelector('#antall-inne');
  while (await page.$('#inne-liste li button[data-handling=ut]')) {
    const n = tall(await page.textContent('#antall-inne'));
    await page.click('#inne-liste li:first-child button[data-handling=ut]');
    await page.waitForFunction((m) => document.querySelector('#antall-inne')?.textContent === String(m), n - 1);
  }
  ok(tall(await page.textContent('#antall-inne')) === 0, 'alle sjekket ut ved stengetid');
  await page.click('#avslutt-dagen');
  const avslutt = await page.textContent('#dialog[open]');
  ok(/Ingen barn står som inne/.test(avslutt) && /1 forventet ble aldri registrert/.test(avslutt) && /sikkerhetskopi/i.test(avslutt), 'dagsavslutning: ingen inne, 1 uregistrert, påminnelse om sikkerhetskopi (K-20)');
  await page.screenshot({ path: `${SP}/7-avslutt.png` });

  // Fra elevkortet: «Ikke SFO i dag» og fravær sender tilbake til I dag
  await knapp('Lukk');
  await page.click('[data-fane=andre]');
  await page.click('#forventet li:first-child a.rad-lenke');
  await page.click('#kort-ikke-sfo');
  await page.waitForFunction(() => location.hash === '#idag' && !!document.querySelector('#antall-inne'));
  ok(true, '«Ikke SFO i dag» på elevkortet sender tilbake til I dag');
  await page.click('#melding .melding-knapp');
  await page.click('[data-fane=andre]');
  await page.waitForSelector('#forventet li');
  ok(true, '«Angre» i meldingen fjerner unntaket igjen');
  await page.click('#forventet li:first-child a.rad-lenke');
  await page.click('#kort-fravaer');
  await knapp('Lagre fravær');
  await page.waitForFunction(() => location.hash === '#idag' && !!document.querySelector('#antall-inne'));
  ok(/meldt fravær/.test(await page.textContent('#melding')), 'fravær på elevkortet sender tilbake til I dag, med melding');

  // Grupperapport for dagen (K-50)
  await page.click('[data-fane=mer]');
  await page.click('#apne-grupperapport');
  await page.click('button[data-periode=dag]');
  await page.waitForSelector('#rapport-sammendrag');
  const rapport = (await page.textContent('#rapport')).replace(/\s+/g, ' ');
  ok(/Tellinger med avvik\s*1/.test(rapport) && /EliD 1\.trinn/.test(rapport) && !/Elias Demoberg/.test(rapport) && /Var på do/.test(rapport), 'grupperapport for i dag viser avviket med forkortet navn og kommentar');
  ok(/Meldt fravær\s*2/.test(rapport) && /Skrevet ut/.test(rapport), 'grupperapport viser fravær og utskriftsdato');
  await page.screenshot({ path: `${SP}/8-rapport.png`, fullPage: true });

  // Elevrapport for Elias (K-51): velg fra Mer, søk og velg elev
  await page.click('[data-fane=mer]');
  await page.click('#apne-elevrapport');
  await page.waitForSelector('#rapport-elevliste');
  await page.fill('#rapport-sok', 'elias');
  const synlige = await page.$$eval('#rapport-elevliste li:not([hidden])', (l) => l.length);
  ok(synlige === 1, 'søk i elevvalget viser bare Elias');
  await page.click('#rapport-elevliste li:not([hidden]) a');
  await page.waitForSelector('#rapport-navn');
  ok(/#rapport\/elev\//.test(await page.evaluate(() => location.hash)), 'valgt elev ligger i adressen');
  ok(/Elias Demoberg/.test(await page.textContent('#valgt-elev')), 'fullt navn vises i valget på skjermen');
  const elevR = (await page.textContent('#rapport')).replace(/\s+/g, ' ');
  ok(/EliD 1\.trinn/.test(elevR) && !/Elias|Demoberg/.test(elevR), 'elevrapporten bruker forkortet navn');
  ok(/Manglet ved telling\s*1/.test(elevR) && /Var på do/.test(elevR), 'elevrapporten viser tellingen der eleven manglet');
  await page.screenshot({ path: `${SP}/9-elevrapport.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: `${SP}/9-elevrapport-utskrift.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.click('#bytt-elev');
  await page.waitForSelector('#rapport-elevliste');
  ok(true, '«Bytt elev» går tilbake til elevvalget');

  // Avviksrapport for i dag (K-54)
  await page.click('[data-fane=mer]');
  await page.click('#apne-avviksrapport');
  await page.click('button[data-periode=dag]');
  await page.waitForSelector('#avvik-telling');
  const avvikR = (await page.textContent('#rapport')).replace(/\s+/g, ' ');
  ok(/Avvik ved telling \(1\)/.test(avvikR) && /EliD 1\.trinn/.test(avvikR) && /Var på do/.test(avvikR) && !/Elias|Demoberg/.test(avvikR), 'avviksrapporten viser tellingsavviket med forkortet navn');
  ok(/Gjennomgått av/.test(avvikR) && !/Meldt fravær/.test(avvikR), 'avviksrapporten har signaturlinje og ikke meldt fravær');
  await page.screenshot({ path: `${SP}/10-avviksrapport.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: `${SP}/10-avviksrapport-utskrift.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  ok(feil.length === 0, `ingen JavaScript-feil${feil.length ? `: ${feil.join(' | ')}` : ''}`);
  console.log(`Skjermbilder: ${SP}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
