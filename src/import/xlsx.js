// Leser og skriver enkle Excel-filer (.xlsx) uten eksterne biblioteker.
//
// En .xlsx-fil er en zip-fil med XML-filer inni. Leseren pakker ut zip-filen med nettleserens
// innebygde DecompressionStream og leser cellene i første ark. Skriveren lager en ukomprimert
// zip-fil med ett eller flere ark, som brukes til den tomme Excel-malen.
//
// Leseren støtter det malen trenger: tekst, tall, ja/nei, tall som er klokkeslett, delte og
// innebygde tekster. Den støtter ikke formler (bare den lagrede verdien leses), passord eller .xls.

const MAKS_STORRELSE = 10 * 1024 * 1024; // 10 MB er langt mer enn en elevliste trenger

// ---------- Zip ----------

function u16(b, i) { return b[i] | (b[i + 1] << 8); }
function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

/** Leser innholdsfortegnelsen i en zip-fil. Returnerer Map navn → { metode, start, lengde, storrelse }. */
function lesZipKatalog(b) {
  // Finn «end of central directory» (signatur 0x06054b50) bakfra.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Filen er ikke en Excel-fil (.xlsx).');

  const antall = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const filer = new Map();
  const dekoder = new TextDecoder();
  for (let n = 0; n < antall; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('Excel-filen er skadet.');
    const metode = u16(b, p + 10);
    const lengde = u32(b, p + 20);
    const storrelse = u32(b, p + 24);
    const navnLengde = u16(b, p + 28);
    const ekstraLengde = u16(b, p + 30);
    const kommentarLengde = u16(b, p + 32);
    const lokal = u32(b, p + 42);
    const navn = dekoder.decode(b.subarray(p + 46, p + 46 + navnLengde));
    if (u32(b, lokal) !== 0x04034b50) throw new Error('Excel-filen er skadet.');
    const start = lokal + 30 + u16(b, lokal + 26) + u16(b, lokal + 28);
    filer.set(navn, { metode, start, lengde, storrelse });
    p += 46 + navnLengde + ekstraLengde + kommentarLengde;
  }
  return filer;
}

async function pakkUt(b, oppforing) {
  const data = b.subarray(oppforing.start, oppforing.start + oppforing.lengde);
  if (oppforing.metode === 0) return data;
  if (oppforing.metode !== 8) throw new Error('Excel-filen bruker en komprimering appen ikke kan lese.');
  if (oppforing.storrelse > MAKS_STORRELSE) throw new Error('Excel-filen er for stor.');
  const strom = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

// ---------- XML ----------

const ENTITETER = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function dekodXml(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITETER[e];
  });
}

function attr(tag, navn) {
  const m = tag.match(new RegExp(`\\s${navn}="([^"]*)"`));
  return m ? dekodXml(m[1]) : null;
}

/** All tekst i <t>-elementer inne i et stykke XML (rik tekst består av flere <r><t>…</t></r>). */
function tekstInni(xml) {
  const utenUttale = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let ut = '';
  for (const m of utenUttale.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) ut += dekodXml(m[1] ?? '');
  return ut;
}

/** «AB12» → kolonneindeks 27 (0-basert) */
function kolonne(ref) {
  const bokstaver = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const c of bokstaver) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ---------- Lesing ----------

/**
 * Leser en .xlsx-fil.
 * Returnerer { ark: [{ navn, rader: [{ rad: Excel-radnummer, celler: [verdier] }] }] }.
 * Celleverdier er tekst, tall eller true/false. Tomme celler er ''.
 */
export async function lesXlsx(arrayBuffer) {
  const b = new Uint8Array(arrayBuffer);
  if (b.length > MAKS_STORRELSE) throw new Error('Filen er for stor til å være en elevliste.');
  if (b.length < 22 || u32(b, 0) !== 0x04034b50) {
    throw new Error('Filen er ikke en Excel-fil (.xlsx). Lagre elevlista som «Excel-arbeidsbok (.xlsx)».');
  }
  const katalog = lesZipKatalog(b);
  const dekoder = new TextDecoder();
  const les = async (navn) => {
    const o = katalog.get(navn);
    return o ? dekoder.decode(await pakkUt(b, o)) : null;
  };

  const arbeidsbok = await les('xl/workbook.xml');
  if (!arbeidsbok) throw new Error('Filen er ikke en Excel-arbeidsbok.');
  const relasjoner = (await les('xl/_rels/workbook.xml.rels')) ?? '';
  const malFor = new Map();
  for (const m of relasjoner.matchAll(/<Relationship\b[^>]*>/g)) malFor.set(attr(m[0], 'Id'), attr(m[0], 'Target'));

  const delteTekster = [];
  const delt = await les('xl/sharedStrings.xml');
  if (delt) for (const m of delt.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) delteTekster.push(tekstInni(m[1] ?? ''));

  const ark = [];
  for (const m of arbeidsbok.matchAll(/<sheet\b[^>]*>/g)) {
    const navn = attr(m[0], 'name');
    const rid = attr(m[0], 'r:id');
    let mal = malFor.get(rid) ?? '';
    mal = mal.startsWith('/') ? mal.slice(1) : `xl/${mal.replace(/^\.\//, '')}`;
    const xml = await les(mal);
    ark.push({ navn, rader: xml ? lesArk(xml, delteTekster) : [] });
  }
  if (ark.length === 0) throw new Error('Excel-filen har ingen ark.');
  return { ark };
}

