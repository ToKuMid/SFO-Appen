// Lager testdata/fiktiv-sikkerhetskopi.json, som kan gjenopprettes i appen for å teste K-61.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { lagTestdata } from '../src/dev/testdata.js';
import { byggSikkerhetskopi } from '../src/backup.js';
import { APP_VERSJON } from '../src/versjon.js';

const naa = new Date();
const kopi = byggSikkerhetskopi(lagTestdata({ naa, frø: 7 }), { appversjon: APP_VERSJON, naa });
const fil = new URL('../testdata/fiktiv-sikkerhetskopi.json', import.meta.url);
await writeFile(fil, JSON.stringify(kopi, null, 2));
console.log(`Skrev ${fileURLToPath(fil)} (${kopi.data.elever.length} fiktive elever)`);
