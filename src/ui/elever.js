// Elevregisteret (K-03, K-04, K-05): liste med søk, legge til, redigere og deaktivere elever.
// Faste avtaler (K-40, K-41) redigeres på samme side.
import { h, visDialog, visMelding } from '../dom.js';
import { hent, hentAlle, nyId, utforEndringer } from '../db.js';
import {
  ALLE_SKOLEGRUPPER, MAKS_MERKNAD, SKOLEGRUPPER, UKEDAGER, avtaleFra, kontrollerElev, navnNokkel,
} from '../model/elev.js';
import { elevRad, pilVenstre, skjermTopp, sokMedKryss, sorterElever } from './felles.js';
import { krevAdmin } from './las.js';
import { hentInitialer } from '../dag.js';
import { erAdmin } from '../tilgang.js';

// ---------- Liste ----------

export async function visEleverListe() {
  const [alle, avtaler] = await Promise.all([hentAlle('elever'), hentAlle('avtaler')]);
  const avtaleFor = new Map(avtaler.map((a) => [a.elevId, a]));
  const aktive = sorterElever(alle.filter((e) => e.aktiv !== false));
  const deaktiverte = sorterElever(alle.filter((e) => e.aktiv === false));
  const rad = (e) => elevRad(e, { avtale: avtaleFor.get(e.id), lenke: `#elev/${e.id}` });

  const liste = h('ul', { class: 'liste', id: 'elevliste' }, aktive.map(rad));
  const ingenTreff = h('p', { class: 'dempet', hidden: true }, 'Ingen elever passer søket.');
  const sok = h('input', {
    id: 'sok', type: 'search', placeholder: 'Navn, trinn eller gruppe', autocomplete: 'off',
    oninput: () => {
      const ord = sok.value.toLocaleLowerCase('nb').trim().split(/\s+/).filter(Boolean);
      let synlige = 0;
      for (const li of liste.children) {
        const treff = ord.every((o) => li.dataset.sok.includes(o));
        li.hidden = !treff;
        if (treff) synlige += 1;
      }
      ingenTreff.hidden = synlige > 0 || aktive.length === 0;
    },
  });

  return h('div', { class: 'skjerm' },
    skjermTopp({ tittel: 'Elever', undertittel: `${aktive.length} aktive elever`, visDato: false }),
    h('div', { class: 'knappestabel' },
      h('a', { class: 'knapp knapp-primar knapp-stor knapp-lenkeknapp', href: '#elever/ny', id: 'ny-elev' }, 'Legg til elev')),
    aktive.length > 0 ? h('div', { class: 'felt' },
      h('label', { for: 'sok', class: 'feltnavn' }, 'Søk etter elev'),
      sokMedKryss(sok)) : null,
    aktive.length === 0
      ? h('section', { class: 'kort' }, h('p', { class: 'dempet' }, 'Ingen elever ennå. Legg til elever her, eller importer elevlista fra Excel under Mer.'))
      : [h('p', { class: 'seksjonstittel' }, `Aktive (${aktive.length})`), liste, ingenTreff],
    deaktiverte.length > 0 ? h('details', { class: 'kort teknisk' },
      h('summary', {}, `Deaktiverte elever (${deaktiverte.length})`),
      h('p', { class: 'dempet liten' }, 'Deaktiverte elever vises ikke i dagens lister, men historikken deres er tatt vare på.'),
      h('ul', { class: 'liste' }, deaktiverte.map(rad))) : null);
}

// ---------- Legge til og redigere ----------

