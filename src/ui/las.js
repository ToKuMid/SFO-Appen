// Låseskjerm og koder (K-71–K-73): ansattkode (4 siffer) hver gang appen åpnes, og
// administratorkode (6 siffer) for import, elevendringer, gjenoppretting og bytte av kode.
// Appen låses hver gang den blir skjult: bytte av app, hjem-knappen eller skjermen av.
import { ER_TEST } from '../miljo.js';
import { h, visMelding } from '../dom.js';
import { hentInnstilling, lagreInnstilling } from '../db.js';
import {
  ADMIN_LENGDE, ANSATT_LENGDE, FRIE_FORSOK, gjenstaendeVent, kontrollerInitialer, kontrollerNyKode, lagKode,
  lesLagredeInitialer, maaSporeInitialer, sjekkKode,
} from '../kode.js';
import {
  erAdmin, erLast, hentSesjonInitialer, settAdmin, settLast, settSesjonInitialer, skalLases,
} from '../tilgang.js';

let dialog = null;
let skalVaereApen = false;
let aktivt = null; // tastene til steget som vises nå
let lasJobb = null;
let oppsettPagaar = false;

function sikreDialog() {
  if (dialog) return dialog;
  // I testmiljøet står TEST også på låseskjermen, som ligger over banneret.
  dialog = h('dialog', { id: 'las', class: ER_TEST ? 'las las-test' : 'las', 'aria-label': 'Kode' });
  // Esc og tilbake-knappen på Android lukker ikke låseskjermen. Den åpnes igjen hvis den lukkes likevel.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    aktivt?.avbryt?.();
  });
  dialog.addEventListener('close', () => {
    if (skalVaereApen) dialog.showModal();
  });
  dialog.addEventListener('keydown', (e) => {
    if (!aktivt?.trykk) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); aktivt.trykk(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); aktivt.slett(); }
  });
  document.body.append(dialog);
  return dialog;
}

function aapne() {
  sikreDialog();
  skalVaereApen = true;
  if (!dialog.open) dialog.showModal();
}

function lukk() {
  skalVaereApen = false;
  aktivt = null;
  if (dialog?.open) dialog.close();
}

const sekunder = (ms) => Math.ceil(ms / 1000);
const ventTekst = (ms) => (ms >= 60000 ? `${Math.ceil(ms / 60000)} min` : `${sekunder(ms)} sekunder`);

/**
 * Viser ett steg med tastatur og venter på en hel kode.
 * kontroller(kode) → null (godtatt) eller { feil, vent? }.
 * Løses med koden, med verdien til ekstra-knappen, eller null ved Avbryt.
 */
function steg({ tittel, tekst, lengde, kontroller, avbryt = false, ekstra = null, logo = false, startVent = 0, under = null }) {
  return new Promise((resolve) => {
    let siffer = '';
    let opptatt = false;
    let ferdig = false;
    const prikker = h('div', { class: 'las-prikker', 'aria-hidden': 'true' },
      Array.from({ length: lengde }, () => h('span', { class: 'las-prikk' })));
    const antall = h('p', { class: 'skjult-tekst', 'aria-live': 'polite' }, '');
    const feil = h('p', { class: 'las-feil', role: 'alert' });
    const knapper = [];

    const tegn = () => {
      [...prikker.children].forEach((p, i) => p.classList.toggle('fylt', i < siffer.length));
      antall.textContent = `${siffer.length} av ${lengde} siffer`;
    };
    const avslutt = (verdi) => {
      if (ferdig) return;
      ferdig = true;
      if (aktivt === taster) aktivt = null;
      resolve(verdi);
    };
    const vent = (ms) => {
      opptatt = true;
      knapper.forEach((k) => { k.disabled = true; });
      const slutt = Date.now() + ms;
      const tikk = () => {
        if (ferdig) return;
        const igjen = slutt - Date.now();
        if (igjen <= 0) {
          opptatt = false;
          knapper.forEach((k) => { k.disabled = false; });
          feil.textContent = '';
          return;
        }
        feil.textContent = `For mange feil. Prøv igjen om ${ventTekst(igjen)}.`;
        setTimeout(tikk, 1000);
      };
      tikk();
    };
    const trykk = async (d) => {
      if (opptatt || ferdig || siffer.length >= lengde) return;
      siffer += d;
      tegn();
      if (siffer.length < lengde) return;
      opptatt = true;
      const kode = siffer;
      const svar = kontroller ? await kontroller(kode) : null;
      if (ferdig) return;
      if (!svar) { avslutt(kode); return; }
      feil.textContent = svar.feil;
      prikker.classList.remove('rist');
      void prikker.offsetWidth;
      prikker.classList.add('rist');
      siffer = '';
      tegn();
      if (svar.vent) vent(svar.vent);
      else opptatt = false;
    };
    const slett = () => {
      if (opptatt || ferdig) return;
      siffer = siffer.slice(0, -1);
      tegn();
    };
    const taster = { trykk, slett, avbryt: avbryt ? () => avslutt(null) : null, avbrytHelt: () => avslutt(null) };
    aktivt = taster;

    const tast = (d) => {
      const k = h('button', { type: 'button', class: 'las-tast', 'data-siffer': d, onclick: () => trykk(d) }, d);
      knapper.push(k);
      return k;
    };
    const slettKnapp = h('button', { type: 'button', class: 'las-tast las-tast-ikon', 'aria-label': 'Slett siste siffer', onclick: slett }, '⌫');
    knapper.push(slettKnapp);
    const tastatur = h('div', { class: 'las-tastatur' },
      ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(tast),
      avbryt ? h('button', { type: 'button', class: 'las-tast las-tast-tekst', id: 'las-avbryt', onclick: () => avslutt(null) }, 'Avbryt') : h('span'),
      tast('0'),
      slettKnapp);

    dialog.replaceChildren(h('div', { class: 'las-innhold' },
      logo ? h('img', { class: 'las-logo', src: 'icons/app-192.png', alt: '' }) : null,
      h('h1', { class: 'las-tittel', id: 'las-tittel' }, tittel),
      tekst ? h('p', { class: 'las-info' }, tekst) : null,
      under,
      prikker,
      antall,
      feil,
      tastatur,
      ekstra ? h('button', { type: 'button', class: 'knapp knapp-lenke las-ekstra', id: ekstra.id, onclick: () => avslutt(ekstra.verdi) }, ekstra.tekst) : null));
    tegn();
    dialog.querySelector('.las-tast')?.focus();
    if (startVent > 0) vent(startVent);
  });
}

