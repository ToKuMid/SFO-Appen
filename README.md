# SFO-appen

En webapp (PWA) for SFO som viser hvilke barn som er forventet, inne, sjekket ut eller borte, og som dokumenterer tellinger. Appen kjører på SFO-gruppens telefon. **Alle data lagres bare på telefonen, og appen sender ingen data over nett.**

Krav og plan står i dokumentet «SFO-appen – kravspesifikasjon og fremdriftsplan». Personvernet er vurdert i «DPIA – SFO-appen».

## Status

**Fase 1 (grunnmur) er bygget:** PWA-skall, lokal database med datamodell og versjon, sikkerhetsregel som blokkerer nettverk, og sikkerhetskopi med eksport og gjenoppretting.

| Krav | Hva | Status |
| --- | --- | --- |
| IF-01 | Virker i flymodus | Bygget, testet i Chrome |
| IF-02 | Sikkerhetsregel stopper all nettverkstrafikk | Bygget, testet i Chrome |
| IF-03 | Ingen eksterne ressurser | Bygget, sjekkes av `npm test` |
| IF-09 | Oppdateringer endrer aldri data | Service worker rører ikke databasen. Ny versjon tas i bruk først når noen trykker «Oppdater». |
| K-60 | Eksportere sikkerhetskopi | Bygget |
| K-61 | Gjenopprette med forhåndsvisning | Bygget |
| K-62 | Dager siden siste sikkerhetskopi | Bygget (lagt inn tidlig, egentlig fase 2c) |

**Fase 2b og 2c (versjon 0.4.0) er bygget:** den daglige flyten, varsel og telling, med layout og flyt som i mockupen.

| Krav | Hva | Hvor i appen |
| --- | --- | --- |
| K-10, K-19 | Ny dag og forventede fra ukeplanen, unntak for én dag | Automatisk. Unntak på elevkortet, og «Ikke SFO i dag» nederst på Andre. |
| K-11 til K-13 | Statuser, hovedliste med teller og egen liste for resten | I dag (inne), Andre (forventet, sjekket ut, fravær, ikke SFO i dag) |
| K-14, K-17 | Inn og ut med ett trykk, flere ganger samme dag | Knapper i listene og på elevkortet |
| K-15 | Angre og rette tidspunkt | «Angre» i meldingen etter hver handling, i listene og på elevkortet. «Rett tidspunkt» på elevkortet. Historikken viser angrede og rettede registreringer. |
| K-16 | Varsel etter varseltidspunktet | Gul boks øverst på I dag. Kommer av seg selv når appen står åpen. |
| K-18 | Valgfrie initialer | Skrives én gang i feltet «Initialer» på I dag og brukes resten av dagen. Kan endres i fravær og telling. |
| K-20 | Dagsavslutning | «Avslutt dagen» nederst på I dag |
| K-30 til K-32 | Telling med avhuking, resultat og avvik med kommentar | Telling-fanen |

Status lagres aldri. Den regnes ut fra hendelsene i `src/model/status.js`, som har egne tester i `tests/status.test.js`.

**Fase 2a (versjon 0.3.0) er bygget:** elevregister og import fra Excel.

| Krav | Hva | Status |
| --- | --- | --- |
| K-01 | Import fra Excel-malen med forhåndsvisning og feilmeldinger | Bygget. En fil med feil lagrer ingenting, og feilene vises med radnummer. |
| K-02 | Ny import oppdaterer, legger til og deaktiverer | Bygget. Elever kobles på navn og trinn, også når de har gått opp et trinn. Ved navnelikhet velger den ansatte. |
| K-03 | Legge til, redigere og deaktivere elever | Bygget (Elever-fanen) |
| K-04 | Ukeplan per elev | Bygget |
| K-05 | Trinn og skolegruppe, og at de passer sammen | Bygget |
| K-40, K-41 | Faste avtaler og merknad med påminnelse | Kan redigeres på eleven. Brikkene vises i listene. |

Excel-filer leses og skrives av appens egen kode (`src/import/xlsx.js`), ikke av SheetJS. SheetJS kunne ikke hentes fra nett, og en egen, liten leser gir færre tredjepartsavhengigheter. Den er testet mot filer fra Excel-malen, openpyxl og LibreOffice.

