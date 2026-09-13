/**
 * Cloudflare Pages Function: GET /api/peppol/status?id=<b2brouterInvoiceId>
 *
 * Returns the current delivery state of an invoice sent via B2Brouter.
 * Lifecycle: new → sent → registered (→ accepted | refused), or → error
 * with an error code such as PEPPOL_NO_RECEIVER.
 */

import { requireUser, jsonResponse } from '../../../lib/auth.js';
import { b2bConfigured, getInvoice, STATE_LABELS, B2BrouterError } from '../../../lib/b2brouter.js';

const FINAL = new Set(['registered', 'accepted', 'refused', 'error', 'paid']);

export async function onRequestGet(context) {
  const auth = requireUser(context);
  if (auth.err) return auth.err;

  const env = context.env || {};
  if (!b2bConfigured(env)) return jsonResponse({ error: 'Peppol niet geconfigureerd.' }, 503);

  const id = new URL(context.request.url).searchParams.get('id');
  if (!id || !/^[\w-]+$/.test(id)) return jsonResponse({ error: 'Ongeldig factuur-id.' }, 400);

  try {
    const inv = await getInvoice(env, id);
    return jsonResponse({
      invoiceId: inv.id,
      state: inv.state,
      stateLabel: STATE_LABELS[inv.state] || inv.state,
      final: FINAL.has(inv.state),
      errorCode: inv.errorCode,
      errorMessage: inv.errorMessage,
      updatedAt: inv.updatedAt,
    });
  } catch (err) {
    const status = err instanceof B2BrouterError ? (err.status === 404 ? 404 : 502) : 502;
    return jsonResponse({ error: err.message }, status);
  }
}