/**
 * Spør etter initialene til den som bruker appen (K-18). Forslaget er initialene som ble brukt sist.
 * Løses med initialene, eller null ved Avbryt.
 */
function sporInitialer({ avbryt = false, forslag = true } = {}) {
  return new Promise((resolve) => {
    let ferdigFlagg = false;
    const ferdig = (v) => {
      if (ferdigFlagg) return;
      ferdigFlagg = true;
      if (aktivt === taster) aktivt = null;
      resolve(v);
    };
    // Uten trykk/slett: tastaturet i dialogen fanger ikke siffer og slett mens det skrives i feltet.
    const taster = { trykk: null, slett: null, avbryt: avbryt ? () => ferdig(null) : null, avbrytHelt: () => ferdig(null) };
    aktivt = taster;
    const felt = h('input', {
      id: 'las-initialer', type: 'text', maxlength: 4, autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', 'aria-describedby': 'las-initialer-hjelp', placeholder: 'F.eks. KT',
    });
    if (forslag) {
      hentInnstilling('sisteInitialer').then((v) => {
        const l = lesLagredeInitialer(v);
        if (l && !felt.value) { felt.value = l.verdi; felt.select(); }
      });
    }
    const feil = h('p', { class: 'las-feil', role: 'alert' });
    const send = async (e) => {
      e.preventDefault();
      const { verdi, feil: f } = kontrollerInitialer(felt.value);
      if (f) { feil.textContent = f; felt.focus(); return; }
      await lagreInnstilling('sisteInitialer', { verdi, tid: new Date().toISOString() });
      ferdig(verdi);
    };
    dialog.replaceChildren(h('div', { class: 'las-innhold' },
      h('h1', { class: 'las-tittel', id: 'las-tittel' }, 'Initialer'),
      h('p', { class: 'las-info', id: 'las-initialer-hjelp' }, 'Alt du registrerer til appen låses igjen, lagres med initialene dine.'),
      h('form', { class: 'las-skjema', onsubmit: send },
        felt,
        feil,
        h('button', { type: 'submit', class: 'knapp knapp-primar knapp-stor', id: 'las-fortsett' }, 'Fortsett'),
        avbryt ? h('button', { type: 'button', class: 'knapp knapp-lenke', id: 'las-avbryt', onclick: () => ferdig(null) }, 'Avbryt') : null)));
    felt.focus();
  });
}

/** Bytt initialer uten å låse (for eksempel når en annen ansatt tar over telefonen). */
export async function byttInitialer() {
  if (erLast()) return false;
  aapne();
  const verdi = await sporInitialer({ avbryt: true, forslag: false });
  if (erLast()) return false;
  lukk();
  if (!verdi) return false;
  settSesjonInitialer(verdi);
  return true;
}

export const aktiveInitialer = () => hentSesjonInitialer();

