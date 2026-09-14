/**
 * Cloudflare Pages Function: POST /api/peppol/send
 *
 * Sends a NLCIUS/Peppol BIS 3.0 UBL invoice through B2Brouter in a single
 * import-and-send call. B2Brouter reads the recipient from the UBL
 * (EndpointID 0106:<KvK>), so no contact management is needed here.
 *
 * Body:     { xml: "...", recipientKvk: "12345678", number?: "2026-0001", invoiceId?: <our id> }
 *           When invoiceId is given, the Peppol state is stored on that row so
 *           the B2Brouter webhook can update it later.
 * Response: { success, invoiceId, state, stateLabel, sandbox, sentAt }
 *           { success: false, error, needsSetup?: true, code?, details? }
 */

import { requireUser, jsonResponse } from '../../../lib/auth.js';
import { b2bConfigured, b2bIsSandbox, importInvoice, STATE_LABELS, B2BrouterError } from '../../../lib/b2brouter.js';
import { patchInvoice } from '../../../lib/invoices.js';

export async function onRequestPost(context) {
  // Sending costs transactions on our B2Brouter plan; anonymous callers are refused.
  const auth = requireUser(context);
  if (auth.err) return auth.err;

  const env = context.env || {};
  if (!b2bConfigured(env)) {
    return jsonResponse({
      success: false,
      needsSetup: true,
      error: 'Peppol is nog niet geconfigureerd. Stel B2BROUTER_API_KEY in als Cloudflare Pages secret.',
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Ongeldig request.' }, 400);
  }

  const { xml, recipientKvk, number, invoiceId } = body || {};
  if (!xml || typeof xml !== 'string' || !xml.includes('<Invoice')) {
    return jsonResponse({ success: false, error: 'Geldige factuur-XML is verplicht.' }, 400);
  }
  if (!recipientKvk || !/^\d{8}$/.test(String(recipientKvk).replace(/\D/g, ''))) {
    return jsonResponse({ success: false, error: 'Ontvanger KvK-nummer (8 cijfers) is verplicht.' }, 400);
  }

  try {
    const fileName = `${(number || 'factuur').replace(/[^\w.-]+/g, '_')}.xml`;
    const inv = await importInvoice(env, xml, { send: true, fileName });
    const peppol = {
      invoiceId: String(inv.id),
      state: inv.state,
      stateLabel: STATE_LABELS[inv.state] || inv.state,
      errorCode: inv.errorCode,
      sandbox: b2bIsSandbox(env),
      sentAt: new Date().toISOString(),
    };
    if (invoiceId && env.DB) {
      try { await patchInvoice(env.DB, auth.user.id, String(invoiceId), { peppol }); } catch { /* row may not exist yet; client PATCHes on save */ }
    }
    return jsonResponse({
      success: true,
      invoiceId: inv.id,
      number: inv.number || number || null,
      state: inv.state,
      stateLabel: STATE_LABELS[inv.state] || inv.state,
      errorCode: inv.errorCode,
      sandbox: b2bIsSandbox(env),
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof B2BrouterError) {
      const friendly = err.status === 401
        ? 'B2Brouter API key ongeldig of verlopen.'
        : err.status === 422 || err.status === 406
          ? `Factuur afgekeurd door B2Brouter: ${err.message}`
          : `B2Brouter fout (HTTP ${err.status}): ${err.message}`;
      return jsonResponse({ success: false, error: friendly, code: err.code || null, details: err.details || null });
    }
    const msg = err?.name === 'TimeoutError' ? 'B2Brouter reageerde niet op tijd.' : `Verzending mislukt: ${err.message}`;
    return jsonResponse({ success: false, error: msg });
  }
}
