// Renders two invoice variants with lib/pdf.js and checks they are valid PDFs.
// Run: npm test
import { renderInvoicePdf, fmtEur, addDays } from '../lib/pdf.js';
const oa = { naam: 'A BV', kvk: '12345678', btw: 'NL001234567B01', iban: 'NL91ABNA0417164300', gRekening: 'NL91ABNA0990000000', adres: 'x 1', postcode: '1', plaats: 'p' };
const og = { naam: 'B BV', kvk: '87654321', btw: 'NL009876543B01', adres: 'y', postcode: '2', plaats: 'q' };
const lines = Array.from({ length: 45 }, (_, i) => ({ omschrijving: `Regel ${i + 1} — “test”`, type: i % 3 ? 'arbeid' : 'materiaal', uren: '2', tarief: '55', bedrag: '110' }));
const inv = { nummer: '2026-0001', oa, og, project: { factuurnummer: '2026-0001', factuurdatum: '2026-09-15', betaaltermijn: 30 }, lines, totals: { sub: 4950, btwB: 0, totIncl: 4950, gSplit: 1980, normB: 2970, arbeid: 4950 }, btwVerlegd: true, useGrek: true, gPerc: 40 };
const a = await renderInvoicePdf(inv);
const b = await renderInvoicePdf({ ...inv, btwVerlegd: false, useGrek: false, lines: lines.slice(0, 3) });
const isPdf = (u) => String.fromCharCode(...u.slice(0, 5)) === '%PDF-';
if (!isPdf(a) || !isPdf(b)) throw new Error('not a PDF');
if (fmtEur(1234.5) !== '€ 1.234,50' || addDays('2026-01-31', 30) !== '2026-03-02') throw new Error('formatting');
console.log('pdf ok', a.length, b.length);
