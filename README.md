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

**Manifestet velges av koden (versjon 0.12.6).**

- `index.html` har ikke lenger en fast lenke til manifestet. `src/app.js` legger inn `manifest.webmanifest` eller `manifest-test.webmanifest` etter adressen. Før kunne Chrome lese SFO-appens manifest på test-adressen før koden rakk å bytte det, og test-appen fikk da samme app-ID som SFO-appen.

**Test-appen og SFO-appen kan installeres på samme telefon (versjon 0.12.5).**

- Test-appen har fått egen app-ID (`"id": "sfo-appen-test"` i `manifest-test.webmanifest`). Før fikk begge samme ID, fordi «id» tolkes fra roten av domenet, og Android sa at appen allerede var installert. SFO-appens ID er ikke endret.

**Oppdatering henter alltid nye filer (versjon 0.12.4).**

- Service workeren henter hver fil med versjonsnummeret i adressen (`?v=0.12.4`). GitHub Pages kan i noen minutter etter en push sende ut gamle filer fra mellomlageret sitt. Før kunne en ny versjon da bli lagret med gamle filer, og bare tømming av nettleserdata hjalp.
- Har versjonsfila likevel feil versjon, avbrytes installasjonen, og telefonen prøver igjen neste gang appen åpnes.
- Test-appen har eget ikon med gul TEST-stripe (`icons/test-*.png`), så den ikke forveksles med SFO-appen på hjemskjermen. Installer test-appen på nytt for å få nytt ikon og navnet «SFO TEST».

**Testmiljø og retting av sikkerhetskopi på Android (versjon 0.12.3).**

- Testmiljø på egen adresse (`…/SFO-Appen-test/`) med gult TEST-banner, eget navn på hjemskjermen («SFO TEST»), egen database og eget hurtigbuffer. Se «Testmiljø» under.
- Nekter nettleseren å dele `.json` rett etter et trykk (Samsung Internet og Chrome på Android), lastes sikkerhetskopien ned til Nedlastinger i stedet for å feile. Meldingen sier hva nettleseren svarte.
- «Lagre» i dialogen lukker dialogen før delingsarket åpnes, så iPhone ikke avbryter delingen.

**Teknisk test og utviklerverktøy bak administratorkode (versjon 0.12.2).**

- Hele delen «Teknisk test og utviklerverktøy» under Mer er skjult uten administratormodus. Der står bare knappen **Åpne med administratorkode**. Teknisk test kjøres heller ikke før delen er åpnet.
- Når administratormodus avsluttes (banneret, Mer → Tilgang eller låsing), skjules delen igjen.

**Etter første pilotdag (versjon 0.12.1).**

- Alle lister (I dag, Ikke inne, Telling, Elever og elevvalget i elevrapporten) er sortert alfabetisk på fornavn, så etternavn og trinn. Norsk alfabetisk rekkefølge, så «Aa» sorteres som «Å».
- Søkefeltene har et rødt kryss til høyre som tømmer søket. Krysset vises bare når det står noe i feltet.
- Søsken er vurdert og utsatt til etter piloten.

**Krypterte sikkerhetskopier (versjon 0.12.0, K-64, DPIA T15).**

- Administrator setter et **passord for sikkerhetskopier** (minst 12 tegn, gjerne en setning) under **Mer → Tilgang**. Fra da av krypteres alle sikkerhetskopier. Uten passord tas kopien som før, men Mer viser at den ikke er kryptert.
- De ansatte merker ingen forskjell: de trenger ikke passordet for å ta kopi. Telefonen har en egen datanøkkel som krypterer fila, og nøkkelen ligger i fila, låst med passordet.
- **Gjenoppretting** av en kryptert kopi krever passordet, også på en ny telefon. På en ny telefon brukes det samme passordet videre etter gjenopprettingen. Feil passord avvises.
- Innholdet komprimeres før kryptering, så fila blir mye mindre. Bare format, appversjon og tidspunkt står i klartekst.
- Teknisk: AES-GCM 256 for innholdet, nøkkelen låst med PBKDF2-SHA256 (600 000 runder, eget salt), alt med nettleserens innebygde Web Crypto (`src/kryptering.js`).
- **Glemt passord betyr at kopiene ikke kan åpnes.** Passordet skrives ned og oppbevares sammen med administratorkoden. Ved bytte av passord bruker nye kopier det nye passordet, mens eldre kopier fortsatt åpnes med det gamle.
- Ukrypterte kopier fra tidligere versjoner kan fortsatt gjenopprettes.

