// Små hjelpere for å bygge grensesnittet uten innerHTML.
// Tekst settes alltid som tekst, så navn fra en Excel-fil aldri kan bli kode.

/**
 * h('button', { class: 'knapp', onclick: fn }, 'Tekst')
 * Attributter som starter med «on» blir hendelser. Barn kan være tekst, noder, lister eller null.
 */
import { naarOpplast } from './tilgang.js';

// Skrivefelt får ikke stavekontroll, autokorrektur eller autofyll, med mindre det er bedt om.
// Da sender ikke nettleserens stavekontroll (for eksempel «forbedret stavekontroll» i Chrome)
// navn og merknader til en skytjeneste. Tastaturappen styres av telefonens innstillinger.
export const SKRIVEFELT_STANDARD = { spellcheck: 'false', autocorrect: 'off', autocomplete: 'off' };

export function h(tag, attrs = {}, ...barn) {
  const el = document.createElement(tag);
  if (tag === 'input' || tag === 'textarea') attrs = { ...SKRIVEFELT_STANDARD, ...attrs };
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  leggTil(el, barn);
  return el;
}

function leggTil(el, barn) {
  for (const b of barn) {
    if (b === null || b === undefined || b === false) continue;
    if (Array.isArray(b)) leggTil(el, b);
    else el.append(b instanceof Node ? b : document.createTextNode(String(b)));
  }
}

/**
 * Viser en modal dialog og venter på valg.
 * knapper: [{ tekst, verdi, type: 'primar' | 'fare' | undefined }]
 * Returnerer verdien til knappen som ble trykket, eller null ved Esc.
 */
export async function visDialog({ tittel, innhold = [], knapper = [{ tekst: 'OK', verdi: true, type: 'primar' }] }) {
  // Mens appen er låst, venter dialogen til koden er skrevet.
  await naarOpplast();
  const dialog = document.getElementById('dialog');
  dialog.replaceChildren(
    h('h2', { class: 'dialog-tittel' }, tittel),
    h('div', { class: 'dialog-innhold' }, innhold),
    h('div', { class: 'dialog-knapper' },
      knapper.map((k) => h('button', {
        type: 'button',
        class: `knapp ${k.type === 'primar' ? 'knapp-primar' : ''} ${k.type === 'fare' ? 'knapp-fare' : ''}`,
        'data-verdi': String(k.verdi),
        onclick: () => dialog.close(String(k.verdi)),
      }, k.tekst))),
  );
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const valgt = knapper.find((k) => String(k.verdi) === dialog.returnValue);
      dialog.returnValue = '';
      resolve(valgt ? valgt.verdi : null);
    }, { once: true });
    dialog.showModal();
  });
}

/**
 * Kort melding nederst på skjermen.
 * handling: { tekst, onclick } gir en knapp i meldingen, for eksempel «Angre».
 */
export function visMelding(tekst, type = 'info', { handling } = {}) {
  let boks = document.getElementById('melding');
  if (!boks) {
    boks = h('div', { id: 'melding', class: 'melding', role: 'status', 'aria-live': 'polite' });
    document.body.append(boks);
  }
  boks.className = `melding melding-${type} synlig${handling ? ' med-handling' : ''}`;
  const skjul = () => boks.classList.remove('synlig');
  boks.replaceChildren(...[
    h('span', {}, tekst),
    handling ? h('button', {
      type: 'button',
      class: 'melding-knapp',
      onclick: () => { skjul(); handling.onclick(); },
    }, handling.tekst) : null,
  ].filter(Boolean));
  clearTimeout(boks._timer);
  boks._timer = setTimeout(skjul, handling ? 8000 : 6000);
}
