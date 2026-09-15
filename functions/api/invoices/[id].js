/**
 * /api/invoices/:id
 *   PATCH  → body { status?: 'open'|'betaald', peppol?: {...}|null } → { invoice }
 *            body { restore: true } → undo a soft delete → { invoice }
 *   DELETE → soft delete (bewaarplicht: the row is kept, hidden from lists)
 * Invoice content is immutable; there is deliberately no PUT.
 */
import { jsonResponse } from '../../../lib/auth.js';
import { patchInvoice, softDeleteInvoice, restoreInvoice } from '../../../lib/invoices.js';
import { guard, handleError } from '../../../lib/invoice-handlers.js';

function id(context) {
  const v = String(context.params.id || '');
  return /^[\w-]{1,64}$/.test(v) ? v : null;
}

export async function onRequestPatch(context) {
  const g = guard(context);
  if (g.err) return g.err;
  const invId = id(context);
  if (!invId) return jsonResponse({ error: 'invalid_id' }, 400);
  let body;
  try { body = await context.request.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  try {
    if (body?.restore === true) {
      const invoice = await restoreInvoice(g.db, g.user.id, invId);
      return jsonResponse({ invoice });
    }
    const invoice = await patchInvoice(g.db, g.user.id, invId, { status: body?.status, peppol: body?.peppol });
    return jsonResponse({ invoice });
  } catch (err) {
    return handleError(err);
  }
}

export async function onRequestDelete(context) {
  const g = guard(context);
  if (g.err) return g.err;
  const invId = id(context);
  if (!invId) return jsonResponse({ error: 'invalid_id' }, 400);
  try {
    await softDeleteInvoice(g.db, g.user.id, invId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