/** Viser skjemaet for en elev. id = 'ny' for ny elev. */
export async function visElevSkjema(id, naviger) {
  const ny = id === 'ny';
  // Navn, trinn, gruppe, SFO-dager og deaktivering krever administratorkode (K-72).
  // Faste avtaler og merknad kan alle ansatte endre.
  const admin = erAdmin();
  if (ny && !admin) {
    return h('div', { class: 'skjerm' },
      tilbakeLenke(),
      skjermTopp({ tittel: 'Ny elev', visDato: false }),
      h('section', { class: 'kort' },
        h('p', {}, 'Å legge til elever krever administratorkode. Vanligvis legges elever inn ved å importere elevlista under Mer.'),
        h('button', {
          type: 'button', class: 'knapp knapp-primar', id: 'admin-las-opp',
          onclick: async () => { if (await krevAdmin('Å legge til elever krever administratorkode.')) naviger('elever/ny'); },
        }, 'Skriv administratorkode')));
  }
  const elev = ny ? null : await hent('elever', id);
  if (!ny && !elev) {
    return h('div', { class: 'skjerm' },
      tilbakeLenke(),
      h('section', { class: 'kort' }, h('p', {}, 'Fant ikke eleven.')));
  }
  const avtale = ny ? null : await hent('avtaler', id);
  const v = {
    fornavn: elev?.fornavn ?? '',
    etternavn: elev?.etternavn ?? '',
    trinn: elev?.trinn ?? '',
    skolegruppe: elev?.skolegruppe ?? '',
    ukedager: elev?.ukedager ?? [],
    gaarHjemAleneFra: avtale?.gaarHjemAleneFra ?? '',
    fastHentetid: avtale?.fastHentetid ?? '',
    fritekst: avtale?.fritekst ?? '',
  };

  const feilboks = h('div', { class: 'feilboks', role: 'alert', hidden: true });

  const fornavn = tekstfelt('fornavn', 'Fornavn', v.fornavn, { autocomplete: 'off', autocapitalize: 'words', disabled: !admin });
  const etternavn = tekstfelt('etternavn', 'Etternavn', v.etternavn, { autocomplete: 'off', autocapitalize: 'words', disabled: !admin });

  const trinn = h('select', { id: 'trinn', required: true, disabled: !admin },
    h('option', { value: '' }, 'Velg'),
    [1, 2, 3, 4].map((t) => h('option', { value: t, selected: t === v.trinn }, `${t}. trinn`)));
  const gruppe = h('select', { id: 'skolegruppe', required: true, disabled: !admin });
  const fyllGrupper = () => {
    const t = Number(trinn.value);
    const valgt = gruppe.value || v.skolegruppe;
    const lovlige = t ? SKOLEGRUPPER[t] : ALLE_SKOLEGRUPPER;
    gruppe.replaceChildren(
      h('option', { value: '' }, t ? 'Velg' : 'Velg trinn først'),
      ...lovlige.map((g) => h('option', { value: g, selected: g === valgt }, g)));
  };
  fyllGrupper();
  trinn.addEventListener('change', fyllGrupper);

  const dager = UKEDAGER.map((d) => {
    const boks = h('input', { type: 'checkbox', value: d.nr, checked: v.ukedager.includes(d.nr), 'aria-label': d.navn, disabled: !admin });
    return { boks, el: h('label', { class: 'dagvalg' }, boks, h('span', {}, d.kort)) };
  });

  const alene = h('input', { id: 'alene', type: 'time', value: v.gaarHjemAleneFra ?? '', step: 300 });
  const hentetid = h('input', { id: 'hentetid', type: 'time', value: v.fastHentetid ?? '', step: 300 });
  const merknad = h('textarea', { id: 'merknad', rows: 3, maxlength: MAKS_MERKNAD, 'aria-describedby': 'merknad-hjelp' }, v.fritekst);

  const lagre = async () => {
    const { verdi, feil } = kontrollerElev({
      fornavn: fornavn.input.value,
      etternavn: etternavn.input.value,
      trinn: trinn.value,
      skolegruppe: gruppe.value,
      ukedager: dager.filter((d) => d.boks.checked).map((d) => Number(d.boks.value)),
      gaarHjemAleneFra: alene.value,
      fastHentetid: hentetid.value,
      fritekst: merknad.value,
    });
    if (feil.length) {
      feilboks.replaceChildren(h('p', {}, 'Rett dette før du lagrer:'), h('ul', {}, feil.map((f) => h('li', {}, f))));
      feilboks.hidden = false;
      feilboks.scrollIntoView({ block: 'center' });
      return;
    }
    feilboks.hidden = true;

    const andre = (await hentAlle('elever')).filter((e) => e.id !== id && e.aktiv !== false);
    const likt = andre.find((e) => navnNokkel(e.fornavn, e.etternavn) === navnNokkel(verdi.fornavn, verdi.etternavn) && e.trinn === verdi.trinn);
    if (likt) {
      const svar = await visDialog({
        tittel: 'Samme navn finnes',
        innhold: [h('p', {}, `Det finnes allerede en aktiv elev som heter ${likt.fornavn} ${likt.etternavn} på ${likt.trinn}. trinn (${likt.skolegruppe}).`),
          h('p', {}, 'Er dette en annen elev med samme navn?')],
        knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: 'Ja, lagre', verdi: 'ja', type: 'primar' }],
      });
      if (svar !== 'ja') return;
    }

    const elevId = ny ? nyId() : id;
    const nyElev = {
      ...(elev ?? {}),
      id: elevId,
      fornavn: verdi.fornavn,
      etternavn: verdi.etternavn,
      trinn: verdi.trinn,
      skolegruppe: verdi.skolegruppe,
      ukedager: verdi.ukedager,
      aktiv: elev?.aktiv ?? true,
    };
    // Hvem som endret sist (K-18). Avtalen får egne felter, så det synes hvem som endret avtalene.
    const stempel = { endretAv: await hentInitialer(), endret: new Date().toISOString() };
    const gammelAvtale = avtale ? { gaarHjemAleneFra: avtale.gaarHjemAleneFra, fastHentetid: avtale.fastHentetid, fritekst: avtale.fritekst } : null;
    const avtaleUten = avtaleFra(elevId, verdi);
    const avtaleEndret = JSON.stringify(gammelAvtale) !== JSON.stringify(avtaleUten && { gaarHjemAleneFra: avtaleUten.gaarHjemAleneFra, fastHentetid: avtaleUten.fastHentetid, fritekst: avtaleUten.fritekst });
    const nyAvtale = avtaleUten && (avtaleEndret ? { ...avtaleUten, ...stempel } : { ...avtaleUten, endretAv: avtale?.endretAv ?? null, endret: avtale?.endret ?? null });
    const elevEndret = ny || ['fornavn', 'etternavn', 'trinn', 'skolegruppe'].some((k) => elev[k] !== nyElev[k]) || (elev.ukedager ?? []).join() !== nyElev.ukedager.join();
    if (elevEndret) Object.assign(nyElev, stempel);
    await utforEndringer({
      lagre: { elever: [nyElev], ...(nyAvtale ? { avtaler: [nyAvtale] } : {}) },
      slett: nyAvtale ? {} : { avtaler: [elevId] },
    });
    visMelding(`${verdi.fornavn} ${verdi.etternavn} er lagret.`, 'ok');
    naviger(ny ? 'elever' : `elev/${elevId}`);
  };

  const settAktiv = async (aktiv) => {
    const navn = `${elev.fornavn} ${elev.etternavn}`;
    const svar = await visDialog({
      tittel: aktiv ? `Aktivere ${navn}?` : `Deaktivere ${navn}?`,
      innhold: [h('p', {}, aktiv
        ? 'Eleven kommer tilbake i dagens lister fra neste SFO-dag i ukeplanen.'
        : 'Eleven forsvinner fra dagens lister. Historikken tas vare på, og eleven kan aktiveres igjen.')],
      knapper: [{ tekst: 'Avbryt', verdi: 'nei' }, { tekst: aktiv ? 'Aktiver' : 'Deaktiver', verdi: 'ja', type: aktiv ? 'primar' : 'fare' }],
    });
    if (svar !== 'ja') return;
    await utforEndringer({ lagre: { elever: [{ ...elev, aktiv, endretAv: await hentInitialer(), endret: new Date().toISOString() }] } });
    visMelding(aktiv ? `${navn} er aktivert.` : `${navn} er deaktivert.`, 'ok');
    naviger('elever');
  };

  const tilbake = ny ? '#elever' : `#elev/${id}`;
  return h('div', { class: 'skjerm' },
    tilbakeLenke(tilbake, ny ? 'Elever' : 'Elevkort'),
    skjermTopp({
      tittel: ny ? 'Ny elev' : `${elev.fornavn} ${elev.etternavn}`,
      undertittel: !ny && elev.aktiv === false ? 'Deaktivert' : null,
      visDato: false,
    }),
    feilboks,
    h('form', { class: 'skjema', novalidate: true, onsubmit: (e) => { e.preventDefault(); lagre(); } },
      h('section', { class: 'kort' },
        h('h2', {}, 'Elev'),
        fornavn.el,
        etternavn.el,
        h('div', { class: 'to-kolonner' },
          h('div', { class: 'felt' }, h('label', { for: 'trinn', class: 'feltnavn' }, 'Trinn'), trinn),
          h('div', { class: 'felt' }, h('label', { for: 'skolegruppe', class: 'feltnavn' }, 'Skolegruppe'), gruppe)),
        h('fieldset', { class: 'felt' },
          h('legend', { class: 'feltnavn' }, 'SFO-dager'),
          h('div', { class: 'dagrad' }, dager.map((d) => d.el))),
        admin ? null : h('div', { class: 'admin-merknad', id: 'krever-admin' },
          h('p', { class: 'dempet liten' }, 'Navn, trinn, gruppe og SFO-dager kan bare endres med administratorkode.'),
          h('button', {
            type: 'button', class: 'knapp knapp-omriss', id: 'admin-las-opp',
            onclick: async () => { if (await krevAdmin('Endring av elevopplysninger krever administratorkode.')) naviger(`elever/${id}`); },
          }, 'Endre elevopplysninger'))),
      h('section', { class: 'kort' },
        h('h2', {}, 'Faste avtaler'),
        h('div', { class: 'to-kolonner' },
          h('div', { class: 'felt' }, h('label', { for: 'alene', class: 'feltnavn' }, 'Går hjem alene fra'), alene),
          h('div', { class: 'felt' }, h('label', { for: 'hentetid', class: 'feltnavn' }, 'Fast hentetid'), hentetid)),
        h('p', { class: 'dempet liten' }, 'La feltene stå tomme hvis eleven ikke har slike avtaler.'),
        h('div', { class: 'felt' },
          h('label', { for: 'merknad', class: 'feltnavn' }, 'Merknad (faste avtaler om henting)'),
          merknad),
        h('p', { class: 'paminnelse', id: 'merknad-hjelp' }, 'Ikke skriv helseopplysninger, barnevernssaker eller foreldretvister her.')),
      h('div', { class: 'knappestabel' },
        h('button', { type: 'submit', class: 'knapp knapp-primar knapp-stor', id: 'lagre-elev' }, 'Lagre'),
        h('a', { class: 'knapp knapp-lenkeknapp', href: tilbake }, 'Avbryt'),
        admin && !ny && elev.aktiv !== false
          ? h('button', { type: 'button', class: 'knapp knapp-fare', id: 'deaktiver', onclick: () => settAktiv(false) }, 'Deaktiver elev')
          : null,
        admin && !ny && elev.aktiv === false
          ? h('button', { type: 'button', class: 'knapp knapp-omriss', id: 'aktiver', onclick: () => settAktiv(true) }, 'Aktiver igjen')
          : null)));
}

function tilbakeLenke(href = '#elever', tekst = 'Elever') {
  return h('a', { class: 'tilbake', href }, pilVenstre(), tekst);
}

function tekstfelt(id, navn, verdi, attrs = {}) {
  const input = h('input', { id, type: 'text', value: verdi, ...attrs });
  return { input, el: h('div', { class: 'felt' }, h('label', { for: id, class: 'feltnavn' }, navn), input) };
}
