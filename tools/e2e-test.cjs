// Nettlesertest av fase 1 (valgfri). Krever Playwright: npm install --no-save playwright && npx playwright install chromium
// Start appen først med «npm run serve», kjør så «npm run e2e».
// Tester: service worker, CSP (IF-02), testdata, eksport (K-60), K-62, gjenoppretting (K-61), ugyldig fil og flymodus (IF-01).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SP = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sfo-e2e-'));
const URL_APP = process.env.SFO_URL || 'http://localhost:8080/';
const ok = (c, m) => { if (!c) { console.log('FEIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(URL_APP);
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  ok(true, 'service worker aktiv');

  const apneTeknisk = async () => { await page.waitForSelector('#teknisk'); if (!(await page.$eval('#teknisk', (d) => d.open))) await page.click('#teknisk summary'); };
  await page.click('[data-fane=mer]');
  await apneTeknisk();
  await page.waitForSelector('.sjekk');
  await page.waitForFunction(() => [...document.querySelectorAll('.sjekk')].some(li => li.textContent.includes('IF-02')));
  const sjekker = await page.$$eval('.sjekk', ls => ls.map(l => l.className + ' | ' + l.textContent));
  console.log(sjekker.join('\n'));
  ok(sjekker.some(s => s.includes('sjekk-ok') && s.includes('IF-02')), 'nettverk blokkert av CSP');
  ok((await page.textContent('#siste-sikkerhetskopi')).includes('aldri'), 'K-62 viser aldri tatt');

  // testdata
  await apneTeknisk();
  await page.click('#last-testdata');
  await page.click('dialog >> text=Last inn testdata');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '32');
  ok(true, '32 fiktive elever lastet');
  const hendFoer = await page.$$eval('.tall dd', d => d.map(x => x.textContent));

  // eksport
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#eksporter')]);
  const sti = `${SP}/${dl.suggestedFilename()}`;
  await dl.saveAs(sti);
  ok(/^SFO-backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'filnavn ' + dl.suggestedFilename());
  const kopi = JSON.parse(fs.readFileSync(sti, 'utf8'));
  ok(kopi.data.elever.length === 32 && kopi.format === 'sfo-appen-sikkerhetskopi', 'eksportfil inneholder 32 elever');
  await page.waitForFunction(() => document.querySelector('#siste-sikkerhetskopi')?.textContent.includes('i dag'));
  ok(true, 'K-62 viser i dag etter eksport');

  // slett alt
  await apneTeknisk();
  await page.click('#slett-alt');
  await page.click('dialog >> text=Slett alt');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '0');
  ok(true, 'alle data slettet');

  // ugyldig fil
  fs.writeFileSync(`${SP}/feil.json`, '{"format":"noe","data":{}}');
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gjenopprett')]);
  await fc.setFiles(`${SP}/feil.json`);
  await page.waitForSelector('dialog[open] >> text=Kan ikke gjenopprette');
  ok(true, 'ugyldig fil avvist');
  await page.click('dialog >> text=Lukk');

  // gjenopprett
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gjenopprett')]);
  await fc.setFiles(sti);
  await page.waitForSelector('dialog[open] >> text=Gjenopprette fra sikkerhetskopi?');
  await page.screenshot({ path: `${SP}/forhandsvisning.png` });
  await page.click('dialog >> text=Erstatt alle data');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '32');
  const hendEtter = await page.$$eval('.tall dd', d => d.map(x => x.textContent));
  ok(JSON.stringify(hendFoer) === JSON.stringify(hendEtter), `gjenopprettet likt: ${hendEtter}`);

  // elever fanen
  await page.click('[data-fane=elever]');
  await page.waitForSelector('.liste-rad');
  ok((await page.$$('.liste-rad')).length === 32, 'elevlisten viser 32');
  await page.screenshot({ path: `${SP}/elever.png` });

  // flymodus
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.liste-rad');
  ok((await page.$$('.liste-rad')).length === 32, 'virker i flymodus etter omlasting, data består');
  await page.click('[data-fane=mer]');
  await apneTeknisk();
  await page.waitForSelector('.sjekk');
  await page.screenshot({ path: `${SP}/mer.png`, fullPage: true });

  const uventet = logs.filter(l => !/Content Security Policy|connect-src|Refused to connect|Failed to fetch/i.test(l));
  console.log('Konsoll (forventet CSP-blokk filtrert bort):', uventet.length ? uventet : 'ingen');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