**Versjon 0.2.0** har utseendet fra mockupen: farger, skrifttypene Fraunces og Work Sans, stor overskrift på hver skjerm og faner med ikoner. Appen har både lys og mørk variant og følger telefonens innstilling.

I dag viser hvor mange barn som er forventet etter ukeplanen. Andre og Telling er tomme til fase 2b og 2c. Under Mer kan varseltidspunktet (K-16) allerede velges.

## Regel nummer én: ingen ekte elevdata i repoet

Repoet er offentlig. Ekte elevlister, sikkerhetskopier og rapporter skal **aldri** hit (IF-04, DPIA tiltak T6).

- `.gitignore` holder ute `.xlsx`, `.csv`, `.pdf` og `SFO-backup-*.json`.
- `tools/hooks/pre-commit` stopper en commit som inneholder slike filer. Slå den på én gang med `npm run hooks`.
- Bare fiktive testdata i `testdata/`. Navnene der er oppdiktet.

## Mappestruktur

```
index.html            – siden, med sikkerhetsregelen (CSP)
manifest.webmanifest  – navn og ikon for hjemskjermen
sw.js                 – service worker: appens filer i hurtigbuffer
src/app.js            – oppstart, faner og oppdatering
src/db.js             – database, tabeller og migrering
src/backup.js         – sikkerhetskopi: bygge, kontrollere, oppgradere
src/model/elev.js     – regler for elever: trinn, skolegrupper, ukedager, klokkeslett
src/import/xlsx.js    – leser og skriver Excel-filer (.xlsx)
src/import/elevliste.js – import av elevlista: kontroll, kobling og endringsliste
src/filer.js          – lagre og åpne filer (delingsark eller nedlasting)
src/plattform.js      – teknisk test av telefonen
src/dato.js, dom.js   – hjelpere
src/ui/               – skjermbildene (felles.js, skjermer.js, elever.js, import.js, mer.js)
src/dev/testdata.js   – fiktive testdata
icons/                – app-ikoner (fargene er mockupens antatte palett til Erdvias farger er klare)
fonts/                – skrifttypene Fraunces og Work Sans (SIL Open Font License, se OFL-filene)
tests/                – automatiske tester (npm test)
tools/                – lokal server, testdata, e2e-test, git-hook
vendor/               – tredjepartsbiblioteker (ingen i bruk nå)
testdata/             – fiktiv sikkerhetskopi og fiktive elevlister i Excel
```

## Kjøre på PC-en

Krever Node.js 20 eller nyere. Ingen pakker må installeres.

```
npm test          # automatiske tester
npm run serve     # appen på http://localhost:8080
npm run testdata  # lager de fiktive testfilene i testdata/ på nytt
```

Valgfri nettlesertest (installerer Playwright midlertidig):

```
npm install --no-save playwright
npx playwright install chromium
npm run serve     # i ett vindu
npm run e2e       # i et annet: sikkerhetskopi, import og elevregister
npm run e2e:ettermiddag  # en hel fiktiv ettermiddag fra 14.45 til stengetid
```

## Publisere på GitHub Pages

Service worker krever https, så telefonen må hente appen fra GitHub Pages (ikke fra PC-en).

1. Lag et nytt **offentlig** repo på GitHub, for eksempel `sfo-appen`. Slå på tofaktorinnlogging på kontoen.
2. Last opp innholdet i denne mappen (ikke `node_modules`):
   ```
   git init
   npm run hooks
   git add .
   git commit -m "Fase 1: grunnmur"
   git branch -M main
   git remote add origin https://github.com/<brukernavn>/sfo-appen.git
   git push -u origin main
   ```
3. På GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, velg `main` og `/ (root)`, trykk Save.
4. Etter et minutt ligger appen på `https://<brukernavn>.github.io/sfo-appen/`.
5. Anbefalt: **Settings → Branches → Add rule** for `main` med «Require a pull request before merging», slik at ingen endrer koden uten at det synes (kravspesifikasjonen kap. 15).

## Installere på testtelefonen (Android)

1. Åpne adressen fra steg 4 i Chrome.
2. Meny (⋮) → **Installer app** eller **Legg til på startsiden**.
3. Åpne appen fra ikonet på hjemskjermen.
4. Gå til **Mer → Teknisk test** og noter resultatet.
5. **Mer → Utviklerverktøy → Last inn fiktive testdata**.
6. Test fase 1-kriteriet (under). Bruk bare fiktive data på testtelefonen (IF-10).

