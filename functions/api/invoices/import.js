/**
 * POST /api/invoices/import — restore from a BouwFactuur backup.
 * body { invoices: [...] } → { imported, skipped: [numbers], invoices, next }
 * Invoices whose number already exists are skipped (never overwritten).
 * New ones count towards the free limit like any other creation.
 */
import { jsonResponse } from '../../../lib/auth.js';
import { createInvoice, listInvoices, nextNumber, InvoiceError } from '../../../lib/invoices.js';
import { guard, handleError } from './_shared.js';

export async function onRequestPost(context) {
  const g = guard(context);
  if (g.err) return g.err;
  let body;
  try { body = await context.request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const list = Array.isArray(body?.invoices) ? body.invoices : [];
  if (list.length > 2000) return jsonResponse({ error: 'too_many' }, 413);
  const skipped = [];
  let imported = 0;
  try {
    // Oldest first so any re-allocated numbers stay chronological
    const ordered = [...list].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    for (const inv of ordered) {
      const number = String(inv?.nummer || '').trim();
      if (number) {
        const dup = await g.db.prepare('SELECT 1 FROM invoices WHERE user_id = ? AND number = ?').bind(g.user.id, number).first();
        if (dup) { skipped.push(number); continue; }
      }
      try {
        // Keep the backup's own number verbatim (it is the legal number of that invoice)
        await createInvoice(g.db, g.user, { ...inv, nummer: number || undefined }, { billingLive: g.billingLive, keepNumber: true });
        imported++;
      } catch (err) {
        if (err instanceof InvoiceError && err.status === 409) { skipped.push(number); continue; }
        throw err;
      }
    }
    const invoices = await listInvoices(g.db, g.user.id);
    const next = await nextNumber(g.db, g.user.id);
    return jsonResponse({ imported, skipped, invoices, next });
  } catch (err) {
    return handleError(err);
  }
}