**Sikkerhetskopi ved dagsavslutning (versjon 0.11.0, K-20, K-60).**

- **Avslutt dagen** har nå hovedknappen **Ta sikkerhetskopi og avslutt**. Den åpner delingsarket med en gang: velg «Arkiver i Filer» og SFO-mappen i OneDrive. Er kopien allerede tatt i dag, står det «✓ Sikkerhetskopi er tatt i dag kl. …».
- **Avslutt uten kopi** finnes fortsatt. Er det mer enn en uke siden siste kopi, eller er det aldri tatt kopi, må det bekreftes.
- Sikkerhetskopien lages før knappen trykkes, både i «Avslutt dagen» og under Mer. Da godtar Safari på iPhone at delingsarket åpnes. Avviser nettleseren det likevel, kommer knappen «Lagre», som prøver igjen. Det samme gjelder «Hent tom Excel-mal».
- Appen kan ikke lagre i OneDrive helt automatisk. Nettleseren krever et trykk og at brukeren velger hvor fila skal.

**Automatisk sletting, raskere rapporter og ESLint (versjon 0.10.0, K-63).**

- **Sletting av gammel historikk (K-63):** Hendelser, tellinger og unntak fra inneværende og forrige skoleår beholdes. Det som er eldre, slettes automatisk ved oppstart og når datoen skifter, høyst én gang per dag. Et skoleår starter 1. august. Deaktiverte elever slettes når de ikke har nyere registreringer og ble deaktivert før grensen.
- Under **Mer → Innstillinger → Historikk beholdes** kan administrator velge «Bare inneværende skoleår». Da vises hva som slettes før det skjer. Der står også når det sist ble sjekket.
- Sikkerhetskopier og PDF-er i OneDrive slettes ikke av appen. Det må gjøres etter rutinen.
- **Raskere rapporter:** Hendelsene sorteres etter dato én gang, avviksrapporten gjenbruker utregningen fra grupperapporten, og bare tellingslinjene for perioden leses. Med to skoleår med data og en bremset telefon gikk avviksrapporten for et år fra 1,7 s til 0,6 s, og elevrapporten fra 0,5 s til 0,3 s.
- Rapportskjermene bruker nå felles kode for periodevalg, tabeller, topp og bunntekst (`src/ui/rapportfelles.js`).
- **ESLint og Playwright** står i `package.json`. Kjør `npm install` én gang. `npm run lint` sjekker koden, og `npm run sjekk` kjører både lint og tester. Git-hooken kjører ESLint før hver commit når det er installert.
- Nettlesertestene: `npm run e2e:installer` én gang (laster ned Chromium), deretter `npm run serve` og `npm run e2e`.

**Vakt mot overføring av persondata (versjon 0.9.2).**

- Alle skrivefelt har stavekontroll, autokorrektur og autofyll slått av som standard (`src/dom.js`). Da sender ikke nettleserens stavekontroll navn og merknader til en skytjeneste. Tastaturappen på telefonen styres av telefonens egne innstillinger.
- `tests/personvern.test.js` stopper en ny versjon hvis sikkerhetsregelen (CSP) endres, eller hvis noen legger inn kode som kan sende data: `fetch` utenfor service workeren og selvtesten, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, nettadresser og lignende.
- Git-hooken (`tools/hooks/pre-commit`) kjører personverntestene før hver commit. GitHub kjører alle testene ved hver push (`.github/workflows/tester.yml`).
- Skal CSP-regelen eller nettverkskoden endres med vilje, må testen endres også, og DPIA-en vurderes på nytt.

**Fanen «Andre» heter nå «Ikke inne» (versjon 0.9.3).** Adressen er fortsatt `#andre`, så lenker og bokmerker virker som før. Påminnelsen om hva som ikke skal stå i merknaden, vises nå bare der merknaden skrives (Rediger avtaler), ikke på elevkortet.

**Avviksrapport (versjon 0.9.0, K-54) er bygget.** Den ligger under **Mer → Rapporter → Avviksrapport**.