## Ferdig-kriterium for fase 1

> Appen fungerer i flymodus, og testdata kan eksporteres og gjenopprettes på en annen enhet.

- [ ] Appen installert fra hjemskjermen på Android
- [ ] Teknisk test: «Virker uten nett» og «Nettverkstrafikk blokkert» er grønne
- [ ] Flymodus på, lukk appen helt, åpne den igjen: elevlisten vises
- [ ] Ta sikkerhetskopi, lagre filen i en testmappe i OneDrive
- [ ] På en annen enhet (eller PC-en på http://localhost:8080): Gjenopprett fra fil, sjekk at antall elever og hendelser stemmer
- [ ] Prøv å gjenopprette en feil fil (for eksempel et bilde): appen skal avvise den uten å endre noe

Det som gjelder spesielt for iPhone, testes på SFO-telefonen før fase 3 (kravspesifikasjonen kap. 15).

## Ny versjon av appen

1. Øk versjonen i **både** `sw.js` og `src/versjon.js` (testene sjekker at de er like).
2. Nye filer i `src/` må føres opp i `FILER` i `sw.js` (testene sjekker dette også).
3. Kjør `npm test`, commit og push. Telefonen viser «Ny versjon av appen er klar» neste gang appen åpnes.

Endres datamodellen: øk `DATAVERSJON` og `DB_VERSJON` i `src/db.js`, legg til et oppgraderingssteg der, og en migrering for sikkerhetskopier i `src/backup.js`. Et oppgraderingssteg skal aldri slette data.

## Teste fase 2a på telefonen

Bruk bare fiktive data på testtelefonen. Testfilene ligger i `testdata/`, og navnene der er oppdiktet.

1. Legg `testdata/fiktive-elever.xlsx` og `testdata/fiktive-elever-endret.xlsx` i en testmappe i OneDrive.
2. **Mer → Teknisk test og utviklerverktøy → Slett alle data.**
3. **Mer → Importer fra Excel**, velg `fiktive-elever.xlsx`. Forhåndsvisningen skal vise 32 nye elever. Trykk Importer.
4. Importer samme fil igjen. Appen skal si «Ingen endringer» (ferdig-kriteriet for fase 2a).
5. Importer `fiktive-elever-endret.xlsx`. Forhåndsvisningen skal vise 1 ny, 1 oppdatert, 1 gått opp et trinn og 1 som deaktiveres.
6. **Elever → Legg til elev.** Prøv å lagre tomt skjema (feil skal vises), fyll ut, lagre. Åpne eleven, endre noe, lagre. Deaktiver den.
7. **Mer → Hent tom Excel-mal** og åpne den i Excel på telefonen eller PC-en.

## Teste fase 2b og 2c på telefonen (en fiktiv ettermiddag)

Bruk testtelefonen med fiktive data. Testen tar 10–15 minutter og bør gjøres en hverdag rundt kl. 14.45, så varselet kommer av seg selv kl. 15.00.

1. **Mer → Teknisk test og utviklerverktøy → Last inn fiktive testdata.**
2. **I dag:** Skriv initialene dine i feltet «Initialer». Teller viser 0 inne og hvor mange som er forventet.
3. **Andre:** Sjekk inn de fleste. Registrer fravær på én. La to stå.
4. **Kl. 15.00:** Gå til I dag og vent. Den gule boksen med de to barna skal komme av seg selv. Sjekk inn ett av dem fra boksen.
5. Sjekk ut ett barn, og trykk **Angre** i meldingen nederst. Barnet skal være inne igjen.
6. **Telling:** Start telling, huk av alle unntatt ett, avslutt med avvik og skriv en kommentar. Tellingen skal stå under «Dagens tellinger».
7. Trykk på et navn for å åpne **elevkortet**. Prøv «Rett tidspunkt», og sjekk at historikken viser det gamle tidspunktet som rettet.
8. Sjekk ut alle, og trykk **Avslutt dagen**.

Ferdig-kriteriet for fase 2b er at en hel fiktiv ettermiddag kan gjennomføres fra 14.45 til stengetid.
