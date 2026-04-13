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

/** Calculate totals from line items */
export function calcTotals(lines, btwVerlegd, useGrek, gPerc) {
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

  const btwB = btwVerlegd ? 0 : base.sub * 0.21;
  const totIncl = base.sub + btwB;
  const gSplit = useGrek ? (base.arbeid * gPerc) / 100 : 0;
  const normB = totIncl - gSplit;

  return { ...base, btwB, totIncl, gSplit, normB };
}
