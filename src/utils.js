/** Format number as EUR currency, nl-NL locale */
export function fmt(n) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

/** Convert YYYY-MM-DD → DD-MM-YYYY for display */
export function fmtDate(d) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
}

/** Calculate due date from invoice date + term in days */
export function calcVerval(dateStr, days) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + (days || 30));
  return dt.toISOString().split('T')[0];
}

/** Generate a zero-padded invoice number */
export function makeInvoiceNumber(nextNum) {
  const yr = new Date().getFullYear();
  return `${yr}-${String(nextNum).padStart(4, '0')}`;
}

/** Round to 2 decimals (cents) — avoids floating-point artifacts in totals/XML */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate totals from line items.
 * @param {Array} lines
 * @param {boolean} btwVerlegd — VAT reverse charge
 * @param {boolean} useGrek — G-rekening split
 * @param {number} gPerc — G-rekening percentage over labor
 * @param {number} btwTarief — VAT rate in % when not verlegd (21, 9 or 0)
 */
export function calcTotals(lines, btwVerlegd, useGrek, gPerc, btwTarief = 21) {
  const base = lines.reduce(
    (a, l) => {
      const b = parseFloat(l.bedrag) || 0;
      if (l.type === 'arbeid') a.arbeid += b;
      else a.materiaal += b;
      a.sub += b;
      return a;
    },
    { arbeid: 0, materiaal: 0, sub: 0 }
  );

  base.arbeid = round2(base.arbeid);
  base.materiaal = round2(base.materiaal);
  base.sub = round2(base.sub);

  const btwB = btwVerlegd ? 0 : round2(base.sub * (btwTarief / 100));
  const totIncl = round2(base.sub + btwB);
  const gSplit = useGrek ? round2((base.arbeid * gPerc) / 100) : 0;
  const normB = round2(totIncl - gSplit);

  return { ...base, btwB, totIncl, gSplit, normB };
}
