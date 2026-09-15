/**
 * /api/invoices
 *   GET  → { invoices: [...], next: "2026-0004" }   (runs the one-time kv migration)
 *   GET ?deleted=1 → { invoices: [...] } soft-deleted ones, for the restore view
 *   POST → body: invoice object as built by the app → { invoice, next }
 *          402 subscription_required, 409 number_taken
 */
import { jsonResponse } from '../../../lib/auth.js';
import { listInvoices, listDeletedInvoices, createInvoice, nextNumber, migrateLegacyBlob } from '../../../lib/invoices.js';
import { guard, handleError } from '../../../lib/invoice-handlers.js';

export async function onRequestGet(context) {
  const g = guard(context);
  if (g.err) return g.err;
  try {
    if (new URL(context.request.url).searchParams.get('deleted') === '1') {
      return jsonResponse({ invoices: await listDeletedInvoices(g.db, g.user.id) });
    }
    const migrated = await migrateLegacyBlob(g.db, g.user);
    const invoices = await listInvoices(g.db, g.user.id);
    const next = await nextNumber(g.db, g.user.id);
    return jsonResponse({ invoices, next, migrated });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestPost(context) {
  const g = guard(context);
  if (g.err) return g.err;
  let body;
  try { body = await context.request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const inv = body?.invoice || body;
  if (!inv || typeof inv !== 'object' || !Array.isArray(inv.lines)) return jsonResponse({ error: 'invalid_invoice' }, 400);
  if (JSON.stringify(inv).length > 256 * 1024) return jsonResponse({ error: 'value_too_large' }, 413);
  try {
    const invoice = await createInvoice(g.db, g.user, inv, { billingLive: g.billingLive });
    const next = await nextNumber(g.db, g.user.id);
    return jsonResponse({ invoice, next }, 201);
  } catch (err) {
    return handleError(err);
  }
}
