// Lager fiktive testfiler i testdata/:
//   fiktiv-sikkerhetskopi.json   – kan gjenopprettes i appen (K-61)
//   fiktive-elever.xlsx          – 32 fiktive elever i Excel-malen (K-01)
//   fiktive-elever-endret.xlsx   – samme liste med én ny, én borte, én opp et trinn og én endret (K-02)
//
// testdata/fiktive-elever-libreoffice.xlsx er fiktive-elever.xlsx åpnet og lagret i LibreOffice med
// ekte klokkeslett-celler. Den lages ikke av dette skriptet, men brukes til å teste at appen leser
// filer fra et vanlig regneark.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lagTestdata } from '../src/dev/testdata.js';
import { byggSikkerhetskopi } from '../src/backup.js';
import { APP_VERSJON } from '../src/versjon.js';
import { skrivXlsx } from '../src/import/xlsx.js';
import { malForklaring, malRader } from '../src/import/elevliste.js';
import { SKOLEGRUPPER } from '../src/model/elev.js';

const skriv = async (navn, data) => {
  const fil = new URL(`../testdata/${navn}`, import.meta.url);
  await writeFile(fil, data);
  console.log(`Skrev ${fileURLToPath(fil)}`);
};

const naa = new Date();
await skriv('fiktiv-sikkerhetskopi.json',
  JSON.stringify(byggSikkerhetskopi(lagTestdata({ naa, frø: 7 }), { appversjon: APP_VERSJON, naa }), null, 2));

const { elever, avtaler } = lagTestdata({ naa, dager: 0 });
const avtaleFor = new Map(avtaler.map((a) => [a.elevId, a]));
const somRad = (e) => {
  const a = avtaleFor.get(e.id) ?? {};
  return [e.fornavn, e.etternavn, e.trinn, e.skolegruppe,
    ...[1, 2, 3, 4, 5].map((d) => (e.ukedager.includes(d) ? 'X' : '')),
    a.gaarHjemAleneFra ?? '', a.fastHentetid ?? ''];
};
const xlsx = (rader) => skrivXlsx([
  { navn: 'Elever', rader: [...malRader(), ...rader], frysForsteRad: true, bredder: [14, 16, 7, 16, 6, 6, 6, 6, 6, 18, 14] },
  { navn: 'Forklaring', rader: malForklaring(), bredder: [22, 9, 70, 30] },
]);

await skriv('fiktive-elever.xlsx', xlsx(elever.map(somRad)));

// Endret liste: første elev slutter, en ny begynner, en på 3. trinn går opp, en bytter skolegruppe.
const endret = elever.slice(1).map((e) => ({ ...e }));
const oppTrinn = endret.find((e) => e.trinn === 3);
oppTrinn.trinn = 4;
oppTrinn.skolegruppe = SKOLEGRUPPER[4][0];
const byttGruppe = endret.find((e) => e.trinn <= 3 && e !== oppTrinn);
byttGruppe.skolegruppe = byttGruppe.skolegruppe === 'Gruppe 1 blå' ? 'Gruppe 1 grønn' : 'Gruppe 1 blå';
endret.push({ id: 'ny', fornavn: 'Nyhilde', etternavn: 'Testesen', trinn: 1, skolegruppe: 'Gruppe 1 grønn', ukedager: [1, 3, 5] });
await skriv('fiktive-elever-endret.xlsx', xlsx(endret.map(somRad)));