/** Prøver en kode mot lagret kode, med teller for feil forsøk. */
async function proveKode(kode, lagretNokkel, feilNokkel) {
  const feilFor = await hentInnstilling(feilNokkel);
  const igjen = gjenstaendeVent(feilFor);
  if (igjen > 0) return { feil: `For mange feil. Prøv igjen om ${ventTekst(igjen)}.`, vent: igjen };
  if (await sjekkKode(kode, await hentInnstilling(lagretNokkel))) {
    if (feilFor?.antall) await lagreInnstilling(feilNokkel, { antall: 0, sist: null });
    return null;
  }
  const ny = { antall: (feilFor?.antall ?? 0) + 1, sist: new Date().toISOString() };
  await lagreInnstilling(feilNokkel, ny);
  const vent = gjenstaendeVent(ny);
  if (vent > 0) return { feil: `Feil kode. Prøv igjen om ${ventTekst(vent)}.`, vent };
  const forsok = FRIE_FORSOK - ny.antall;
  return { feil: forsok <= 2 ? `Feil kode. ${forsok} forsøk igjen før appen venter.` : 'Feil kode. Prøv igjen.' };
}

/** Velg ny kode og gjenta den. Løses med koden, eller null hvis brukeren avbryter. */
async function nyKode({ lengde, tittel, tekst, avbryt = false }) {
  for (;;) {
    const forste = await steg({
      tittel, tekst, lengde, avbryt,
      kontroller: async (k) => { const f = kontrollerNyKode(k, lengde); return f ? { feil: f } : null; },
    });
    if (forste === null) return null;
    const andre = await steg({
      tittel: 'Gjenta koden',
      tekst: 'Skriv den samme koden en gang til.',
      lengde, avbryt,
      ekstra: { tekst: 'Begynn på nytt', verdi: 'nytt', id: 'las-nytt' },
      kontroller: async (k) => (k === forste ? null : { feil: 'Kodene er ikke like. Prøv igjen.' }),
    });
    if (andre === null) return null;
    if (andre === forste) return forste;
  }
}

// ---------- Første gang ----------

async function oppsett() {
  oppsettPagaar = true;
  aapne();
  const ansatt = await nyKode({
    lengde: ANSATT_LENGDE,
    tittel: 'Velg kode for ansatte',
    tekst: 'Velkommen til SFO-appen. Velg en kode på 4 siffer. Alle ansatte på SFO bruker den for å åpne appen.',
  });
  const admin = await nyKode({
    lengde: ADMIN_LENGDE,
    tittel: 'Velg administratorkode',
    tekst: 'Administratorkoden har 6 siffer. Den trengs for å bytte koden for ansatte, importere elevliste, endre elever og gjenopprette fra sikkerhetskopi. SFO-leder eller rektor tar vare på den.',
  });
  await lagreInnstilling('kode-ansatt', await lagKode(ansatt));
  await lagreInnstilling('kode-admin', await lagKode(admin));
  const init = await sporInitialer();
  oppsettPagaar = false;
  lukk();
  settLast(false);
  settSesjonInitialer(init);
  window.dispatchEvent(new Event('sfo:opplast'));
  visMelding('Kodene er lagret. Appen låses hver gang den lukkes eller skjermen slås av.', 'ok');
}

// ---------- Låse og låse opp ----------

/** Låser appen og viser låseskjermen til riktig kode er skrevet. */
export function laas() {
  if (oppsettPagaar) return Promise.resolve();
  if (lasJobb) return lasJobb;
  settLast(true);
  aktivt?.avbrytHelt();
  aapne();
  // Husk når appen sist var i bruk, så initialene kan gjelde videre en stund (K-18).
  const forrige = hentSesjonInitialer();
  if (forrige) lagreInnstilling('sisteInitialer', { verdi: forrige, tid: new Date().toISOString() });
  lasJobb = (async () => {
    let bytt = false;
    for (;;) {
      const lagret = lesLagredeInitialer(await hentInnstilling('sisteInitialer'));
      const gyldig = lagret && !maaSporeInitialer(lagret);
      // «Låses opp som KT · Bytt»: koden låser opp med samme initialer, eller spør etter nye.
      const linje = h('p', { class: 'las-som', id: 'las-som' });
      const visLinje = () => {
        if (bytt || !gyldig) {
          linje.replaceChildren(bytt ? 'Du skriver initialene dine etter koden.' : '');
          return;
        }
        linje.replaceChildren(`Låses opp som ${lagret.verdi} · `,
          h('button', { type: 'button', class: 'knapp-lenke las-bytt', id: 'las-bytt', onclick: () => { bytt = true; visLinje(); } }, 'Bytt'));
      };
      visLinje();
      const svar = await steg({
        logo: true,
        tittel: 'SFO-appen',
        tekst: 'Skriv inn koden',
        under: linje,
        lengde: ANSATT_LENGDE,
        startVent: gjenstaendeVent(await hentInnstilling('kode-feil-ansatt')),
        kontroller: (k) => proveKode(k, 'kode-ansatt', 'kode-feil-ansatt'),
        ekstra: { tekst: 'Glemt koden?', verdi: 'glemt', id: 'las-glemt' },
      });
      if (svar === 'glemt') {
        if (await nullstillAnsattkode()) break;
        continue;
      }
      if (svar) break;
    }
    const lagret = lesLagredeInitialer(await hentInnstilling('sisteInitialer'));
    let init;
    if (!bytt && lagret && !maaSporeInitialer(lagret)) {
      init = lagret.verdi;
      await lagreInnstilling('sisteInitialer', { verdi: init, tid: new Date().toISOString() });
    } else {
      init = await sporInitialer({ forslag: !bytt });
    }
    lukk();
    lasJobb = null;
    settLast(false);
    settSesjonInitialer(init);
    // Tegn skjermen på nytt med initialene til den som låste opp.
    window.dispatchEvent(new Event('sfo:opplast'));
  })();
  return lasJobb;
}

