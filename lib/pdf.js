/**
 * Server-side PDF rendering of a BouwFactuur invoice with pdf-lib.
 * Pure JavaScript, runs in the Workers runtime (no browser, no fonts to
 * ship: Helvetica is a PDF standard font). Layout mirrors InvoicePDF.jsx.
 *
 * renderInvoicePdf(invoice) → Uint8Array
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const A4 = { w: 595.28, h: 841.89 };
const M = 48;                       // page margin
const C = {
  amber: rgb(0.851, 0.467, 0.024),  // #D97706
  amberDark: rgb(0.573, 0.251, 0.055),
  amberBg: rgb(0.996, 0.953, 0.78),
  greenDark: rgb(0.086, 0.396, 0.204),
  greenBg: rgb(0.941, 0.992, 0.957),
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.42, 0.447, 0.502),
  line: rgb(0.898, 0.886, 0.859),
  panel: rgb(0.976, 0.969, 0.953),
  white: rgb(1, 1, 1),
};

// ── formatting (no Intl dependency, so identical everywhere) ──
export function fmtEur(n) {
  const v = Number(n) || 0;
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}€ ${grouped},${dec}`;
}
export function fmtDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || '—');
}
export function addDays(iso, days) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + (parseInt(days, 10) || 0)));
  return d.toISOString().slice(0, 10);
}
const S = (v, dash = '—') => (v === undefined || v === null || v === '' ? dash : String(v));

// WinAnsi can't encode everything; swap the few characters users type that
// Helvetica lacks so encoding never throws.
function safe(str) {
  return String(str).replace(/[\u2013\u2014]/g, '-').replace(/\u2192/g, '->').replace(/[^\x20-\xFF\u20AC\u2018\u2019\u201C\u201D\u2022\u2026]/g, '?');
}

export async function renderInvoicePdf(inv) {
  const { oa = {}, og = {}, project = {}, lines = [], totals = {}, btwVerlegd, btwTarief = 21, useGrek, gPerc } = inv || {};
  const { sub = 0, btwB = 0, totIncl = 0, gSplit = 0, normB = 0, arbeid = 0 } = totals;
  const number = inv.nummer || project.factuurnummer || '—';
  const verval = addDays(project.factuurdatum, project.betaaltermijn);

  const doc = await PDFDocument.create();
  doc.setTitle(`Factuur ${number}`);
  doc.setAuthor(safe(oa.naam || 'BouwFactuur'));
  doc.setProducer('BouwFactuur');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const W = A4.w - 2 * M;

  const text = (str, x, yy, { size = 10, f = font, color = C.text, align = 'left', maxWidth } = {}) => {
    let s = safe(str);
    if (maxWidth) while (s.length > 1 && f.widthOfTextAtSize(s, size) > maxWidth) s = s.slice(0, -2) + '…';
    const w = f.widthOfTextAtSize(s, size);
    const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    page.drawText(s, { x: xx, y: yy, size, font: f, color });
    return w;
  };
  const rect = (x, yy, w, h, color, borderColor) => page.drawRectangle({ x, y: yy, width: w, height: h, color, borderColor, borderWidth: borderColor ? 0.75 : 0 });
  const hline = (yy, color = C.line, thickness = 0.75) => page.drawLine({ start: { x: M, y: yy }, end: { x: M + W, y: yy }, thickness, color });
  const label = (str, x, yy) => text(str.toUpperCase(), x, yy, { size: 7, f: bold, color: C.muted });

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
    text(`Factuur ${number} (vervolg)`, M, y, { size: 9, color: C.muted });
    y -= 22;
  };
  const ensure = (needed) => { if (y - needed < M + 40) newPage(); };

  // ── Header ──
  text('FACTUUR', M, y - 16, { size: 20, f: bold, color: C.amber });
  text(`Nr. ${number}   |   Datum: ${fmtDate(project.factuurdatum)}`, M, y - 32, { size: 9, color: C.muted });
  if (project.contractNummer) text(`Contract: ${project.contractNummer}`, M, y - 44, { size: 9, color: C.muted });
  const rx = M + W;
  text(S(oa.naam), rx, y - 12, { size: 11, f: bold, align: 'right' });
  text(S(oa.adres, ''), rx, y - 25, { size: 9, align: 'right' });
  text(`${S(oa.postcode, '')} ${S(oa.plaats, '')}`.trim(), rx, y - 37, { size: 9, align: 'right' });
  text(`KvK: ${S(oa.kvk)}  |  BTW: ${S(oa.btw)}`, rx, y - 50, { size: 8, color: C.muted, align: 'right' });
  y -= 62;
  hline(y, C.amber, 2);
  y -= 24;

  // ── Addresses ──
  const colW = W / 2 - 15;
  label('Opdrachtgever', M, y);
  label('Project', M + W / 2 + 15, y);
  y -= 14;
  text(S(og.naam), M, y, { size: 10, f: bold, maxWidth: colW });
  text(S(project.projectNaam), M + W / 2 + 15, y, { size: 10, f: bold, maxWidth: colW });
  y -= 13;
  text(S(og.adres, ''), M, y, { size: 9, maxWidth: colW });
  text(`Betaaltermijn: ${S(project.betaaltermijn, '30')} dagen  |  Vervaldatum: ${fmtDate(verval)}`, M + W / 2 + 15, y, { size: 8, color: C.muted, maxWidth: colW });
  y -= 12;
  text(`${S(og.postcode, '')} ${S(og.plaats, '')}`.trim(), M, y, { size: 9 });
  y -= 12;
  text(`KvK: ${S(og.kvk)}  |  BTW: ${S(og.btw)}`, M, y, { size: 8, color: C.muted });
  y -= 24;

  // ── Lines table ──
  const cols = { desc: M, type: M + W - 250, uren: M + W - 190, tarief: M + W - 110, bedrag: M + W };
  const header = () => {
    label('Omschrijving', cols.desc, y);
    label('Type', cols.type, y);
    text('UREN', cols.uren, y, { size: 7, f: bold, color: C.muted, align: 'right' });
    text('TARIEF', cols.tarief, y, { size: 7, f: bold, color: C.muted, align: 'right' });
    text('BEDRAG', cols.bedrag, y, { size: 7, f: bold, color: C.muted, align: 'right' });
    y -= 6;
    hline(y, C.text, 1);
    y -= 14;
  };
  header();
  for (const l of lines) {
    ensure(18);
    if (y === A4.h - M - 22) header(); // first row on a continuation page
    text(S(l.omschrijving), cols.desc, y, { size: 10, maxWidth: cols.type - cols.desc - 10 });
    text(String(l.type || '').toUpperCase(), cols.type, y, { size: 7, color: C.muted });
    text(S(l.uren), cols.uren, y, { size: 10, align: 'right' });
    text(l.tarief ? fmtEur(parseFloat(l.tarief)) : '—', cols.tarief, y, { size: 10, align: 'right' });
    text(l.bedrag ? fmtEur(parseFloat(l.bedrag)) : '—', cols.bedrag, y, { size: 10, align: 'right' });
    y -= 6;
    hline(y);
    y -= 12;
  }

  // ── Totals ──
  ensure(70);
  y -= 4;
  text('SUBTOTAAL EXCL. BTW', cols.tarief, y, { size: 8, f: bold, align: 'right' });
  text(fmtEur(sub), cols.bedrag, y, { size: 10, f: bold, align: 'right' });
  y -= 15;
  const btwColor = btwVerlegd ? C.amber : C.text;
  text(`BTW ${btwVerlegd ? 21 : btwTarief}%${btwVerlegd ? '  -  VERLEGD' : ''}`, cols.tarief, y, { size: 8, f: btwVerlegd ? bold : font, color: btwColor, align: 'right' });
  text(btwVerlegd ? fmtEur(0) : fmtEur(btwB), cols.bedrag, y, { size: 10, color: btwColor, align: 'right' });
  y -= 20;
  text('Totaal', cols.tarief, y, { size: 14, f: bold, align: 'right' });
  text(fmtEur(totIncl), cols.bedrag, y, { size: 14, f: bold, align: 'right' });
  y -= 22;

  // ── BTW verlegd banner ──
  if (btwVerlegd) {
    ensure(30);
    rect(M, y - 8, W, 24, C.amber);
    text('BTW VERLEGD - Art. 12 lid 5 Wet op de omzetbelasting 1968', M + W / 2, y, { size: 9, f: bold, color: C.white, align: 'center' });
    y -= 30;
  }

  // ── Payment ──
  const payH = useGrek ? 118 : 74;
  ensure(payH + 10);
  rect(M, y - payH + 12, W, payH, C.panel, C.line);
  let py = y - 4;
  label('Betalingsgegevens', M + 12, py);
  py -= 14;
  if (useGrek) {
    text('Gelieve het factuurbedrag als volgt te voldoen conform de Wet Ketenaansprakelijkheid:', M + 12, py, { size: 8, color: C.muted });
    py -= 12;
    const bw = (W - 36) / 2;
    const bh = 68;
    rect(M + 12, py - bh + 4, bw, bh, C.amberBg, rgb(0.992, 0.902, 0.541));
    rect(M + 24 + bw, py - bh + 4, bw, bh, C.greenBg, rgb(0.733, 0.969, 0.816));
    label('G-rekening', M + 22, py - 8);
    text(fmtEur(gSplit), M + 22, py - 26, { size: 15, f: bold, color: C.amberDark });
    text(S(oa.gRekening), M + 22, py - 40, { size: 9, color: C.amberDark });
    text(`(${S(gPerc, '0')}% x arbeid ${fmtEur(arbeid)})`, M + 22, py - 52, { size: 7, color: C.amberDark });
    label('Normaal rekening', M + 34 + bw, py - 8);
    text(fmtEur(normB), M + 34 + bw, py - 26, { size: 15, f: bold, color: C.greenDark });
    text(S(oa.iban), M + 34 + bw, py - 40, { size: 9, color: C.greenDark });
  } else {
    text('IBAN: ', M + 12, py, { size: 10 });
    text(S(oa.iban), M + 12 + font.widthOfTextAtSize('IBAN: ', 10), py, { size: 10, f: bold });
    py -= 14;
    text('Bedrag: ', M + 12, py, { size: 10 });
    text(fmtEur(totIncl), M + 12 + font.widthOfTextAtSize('Bedrag: ', 10), py, { size: 10, f: bold });
    py -= 13;
    text(`o.v.v. factuurnummer ${number}`, M + 12, py, { size: 8, color: C.muted });
  }
  y -= payH + 4;

  // ── Wka footer ──
  const wka = [
    `Wka-vermelding: Kenmerk overeenkomst: ${S(project.contractNummer)}. Benaming werk: ${S(project.projectNaam)}. Tijdvak: ${fmtDate(project.factuurdatum)}.`,
    useGrek ? `Storting G-rekening: ${fmtEur(gSplit)} (${S(gPerc, '0')}% over loonkostenbestanddeel).` : '',
    btwVerlegd ? `BTW verlegd naar ${S(og.naam, 'opdrachtgever')}, BTW-nr: ${S(og.btw)}.` : '',
  ].filter(Boolean).join(' ');
  const wrapped = wrap(safe(wka), font, 7.5, W - 24);
  const wh = wrapped.length * 10 + 14;
  ensure(wh + 6);
  rect(M, y - wh + 10, W, wh, C.panel, C.line);
  let wy = y - 2;
  for (const ln of wrapped) { text(ln, M + 12, wy, { size: 7.5, color: C.muted }); wy -= 10; }

  // page numbers
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const s = `${i + 1} / ${pages.length}`;
    p.drawText(s, { x: A4.w - M - font.widthOfTextAtSize(s, 7), y: 24, size: 7, font, color: C.muted });
  });

  return doc.save();
}

function wrap(str, font, size, maxWidth) {
  const words = str.split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
