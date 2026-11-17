# Endringslogg

Alle versjoner av SFO-appen, nyeste først. Versjonsnummeret står i `sw.js`, `src/versjon.js` og `package.json`, og vises under Mer i appen.

## 1.0.0 – 17. november 2026

Første ordinære versjon etter pilot (10.–17. november 2026). DPIA og kravspesifikasjon er godkjent av skolen.

- Lagringstid fastsatt av skolen: opplysningene lagres i 2 år etter skoleårets slutt (K-63). Appen beholder inneværende og de to forrige skoleårene, og sletter det som er eldre automatisk. Står innstillingen på standard, gjelder dette av seg selv. Er den endret tidligere, kan administrator velge «2 år etter skoleårets slutt» under Mer.
- Endringslogg (denne fila).

## 0.13.0 – 11. november 2026

- «Takk for i dag» etter dagsavslutning: tall for møtt, meldt fravær og ikke møtt, avvik og status for sikkerhetskopien, uten navn (K-21).
- I dag viser «Dagen er avsluttet kl. …». Inn, ut, fravær og angre etter avslutning må bekreftes, og I dag ber om å avslutte på nytt.
- Merknad er en beskjed for dagen. Den står med tekst under navnet, slettes når dagen avsluttes, og importeres ikke fra Excel (K-40).
- Listene sorteres på trinn, og på fornavn innad i trinnet.

## 0.12.4–0.12.6 – 11. november 2026

- Oppdatering henter alltid nye filer, og avbrytes hvis versjonen ikke stemmer.
- Testmiljø: eget ikon med gul TEST-stripe, egen app-ID, og manifestet velges av koden.

## 0.12.3 – 11. november 2026

- Testmiljø på egen adresse, med gult TEST-banner, egen database og eget hurtigbuffer.
- Sikkerhetskopi: lastes ned i stedet for å feile når nettleseren nekter å dele fila. Dialogen lukkes før delingsarket åpnes.

## 0.12.0–0.12.2 – 10.–11. november 2026

- Krypterte sikkerhetskopier med passord (AES-GCM, DPIA T15).
- Sortering på fornavn og rødt kryss som tømmer søket (etter pilotdag 1).
- Teknisk test og utviklerverktøy bak administratorkode.

## 0.10.0–0.11.0 – 10. november 2026

- Automatisk sletting av gammel historikk (K-63).
- Raskere rapporter med felles rapportkode.
- «Ta sikkerhetskopi og avslutt» i dagsavslutningen.
- ESLint, Playwright og pre-commit-hook med personverntester.

## 0.6.0–0.9.3 – før piloten

- Elevrapport, avviksrapport og grupperapport med forkortede navn.
- Kode for å åpne appen, administratorkode og initialer på alle registreringer.
- Rødt banner i administratormodus.
- Personverntester: ingen nettverkskall, ingen eksterne adresser, ingen stavekontroll eller autofyll.