- Bare det som skal følges opp: avvik ved telling (med hvilke barn som manglet), ikke møtt, aldri registrert, ikke sjekket ut, dager uten telling og dager uten registreringer.
- «Ikke møtt» (en ansatt har registrert at barnet ikke kom, og at det er fulgt opp) er skilt fra «Aldri registrert» (forventet, men ingenting registrert).
- Barn med flere avvik i perioden står i en egen tabell.
- Nederst er det linjer for «Gjennomgått av», «Dato» og «Oppfølging og tiltak», til signatur på utskriften.
- Meldt fravær, rettelser og angre er ikke med.
- Samme periodevalg, logo, forkortede navn og bunntekst som de andre rapportene. Tallene regnes ut i `avviksrapport` i `src/model/rapport.js`.

**Initialer på alt (versjon 0.8.0, endret i 0.8.1, K-18) er bygget.**

- Initialene følger telefonen. Låseskjermen viser «Låses opp som KT · Bytt», og koden låser opp med de samme initialene. En annen ansatt trykker **Bytt** før koden, og skriver initialene sine etterpå (uten forslag). Det går ikke an å fortsette uten initialer.
- Appen spør likevel etter initialer ved ny dag, og når den har vært låst i mer enn 30 minutter. Da er forrige initialer foreslått.
- Alt som registreres til appen låses igjen, får disse initialene: inn, ut, fravær, ikke møtt, ikke SFO i dag, ekstra dag, angre, rett tidspunkt og telling.
- Endring av elever og faste avtaler, deaktivering og import lagrer hvem som endret sist og når. Elevkortet viser «Sist endret … av …» under faste avtaler.
- Tar en annen ansatt over telefonen uten at den har vært låst, trykker hun på initialene på **I dag** og skriver sine egne.
- Initialfeltene i telling og fravær er fjernet. De viser hvem som registrerer.

**Kode for å åpne appen (versjon 0.7.0, K-71 til K-73) er bygget.**

- Første gang appen åpnes, velges en **kode for ansatte (4 siffer)** og en **administratorkode (6 siffer)**. Like siffer (0000) og rekker (1234) godtas ikke.
- Appen låses **hver gang** den blir skjult: bytte til en annen app, hjem-knappen eller skjermen av. Det er ingen tidsfrist. Unntaket er når appen selv åpner filvelger, delingsark eller utskrift: da låses den ikke, med mindre brukeren er borte i mer enn to minutter.
- Administratorkoden kreves for import av elevliste, ny elev, endring av navn, trinn, gruppe og SFO-dager, deaktivering, gjenoppretting fra sikkerhetskopi, utviklerverktøy og bytte av koder. Administratormodus varer til appen låses. Så lenge den er på, står et rødt banner øverst med knappen **Avslutt** (fra versjon 0.9.1). Man kan også trykke **Avslutt administratormodus** under **Mer → Tilgang**. Faste avtaler og merknader kan alle ansatte endre.
- **Glemt koden?** på låseskjermen: med administratorkoden kan man velge ny kode for ansatte.
- Etter fem feil forsøk må man vente 30 sekunder, og ventetiden dobles for hver ny feil (høyst 15 minutter).
- Kodene lagres bare som hash (PBKDF2 med salt), aldri i klartekst. De tas ikke med i sikkerhetskopien, og de beholdes ved gjenoppretting, testdata og «Slett alle data».
- Koden hindrer at noen åpner appen på en ulåst telefon. Den krypterer ikke dataene. Telefonens egen kodelås trengs fortsatt.
- **Glemt administratorkode** kan ikke gjenopprettes. Da må appen fjernes fra hjemskjermen (det sletter alle data), installeres på nytt og fylles fra siste sikkerhetskopi.

**Grupperapport (versjon 0.5.4, K-50 og K-52) er bygget**, før test med SFO-ansatte. Den ligger under **Mer → Rapporter → Grupperapport**.

