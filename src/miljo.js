// Testmiljø (fremdriftsplanen, «test før SFO»): samme kode publiseres også på …/SFO-Appen-test/.
// Der brukes bare fiktive data. Testmiljøet har egen database og eget hurtigbuffer, slik at test og
// SFO aldri deler data, heller ikke på samme telefon (begge ligger på samme domene).
// Ren logikk uten DOM, slik at den kan testes med `npm test`.

/** Er dette testmiljøet? sti: location.pathname. */
export const erTestmiljo = (sti) => /\/sfo-appen-test\//i.test(sti ?? '');

export const ER_TEST = typeof location !== 'undefined' && erTestmiljo(location.pathname);