/** «Glemt koden?»: administratorkoden gir lov til å velge ny kode for ansatte. */
async function nullstillAnsattkode() {
  const svar = await steg({
    tittel: 'Administratorkode',
    tekst: 'Skriv administratorkoden for å velge ny kode for ansatte.',
    lengde: ADMIN_LENGDE,
    avbryt: true,
    startVent: gjenstaendeVent(await hentInnstilling('kode-feil-admin')),
    kontroller: (k) => proveKode(k, 'kode-admin', 'kode-feil-admin'),
  });
  if (svar === null) return false;
  const ny = await nyKode({ lengde: ANSATT_LENGDE, tittel: 'Ny kode for ansatte', tekst: 'Velg en ny kode på 4 siffer. Gi den til alle ansatte på SFO.', avbryt: true });
  if (ny === null) return false;
  await lagreInnstilling('kode-ansatt', await lagKode(ny));
  await lagreInnstilling('kode-feil-ansatt', { antall: 0, sist: null });
  visMelding('Ny kode for ansatte er lagret.', 'ok');
  return true;
}

// ---------- Administrator ----------

/**
 * Ber om administratorkoden hvis administratormodus ikke er på. Modusen varer til appen låses.
 * Returnerer true hvis brukeren har tilgang.
 */
export async function krevAdmin(grunn = 'Denne handlingen krever administratorkode.') {
  if (erAdmin()) return true;
  if (erLast()) return false;
  aapne();
  const svar = await steg({
    tittel: 'Administratorkode',
    tekst: grunn,
    lengde: ADMIN_LENGDE,
    avbryt: true,
    startVent: gjenstaendeVent(await hentInnstilling('kode-feil-admin')),
    kontroller: (k) => proveKode(k, 'kode-admin', 'kode-feil-admin'),
  });
  if (erLast()) return false; // appen ble låst mens koden ble skrevet
  lukk();
  if (svar === null) return false;
  settAdmin(true);
  return true;
}

export function avsluttAdmin() {
  settAdmin(false);
}

/** Bytt kode for ansatte eller administratorkode (krever administratorkode). */
export async function byttKode(type) {
  const admin = type === 'admin';
  if (!(await krevAdmin(admin ? 'Skriv administratorkoden for å velge ny administratorkode.' : 'Skriv administratorkoden for å bytte koden for ansatte.'))) return false;
  aapne();
  const ny = await nyKode(admin
    ? { lengde: ADMIN_LENGDE, tittel: 'Ny administratorkode', tekst: 'Velg en ny administratorkode på 6 siffer.', avbryt: true }
    : { lengde: ANSATT_LENGDE, tittel: 'Ny kode for ansatte', tekst: 'Velg en ny kode på 4 siffer. Gi den til alle ansatte på SFO.', avbryt: true });
  if (erLast()) return false;
  lukk();
  if (ny === null) return false;
  await lagreInnstilling(admin ? 'kode-admin' : 'kode-ansatt', await lagKode(ny));
  await lagreInnstilling(admin ? 'kode-feil-admin' : 'kode-feil-ansatt', { antall: 0, sist: null });
  visMelding(admin ? 'Ny administratorkode er lagret.' : 'Ny kode for ansatte er lagret. Gi den til alle ansatte på SFO.', 'ok');
  return true;
}

// ---------- Oppstart ----------

/** Kalles ved oppstart: første gang velges koder, ellers låses appen. Låser ved hver skjuling. */
export async function startTilgang() {
  document.addEventListener('visibilitychange', () => {
    if (skalLases(document.visibilityState === 'visible')) laas();
  });
  if (!(await hentInnstilling('kode-ansatt'))) oppsett();
  else laas();
}
