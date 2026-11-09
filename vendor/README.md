# vendor/

Tredjepartsbiblioteker legges her som egne filer, slik at appen ikke henter noe fra nett (IF-03).

Ingen biblioteker er i bruk nå. Kravspesifikasjonen planla SheetJS for Excel, men SheetJS kunne ikke
hentes fra nett. Appen leser og skriver i stedet Excel-filer med egen kode i `src/import/xlsx.js`.

Legges et bibliotek inn her senere: noter versjon, kilde og lisens i denne filen, og før filen opp i
`FILER` i `sw.js`.
