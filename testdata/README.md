# testdata/ – fiktive testfiler

**Ikke slett eller flytt filene her.** De automatiske testene (`npm test`) bruker dem, og de er laget for
å kunne ligge i det offentlige repoet. Alle navn er oppdiktet. Ingen ekte elevdata skal noen gang hit.

| Fil | Brukes til |
| --- | --- |
| `fiktive-elever.xlsx` | 32 fiktive elever i Excel-malen. Test av import (K-01) og at dobbel import ikke gir duplikater. |
| `fiktive-elever-endret.xlsx` | Samme liste med én ny, én borte, én opp et trinn og én endret (K-02). |
| `fiktive-elever-libreoffice.xlsx` | Samme liste lagret i LibreOffice, for å teste filer fra et vanlig regneark. |
| `fiktiv-sikkerhetskopi.json` | Fiktiv sikkerhetskopi til test av gjenoppretting (K-61). |

Trenger du filene i OneDrive for å teste på telefonen: **kopier** dem dit, ikke flytt dem.
Filene kan lages på nytt med `npm run testdata` (unntatt LibreOffice-fila).
