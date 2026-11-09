# vendor/

Tredjepartsbiblioteker legges her som egne filer, slik at appen ikke henter noe fra nett (IF-03).

| Bibliotek | Brukes til | Når |
| --- | --- | --- |
| SheetJS (bare lesedelen, `xlsx.mini.min.js`) | Lese Excel-malen lokalt (K-01) | Fase 2a |

Hent SheetJS fra den offisielle distribusjonen på https://cdn.sheetjs.com (ikke npm-pakken `xlsx`, som er utdatert).
Noter versjon og lisens (Apache 2.0) i denne filen når den legges inn.