function lesArk(xml, delteTekster) {
  const rader = [];
  let nesteRad = 1;
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const radNr = Number(attr(rm[0].slice(0, rm[0].indexOf('>') + 1), 'r')) || nesteRad;
    nesteRad = radNr + 1;
    const celler = [];
    let nesteKol = 0;
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const start = `<c${cm[1]}>`;
      const ref = attr(start, 'r');
      const kol = ref ? kolonne(ref) : nesteKol;
      nesteKol = kol + 1;
      const type = attr(start, 't');
      const indre = cm[2] ?? '';
      const v = indre.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let verdi = '';
      if (type === 's') verdi = delteTekster[Number(v)] ?? '';
      else if (type === 'inlineStr') verdi = tekstInni(indre.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
      else if (type === 'str') verdi = v !== undefined ? dekodXml(v) : '';
      else if (type === 'b') verdi = v === '1';
      else if (type === 'e') verdi = '';
      else if (v !== undefined && v !== '') verdi = Number(v);
      while (celler.length < kol) celler.push('');
      celler[kol] = verdi;
    }
    if (celler.some((c) => c !== '' && c !== null)) rader.push({ rad: radNr, celler });
  }
  return rader;
}

// ---------- Skriving ----------

const CRC_TABELL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABELL[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Lager en ukomprimert zip-fil av [{ navn, data: Uint8Array }]. */
function lagZip(filer) {
  const koder = new TextEncoder();
  const deler = [];
  const katalog = [];
  let offset = 0;
  const skriv16 = (v, i, x) => { x[i] = v & 0xff; x[i + 1] = (v >>> 8) & 0xff; };
  const skriv32 = (v, i, x) => { skriv16(v & 0xffff, i, x); skriv16(v >>> 16, i + 2, x); };

  for (const f of filer) {
    const navn = koder.encode(f.navn);
    const crc = crc32(f.data);
    const lokal = new Uint8Array(30 + navn.length);
    skriv32(0x04034b50, 0, lokal);
    skriv16(20, 4, lokal); // versjon
    skriv16(0x0800, 6, lokal); // UTF-8-navn
    skriv16(0, 8, lokal); // lagret, ikke komprimert
    skriv32(crc, 14, lokal);
    skriv32(f.data.length, 18, lokal);
    skriv32(f.data.length, 22, lokal);
    skriv16(navn.length, 26, lokal);
    lokal.set(navn, 30);

    const sentral = new Uint8Array(46 + navn.length);
    skriv32(0x02014b50, 0, sentral);
    skriv16(20, 4, sentral);
    skriv16(20, 6, sentral);
    skriv16(0x0800, 8, sentral);
    skriv32(crc, 16, sentral);
    skriv32(f.data.length, 20, sentral);
    skriv32(f.data.length, 24, sentral);
    skriv16(navn.length, 28, sentral);
    skriv32(offset, 42, sentral);
    sentral.set(navn, 46);

    deler.push(lokal, f.data);
    katalog.push(sentral);
    offset += lokal.length + f.data.length;
  }
  const katalogLengde = katalog.reduce((s, k) => s + k.length, 0);
  const slutt = new Uint8Array(22);
  skriv32(0x06054b50, 0, slutt);
  skriv16(filer.length, 8, slutt);
  skriv16(filer.length, 10, slutt);
  skriv32(katalogLengde, 12, slutt);
  skriv32(offset, 16, slutt);

  const ut = new Uint8Array(offset + katalogLengde + 22);
  let p = 0;
  for (const d of [...deler, ...katalog, slutt]) { ut.set(d, p); p += d.length; }
  return ut;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function kolonneNavn(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function arkXml({ rader, bredder = [], frysForsteRad = false }) {
  const kol = bredder.length
    ? `<cols>${bredder.map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const visning = frysForsteRad
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';
  const radXml = rader.map((rad, r) => `<row r="${r + 1}">${rad.map((v, c) => {
    if (v === '' || v === null || v === undefined) return '';
    const ref = `${kolonneNavn(c)}${r + 1}`;
    const stil = r === 0 && frysForsteRad ? ' s="1"' : '';
    if (typeof v === 'number') return `<c r="${ref}"${stil}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${stil}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${visning}${kol}<sheetData>${radXml}</sheetData></worksheet>`;
}

/**
 * Lager en .xlsx-fil. ark: [{ navn, rader: [[verdier]], bredder?: [tall], frysForsteRad?: true }]
 * Første rad i ark med frysForsteRad blir fet og låst. Returnerer Uint8Array.
 */
export function skrivXlsx(ark) {
  const k = new TextEncoder();
  const filer = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ark.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${ark.map((a, i) => `<sheet name="${esc(a.navn)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ark.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${ark.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...ark.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, arkXml(a)]),
  ];
  return lagZip(filer.map(([navn, tekst]) => ({ navn, data: k.encode(tekst) })));
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