- Periode: i dag, denne uka, denne måneden eller egen periode (høyst ett år).
- Innhold for SFO-leder og rektor: sammendrag med nøkkeltall (avvik, ikke møtt, aldri registrert, ikke sjekket ut og dager uten telling er uthevet), avvik ved telling med navn og kommentar, per dag, fravær per dag og alle tellinger.
- Navnene i rapporten er forkortet for å gjøre barna mindre gjenkjennelige. Formatet er beskrevet i skolens rutinebeskrivelse for appen. Rapporten inneholder likevel personopplysninger.
- Skolelogoen (`icons/skolelogo.png`) står sentrert øverst i rapporten.
- Bunnteksten viser bare utskriftsdato og klokkeslett, «SFO-appen» og versjonsnummer (fra 0.6.1). Hvor rapporten lagres og hvor lenge, står i rutinebeskrivelsen.
- «Skriv ut eller lagre som PDF» åpner telefonens utskrift. Rapporten skrives på A4 uten knapper og faner, med utskriftsdato øverst og nederst.
- Status og tall regnes ut i `src/model/rapport.js`, med tester i `tests/rapport.test.js`.
- Papirliste (K-53) er ikke laget ennå.

**Elevrapport (versjon 0.6.0, K-51) er bygget.** Den ligger under **Mer → Rapporter → Elevrapport**.

- Velg elev fra lista (med søk). Deaktiverte elever ligger i en egen gruppe nederst, slik at det også går an å ta ut rapport for barn som har sluttet.
- Samme periodevalg, logo, utskrift og bunntekst som grupperapporten. Valgt periode huskes mellom de to rapportene.
- Innhold: sammendrag (SFO-dager, møtt, meldt fravær, ikke møtt, aldri registrert, ikke sjekket ut, manglet ved telling), en tabell per dag med inn, ut (med initialer) og merknad, og tellingene der eleven manglet med kommentar.
- Rettede tidspunkt merkes med *.
- Navnet i selve rapporten er forkortet på samme måte som i grupperapporten. Fullt navn vises bare i elevvalget på skjermen og kommer ikke med på utskriften.

**Fase 2b og 2c (versjon 0.4.0) er bygget:** den daglige flyten, varsel og telling, med layout og flyt som i mockupen.

| Krav | Hva | Hvor i appen |
| --- | --- | --- |
| K-10, K-19 | Ny dag og forventede fra ukeplanen, unntak for én dag | Automatisk. Unntak på elevkortet, og «Ikke SFO i dag» nederst på Ikke inne. |
| K-11 til K-13 | Statuser, hovedliste med teller og egen liste for resten | I dag (inne), Ikke inne (forventet, sjekket ut, fravær, ikke SFO i dag) |
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
src/model/status.js   – dagens status regnet ut fra hendelsene
src/model/rapport.js  – grupperapporten, elevrapporten og avviksrapporten
src/model/sletting.js – regelen for automatisk sletting av gammel historikk
src/sletting.js       – kjører slettingen mot databasen
src/import/xlsx.js    – leser og skriver Excel-filer (.xlsx)
src/import/elevliste.js – import av elevlista: kontroll, kobling og endringsliste
src/filer.js          – lagre og åpne filer (delingsark eller nedlasting), utskrift
src/kode.js           – koder: hash, kontroll av nye koder, ventetid etter feil
src/kryptering.js     – kryptering og komprimering av sikkerhetskopier
src/tilgang.js        – låst/opplåst og administratormodus
src/plattform.js      – teknisk test av telefonen
src/dato.js, dom.js   – hjelpere
src/ui/               – skjermbildene (felles.js, skjermer.js, elever.js, import.js, mer.js, las.js = låseskjerm)
src/dev/testdata.js   – fiktive testdata
icons/                – app-ikon (blomsten fra skolelogoen) og skolelogo til rapporten
fonts/                – skrifttypene Fraunces og Work Sans (SIL Open Font License, se OFL-filene)
tests/                – automatiske tester (npm test)
tools/                – lokal server, testdata, e2e-test, git-hook
vendor/               – tredjepartsbiblioteker (ingen i bruk nå)
testdata/             – fiktiv sikkerhetskopi og fiktive elevlister i Excel
```

## Kjøre på PC-en

Krever Node.js 20.19 eller nyere. Appen selv har ingen avhengigheter. Utviklerverktøyene (ESLint og Playwright) installeres én gang:

```
npm install       # ESLint og Playwright (bare på PC-en, aldri i appen)
npm test          # automatiske tester (virker også uten npm install)
npm run lint      # ESLint
npm run sjekk     # lint + tester, det samme som GitHub kjører
npm run serve     # appen på http://localhost:8080
npm run testdata  # lager de fiktive testfilene i testdata/ på nytt
```

Nettlesertester:

```
npm run e2e:installer    # én gang: laster ned Chromium for Playwright
npm run serve            # i ett vindu
npm run e2e              # i et annet: kode, sikkerhetskopi, import, elevregister, sletting
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

