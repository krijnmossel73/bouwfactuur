/**
 * /api/pdf
 *   POST { invoice }  → application/pdf of the draft in the body
 *   GET  ?id=<uuid>   → application/pdf of a saved invoice (own account only)
 * Rendered server-side with pdf-lib (lib/pdf.js): identical output on every
 * device, no print dialog, works on mobile.
 */
import { requireUser, jsonResponse } from '../../../lib/auth.js';
import { renderInvoicePdf } from '../../../lib/pdf.js';
import { rowToInvoice } from '../../../lib/invoices.js';

function pdfResponse(bytes, number) {
  const name = `factuur-${String(number || 'concept').replace(/[^\w.-]+/g, '_')}.pdf`;
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function onRequestPost(context) {
  const auth = requireUser(context);
  if (auth.err) return auth.err;
  let body;
  try { body = await context.request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const inv = body?.invoice || body;
  if (!inv || typeof inv !== 'object' || !Array.isArray(inv.lines)) return jsonResponse({ error: 'invalid_invoice' }, 400);
  if (inv.lines.length > 500) return jsonResponse({ error: 'too_many_lines' }, 413);
  try {
    const bytes = await renderInvoicePdf(inv);
    return pdfResponse(bytes, inv.nummer || inv.project?.factuurnummer);
  } catch (err) {
    return jsonResponse({ error: 'pdf_failed', detail: String(err?.message || err) }, 500);
  }
}

export async function onRequestGet(context) {
  const auth = requireUser(context);
  if (auth.err) return auth.err;
  if (!context.env?.DB) return jsonResponse({ error: 'storage_unavailable' }, 503);
  const id = new URL(context.request.url).searchParams.get('id') || '';
  if (!/^[\w-]{1,64}$/.test(id)) return jsonResponse({ error: 'invalid_id' }, 400);
  const row = await context.env.DB
    .prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ? AND deleted_at IS NULL')
    .bind(id, auth.user.id)
    .first();
  if (!row) return jsonResponse({ error: 'not_found' }, 404);
  try {
    const inv = rowToInvoice(row);
    const bytes = await renderInvoicePdf(inv);
    return pdfResponse(bytes, inv.nummer);
  } catch (err) {
    return jsonResponse({ error: 'pdf_failed', detail: String(err?.message || err) }, 500);
  }
}
