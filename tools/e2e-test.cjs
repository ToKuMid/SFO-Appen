// Nettlesertest av fase 1 (valgfri). Krever Playwright: npm install --no-save playwright && npx playwright install chromium
// Start appen først med «npm run serve», kjør så «npm run e2e».
// Tester: service worker, CSP (IF-02), testdata, eksport (K-60), K-62, gjenoppretting (K-61), ugyldig fil,
// Excel-mal og import (K-01, K-02), elevregister (K-03–K-05) og flymodus (IF-01).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const TESTDATA = path.join(__dirname, '..', 'testdata');
const SP = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sfo-e2e-'));
const URL_APP = process.env.SFO_URL || 'http://localhost:8080/';
const kode = require('./e2e-kode.cjs');
const ok = (c, m) => { if (!c) { console.log('FEIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(URL_APP);
  await kode.velgKoder(page);
  ok(true, 'første start: ansattkode og administratorkode valgt (K-71)');
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  ok(true, 'service worker aktiv');
  ok(await page.isVisible('#las[open]'), 'appen er låst etter omlasting');
  await kode.skriv(page, '1111');
  await page.waitForFunction(() => /Feil kode/.test(document.querySelector('.las-feil')?.textContent));
  ok(await page.isVisible('#las[open]'), 'feil kode låser ikke opp');
  await kode.skriv(page, kode.ANSATT);
  await kode.tittel(page, 'Initialer');
  ok((await page.inputValue('#las-initialer')) === 'KT', 'initialene fra forrige gang er foreslått');
  await page.fill('#las-initialer', '');
  await page.click('#las-fortsett');
  ok(/2–4 bokstaver/.test(await page.textContent('.las-feil')) && await page.isVisible('#las[open]'), 'kan ikke fortsette uten initialer (K-18)');
  await kode.initialer(page, 'kt');
  ok(true, 'riktig kode og initialer låser opp');
  // Skjult og synlig igjen (bytte av app, skjerm av) låser appen (K-71)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  ok(await page.isVisible('#las[open]'), 'appen låses når den skjules');
  await page.screenshot({ path: `${SP}/las.png` });
  await kode.lasOpp(page);

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
  await kode.admin(page);
  ok(true, 'utviklerverktøy krever administratorkode (K-72)');
  await page.click('#dialog button:text-is("Last inn testdata")');
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
  ok(!JSON.stringify(kopi).includes('kode-ansatt') && !JSON.stringify(kopi).includes('kode-admin'), 'kodene er ikke med i sikkerhetskopien');
  await page.waitForFunction(() => document.querySelector('#siste-sikkerhetskopi')?.textContent.includes('i dag'));
  ok(true, 'K-62 viser i dag etter eksport');

  // slett alt
  await apneTeknisk();
  await page.click('#slett-alt');
  await page.click('#dialog button:text-is("Slett alt")');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '0');
  ok(true, 'alle data slettet');

  // ugyldig fil
  fs.writeFileSync(`${SP}/feil.json`, '{"format":"noe","data":{}}');
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gjenopprett')]);
  await fc.setFiles(`${SP}/feil.json`);
  await page.waitForSelector('#dialog[open] >> text=Kan ikke gjenopprette');
  ok(true, 'ugyldig fil avvist');
  await page.click('#dialog button:text-is("Lukk")');

  // gjenopprett
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#gjenopprett')]);
  await fc.setFiles(sti);
  await page.waitForSelector('#dialog[open] >> text=Gjenopprette fra sikkerhetskopi?');
  await page.screenshot({ path: `${SP}/forhandsvisning.png` });
  await page.click('#dialog button:text-is("Erstatt alle data")');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '32');
  const hendEtter = await page.$$eval('.tall dd', d => d.map(x => x.textContent));
  ok(JSON.stringify(hendFoer) === JSON.stringify(hendEtter), `gjenopprettet likt: ${hendEtter}`);

  // ---------- Fase 2a: Excel-mal og import ----------
  await page.click('[data-fane=mer]');
  await apneTeknisk();
  await page.click('#slett-alt');
  await page.click('#dialog button:text-is("Slett alt")');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '0');

  const [mal] = await Promise.all([page.waitForEvent('download'), page.click('#hent-mal')]);
  const malSti = `${SP}/${mal.suggestedFilename()}`;
  await mal.saveAs(malSti);
  const { lesXlsx } = await import(path.join(__dirname, '..', 'src', 'import', 'xlsx.js'));
  const malBytes = fs.readFileSync(malSti);
  const malArk = await lesXlsx(malBytes.buffer.slice(malBytes.byteOffset, malBytes.byteOffset + malBytes.length));
  ok(mal.suggestedFilename() === 'SFO-elevliste-mal.xlsx' && malArk.ark[0].rader[0].celler[0] === 'Fornavn', 'tom Excel-mal kan lastes ned og leses');

  const importer = async (fil) => {
    const [v] = await Promise.all([page.waitForEvent('filechooser'), page.click('#importer')]);
    await v.setFiles(fil);
    await page.waitForSelector('#dialog[open]');
    return page.textContent('#dialog[open]');
  };
  let tekst = await importer(path.join(TESTDATA, 'fiktive-elever.xlsx'));
  if (process.env.DEBUG) console.log('DIALOG:', tekst);
  ok(/Importere elevlista\?/.test(tekst) && /Nyeelever32/.test(tekst.replace(/\s/g, '')), 'forhåndsvisning: 32 nye elever (K-01)');
  await page.screenshot({ path: `${SP}/import.png` });
  await page.click('#dialog button:text-is("Importer")');
  await page.waitForFunction(() => document.querySelector('.tall dd')?.textContent === '32');
  ok(true, 'import lagret 32 elever');

  tekst = await importer(path.join(TESTDATA, 'fiktive-elever.xlsx'));
  ok(/Ingen endringer/.test(tekst), 'samme fil igjen: ingen endringer, ingen duplikater (fase 2a-kriteriet)');
  await page.click('#dialog button:text-is("OK")');
  ok((await page.textContent('.tall dd')) === '32', 'fortsatt 32 elever');

  tekst = (await importer(path.join(TESTDATA, 'fiktive-elever-endret.xlsx'))).replace(/\s/g, '');
  ok(/Nyeelever1/.test(tekst) && /Oppdatert1/.test(tekst) && /Gåttoppettrinn1/.test(tekst) && /Deaktiveres1/.test(tekst), 'endret fil: 1 ny, 1 oppdatert, 1 opp et trinn, 1 deaktiveres (K-02)');
  await page.click('#dialog button:text-is("Importer")');
  await page.waitForTimeout(500);

  fs.writeFileSync(`${SP}/elever.csv`, 'Fornavn;Etternavn\nA;B');
  tekst = await importer(`${SP}/elever.csv`);
  ok(/Kan ikke importere/.test(tekst) && /ikke en Excel-fil/.test(tekst), 'fil som ikke er Excel avvises');
  await page.click('#dialog button:text-is("Lukk")');

  // ---------- Fase 2a: elevregister ----------
  await page.click('[data-fane=elever]');
  await page.waitForSelector('#elevliste');
  ok((await page.$$('#elevliste > li')).length === 32, 'Elever viser 32 aktive etter endret import');
  ok((await page.textContent('details.teknisk summary')).includes('Deaktiverte elever (1)'), 'én deaktivert elev vises for seg');
  await page.fill('#sok', 'nyhilde');
  ok((await page.$$('#elevliste > li:not([hidden])')).length === 1, 'søk finner elev');

  await page.click('#ny-elev');
  await page.waitForSelector('#lagre-elev');
  await page.click('#lagre-elev');
  await page.waitForSelector('.feilboks:not([hidden])');
  const feiltekst = await page.textContent('.feilboks');
  ok(/Fornavn mangler/.test(feiltekst) && /ingen SFO-dager/.test(feiltekst), 'skjemaet viser feil før lagring');
  await page.fill('#fornavn', 'Prøve');
  await page.fill('#etternavn', 'Personsen');
  await page.selectOption('#trinn', '4');
  const grupper = await page.$$eval('#skolegruppe option', (o) => o.map((x) => x.value).filter(Boolean));
  ok(JSON.stringify(grupper) === JSON.stringify(['Gruppe 2 oppe', 'Gruppe 2 nede']), '4. trinn gir bare Gruppe 2 som valg (K-05)');
  await page.selectOption('#skolegruppe', 'Gruppe 2 nede');
  await page.click('.dagvalg:nth-child(1)');
  await page.click('.dagvalg:nth-child(3)');
  await page.fill('#alene', '15:30');
  await page.screenshot({ path: `${SP}/skjema.png`, fullPage: true });
  await page.click('#lagre-elev');
  await page.waitForSelector('#elevliste');
  ok((await page.$$('#elevliste > li')).length === 33, 'ny elev lagt til (K-03)');
  const rad = await page.$('#elevliste a:has-text("Prøve Personsen")');
  ok(rad && /Går alene 15\.30/.test(await rad.textContent()), 'ny elev viser fast avtale som brikke (K-41)');

  // Lås og lås opp: administratormodus er av. Ansatte kan endre avtaler, ikke navn (K-72)
  await page.click('[data-fane=mer]');
  await page.click('#las-naa');
  await kode.lasOpp(page);
  await page.click('[data-fane=elever]');
  await page.waitForSelector('#elevliste');
  await page.fill('#sok', 'nyhilde');
  await page.click('#elevliste a:has-text("Nyhilde")');
  await page.waitForSelector('#rediger');
  await page.click('#rediger');
  await page.waitForSelector('#merknad');
  ok((await page.inputValue('#fornavn')) === 'Nyhilde', 'redigering viser lagrede verdier');
  ok(await page.isDisabled('#fornavn') && !(await page.isDisabled('#merknad')) && !(await page.$('#deaktiver')), 'uten administratorkode: navn låst, merknad åpen, ingen deaktivering');
  await page.fill('#merknad', 'Hentes av tante på torsdager');
  await page.click('#lagre-elev');
  await page.waitForSelector('#kort-status');
  await page.click('[data-fane=elever]');
  await page.waitForSelector('#elevliste');
  ok(/Merknad/.test(await page.textContent('#elevliste a:has-text("Nyhilde")')), 'redigert elev lagret med merknad (K-03, K-40)');

  await page.click('#elevliste a:has-text("Prøve Personsen")');
  await page.waitForSelector('#rediger');
  await page.click('#rediger');
  await page.click('#admin-las-opp');
  await kode.admin(page);
  await page.waitForSelector('#deaktiver');
  ok(!(await page.isDisabled('#fornavn')), 'med administratorkode kan navn endres');
  await page.click('#deaktiver');
  await page.click('#dialog button:text-is("Deaktiver")');
  await page.waitForSelector('#elevliste');
  ok((await page.$$('#elevliste > li')).length === 32 && (await page.textContent('details.teknisk summary')).includes('(2)'), 'elev deaktivert, historikk beholdt (K-03)');

  // elever fanen
  await page.click('[data-fane=elever]');
  await page.waitForSelector('#elevliste');
  ok((await page.$$('#elevliste > li')).length === 32, 'elevlisten viser 32');
  await page.screenshot({ path: `${SP}/elever.png` });

  // flymodus
  await ctx.setOffline(true);
  await page.reload();
  await kode.lasOpp(page);
  await page.waitForSelector('#elevliste');
  ok((await page.$$('#elevliste > li')).length === 32, 'virker i flymodus etter omlasting, data består');
  await page.click('[data-fane=mer]');
  await apneTeknisk();
  await page.waitForSelector('.sjekk');
  await page.screenshot({ path: `${SP}/mer.png`, fullPage: true });

  const uventet = logs.filter(l => !/Content Security Policy|connect-src|Refused to connect|Failed to fetch/i.test(l));
  console.log('Konsoll (forventet CSP-blokk filtrert bort):', uventet.length ? uventet : 'ingen');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
