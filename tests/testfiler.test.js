// Sjekker at de fiktive testfilene ligger der de skal. Se testdata/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const FILER = ['fiktive-elever.xlsx', 'fiktive-elever-endret.xlsx', 'fiktive-elever-libreoffice.xlsx', 'fiktiv-sikkerhetskopi.json'];

for (const f of FILER) {
  test(`testdata/${f} finnes`, async () => {
    const sti = fileURLToPath(new URL(`../testdata/${f}`, import.meta.url));
    await assert.doesNotReject(access(sti), `testdata/${f} mangler. Filene skal ikke slettes eller flyttes (se testdata/README.md). Lag dem på nytt med «npm run testdata», eller hent dem fra GitHub.`);
  });
}