## Testmiljø

Nye versjoner testes på testtelefonen før de når SFO-telefonen. Samme kode publiseres på to adresser:

| | SFO | Test |
| --- | --- | --- |
| Repo | `tokumid/SFO-Appen` | `tokumid/SFO-Appen-test` |
| Adresse | `https://tokumid.github.io/SFO-Appen/` | `https://tokumid.github.io/SFO-Appen-test/` |
| Telefon | SFO-telefonen (iPhone) | testtelefonen (Android) |
| Data | ekte elever | **bare fiktive testdata** |

Appen kjenner igjen test-adressen selv (`src/miljo.js`). Der viser den et gult TEST-banner, også på låseskjermen, heter «SFO TEST» på hjemskjermen, og bruker egen database og eget hurtigbuffer. Test og SFO deler derfor aldri data, selv om begge ligger på samme domene og åpnes på samme telefon.

**Oppsett (én gang):**

1. Lag et tomt, offentlig repo `SFO-Appen-test` på GitHub (uten README).
2. Legg det til som ekstra remote i det lokale repoet:
   ```
   git remote add test https://github.com/tokumid/SFO-Appen-test.git
   git push test main
   ```
3. I `SFO-Appen-test` på GitHub: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
4. Åpne `https://tokumid.github.io/SFO-Appen-test/` på testtelefonen og installer den på hjemskjermen. Bruk testkoder og fiktive testdata.

**For hver ny versjon:**

1. `npm run sjekk`, commit.
2. `git push test main` og test på testtelefonen (appen viser «Oppdater»).
3. Når alt virker: `git push origin main`. SFO-telefonen viser «Oppdater» neste gang appen åpnes.

## Installere på testtelefonen (Android)

1. Åpne test-adressen (se «Testmiljø») i Chrome.
2. Meny (⋮) → **Installer app** eller **Legg til på startsiden**.
3. Åpne appen fra ikonet på hjemskjermen. Velg kode for ansatte og administratorkode (bruk testkoder på testtelefonen).
4. Gå til **Mer → Teknisk test** og noter resultatet.
5. **Mer → Teknisk test og utviklerverktøy → Åpne med administratorkode → Last inn fiktive testdata**.
6. Test fase 1-kriteriet (under). Bruk bare fiktive data på testtelefonen (IF-10).

## Installere på SFO-telefonen (iPhone)

Gjøres av Cooper eller IT før telefonen tas i bruk. **Rekkefølgen er viktig.**

1. Åpne adressen fra steg 4 i **Safari**.
2. Trykk **Del** (firkanten med pil opp) og velg **Legg til på Hjem-skjerm**.
3. Lukk Safari, og åpne appen **fra ikonet på hjemskjermen**.
4. Velg kode for ansatte og administratorkode, og skriv initialene dine.
5. Importer elevlista (Mer → Importer fra Excel), eller gjenopprett fra sikkerhetskopi.

> **Ikke registrer noe i Safari-fanen.** På iPhone har appen på hjemskjermen sin egen lagring, adskilt fra Safari. Det som registreres i Safari-fanen, blir ikke med inn i appen. Koder og elevliste settes derfor først når appen er åpnet fra hjemskjermen.

Appens ikon må aldri fjernes fra hjemskjermen, fordi det sletter alle data i appen. Ta sikkerhetskopi først hvis appen må installeres på nytt.

Sjekk også at innstillingene IT har ansvar for er på plass (kodelås, iCloud-sikkerhetskopi, tastatur, OneDrive-appen og Finn min). Se DPIA-en, tiltak T2, T7, T8 og T12.

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
3. Kjør `npm run sjekk` og commit. Push først til testmiljøet (`git push test main`), og til SFO (`git push origin main`) når den er testet. Telefonen viser «Ny versjon av appen er klar» neste gang appen åpnes.

Endres datamodellen: øk `DATAVERSJON` og `DB_VERSJON` i `src/db.js`, legg til et oppgraderingssteg der, og en migrering for sikkerhetskopier i `src/backup.js`. Et oppgraderingssteg skal aldri slette data.

