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

**Versjon 0.2.0** har utseendet fra mockupen: farger, skrifttypene Fraunces og Work Sans, stor overskrift på hver skjerm og faner med ikoner. Appen har både lys og mørk variant og følger telefonens innstilling.

I dag viser hvor mange barn som er forventet etter ukeplanen. Andre og Telling er tomme til fase 2. Elever viser en enkel liste uten redigering. Under Mer kan varseltidspunktet (K-16) allerede velges.

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
src/filer.js          – lagre og åpne filer (delingsark eller nedlasting)
src/plattform.js      – teknisk test av telefonen
src/dato.js, dom.js   – hjelpere
src/ui/               – skjermbildene (felles.js, skjermer.js, mer.js)
src/dev/testdata.js   – fiktive testdata
icons/                – app-ikoner (fargene er mockupens antatte palett til Erdvias farger er klare)
fonts/                – skrifttypene Fraunces og Work Sans (SIL Open Font License, se OFL-filene)
tests/                – automatiske tester (npm test)
tools/                – lokal server, testdata, e2e-test, git-hook
vendor/               – tredjepartsbiblioteker (SheetJS kommer i fase 2a)
testdata/             – fiktiv sikkerhetskopi til test av gjenoppretting
```

## Kjøre på PC-en

Krever Node.js 20 eller nyere. Ingen pakker må installeres.

```
npm test          # automatiske tester
npm run serve     # appen på http://localhost:8080
npm run testdata  # lager testdata/fiktiv-sikkerhetskopi.json på nytt
```

Valgfri nettlesertest (installerer Playwright midlertidig):

```
npm install --no-save playwright
npx playwright install chromium
npm run serve     # i ett vindu
npm run e2e       # i et annet
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