## Teste avviksrapporten på telefonen

1. Last inn fiktive testdata.
2. **Mer → Rapporter → Avviksrapport → Denne måneden.** Sjekk at avvik ved telling viser barnet som manglet og kommentaren, og at «Ikke møtt» og «Ikke sjekket ut» har rader.
3. Lagre som PDF og sjekk at linjene for gjennomgang og signatur kommer med på A4.

## Teste initialer på telefonen

1. Lås appen: låseskjermen skal vise «Låses opp som …». Skriv koden: appen skal åpne uten å spørre etter initialer.
2. Lås igjen, trykk **Bytt** og skriv koden: appen skal spørre etter initialer med tomt felt. Trykk **Fortsett** uten å skrive: appen skal ikke slippe deg inn.
3. Sjekk inn og ut, registrer fravær og gjør en telling: initialene skal stå i historikken på elevkortet og ved tellingen.
4. Trykk på initialene på **I dag** og skriv andre initialer. Neste registrering skal få de nye.
5. Endre en merknad: elevkortet skal vise «Sist endret … av …».

## Teste koden på telefonen

1. Installer versjon 0.7.0 og åpne appen. Velg kode for ansatte og administratorkode. Prøv først 1234: appen skal avvise den.
2. Trykk hjem-knappen og åpne appen igjen: låseskjermen skal vises. Gjør det samme med skjermen av og på, og ved bytte til en annen app.
3. Skriv feil kode fem ganger: appen skal vente 30 sekunder.
4. **Glemt koden?** → administratorkode → velg ny kode for ansatte. Lås opp med den nye koden.
5. **Mer → Importer fra Excel**: appen spør etter administratorkoden, og filvelgeren åpnes etterpå. Sjekk at appen ikke låses mens du velger fil. På iPhone må det sjekkes at filvelgeren åpnes direkte etter at koden er skrevet.
6. **Mer → Lås appen nå**, lås opp, og åpne et elevkort → **Rediger avtaler**: navn og trinn skal være låst, merknad skal kunne endres.
7. Ta sikkerhetskopi og skriv ut en rapport: appen skal ikke låses mens delingsarket eller utskriften er åpen.

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
3. **Ikke inne:** Sjekk inn de fleste. Registrer fravær på én. La to stå.
4. **Kl. 15.00:** Gå til I dag og vent. Den gule boksen med de to barna skal komme av seg selv. Sjekk inn ett av dem fra boksen.
5. Sjekk ut ett barn, og trykk **Angre** i meldingen nederst. Barnet skal være inne igjen.
6. **Telling:** Start telling, huk av alle unntatt ett, avslutt med avvik og skriv en kommentar. Tellingen skal stå under «Dagens tellinger».
7. Trykk på et navn for å åpne **elevkortet**. Prøv «Rett tidspunkt», og sjekk at historikken viser det gamle tidspunktet som rettet.
8. Sjekk ut alle, og trykk **Avslutt dagen**.

Ferdig-kriteriet for fase 2b er at en hel fiktiv ettermiddag kan gjennomføres fra 14.45 til stengetid.

## Teste grupperapporten på telefonen

1. **Mer → Teknisk test og utviklerverktøy → Last inn fiktive testdata.** Testdataene har nå også «ikke møtt», to tellinger med avvik og én dag der et barn ikke ble sjekket ut.
2. **Mer → Rapporter → Grupperapport → Denne måneden.** Sammendraget skal vise 2 tellinger med avvik, og avvikstabellen navn og kommentar.
3. Trykk **Skriv ut eller lagre som PDF**, velg **Lagre som PDF**, og lagre i en testmappe i OneDrive.
4. Åpne PDF-en og sjekk at den er lesbar på A4, uten knapper og faner.

## Teste elevrapporten på telefonen

1. Last inn fiktive testdata (som over).
2. **Mer → Rapporter → Elevrapport.** Søk etter et barn som står i avvikstabellen i grupperapporten, og trykk på det.
3. Velg **Denne måneden**. Per dag skal vise inn- og utsjekk, og «Tellinger der eleven manglet» skal vise kommentaren.
4. Sjekk at fullt navn ikke står i selve rapporten, bare forkortelsen.
5. Trykk **Bytt elev** og velg et annet barn. Lagre en PDF i testmappen og sjekk den på A4.
