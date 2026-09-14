/**
 * POST /api/peppol/webhook — B2Brouter state-change notifications.
 *
 * Authenticated by the X-B2Brouter-Signature header (t=<unix>,s=<hmac>):
 *   HMAC-SHA256(B2BROUTER_WEBHOOK_SECRET, `${t}.${rawBody}`) === s
 * Timestamps older than 10 minutes are rejected (replay protection).
 *
 * Configure in B2Brouter: Developers → Webhooks → URL
 *   https://bouwfactuur.pages.dev/api/peppol/webhook
 * with the invoice state-change events, and set the signature key as the
 * B2BROUTER_WEBHOOK_SECRET Pages secret. Sandbox and production webhooks
 * are configured separately.
 */

import { jsonResponse } from '../../../lib/auth.js';
import { updatePeppolByRef } from '../../../lib/invoices.js';
import { STATE_LABELS } from '../../../lib/b2brouter.js';

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Pull invoice id + state out of the payload without assuming one exact shape. */
function extract(body) {
  const inv = body?.invoice || body?.data?.invoice || body?.data || body?.object || body || {};
  const id = inv.id ?? inv.invoice_id ?? body?.invoice_id ?? body?.id;
  const state = inv.state ?? body?.state ?? body?.new_state ?? inv.new_state;
  const errorCode = inv.error_code ?? body?.error_code ?? null;
  return { id: id != null ? String(id) : null, state: state ? String(state) : null, errorCode };
}

export async function onRequestPost(context) {
  const secret = context.env?.B2BROUTER_WEBHOOK_SECRET;
  if (!secret) return jsonResponse({ error: 'webhook_not_configured' }, 503);
  if (!context.env?.DB) return jsonResponse({ error: 'storage_unavailable' }, 503);

  const header = context.request.headers.get('X-B2Brouter-Signature') || '';
  const m = header.match(/t=(\d+)\s*,\s*s=([0-9a-f]+)/i);
  if (!m) return jsonResponse({ error: 'missing_signature' }, 401);
  const [, t, s] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 600) return jsonResponse({ error: 'stale_signature' }, 401);

  const raw = await context.request.text();
  const expected = await hmacHex(secret, `${t}.${raw}`);
  if (!timingSafeEqual(expected, s.toLowerCase())) return jsonResponse({ error: 'bad_signature' }, 401);

  let body;
  try { body = JSON.parse(raw); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  const { id, state, errorCode } = extract(body);
  if (!id || !state) return jsonResponse({ ok: true, ignored: true });

  try {
    const updated = await updatePeppolByRef(context.env.DB, id, { state, stateLabel: STATE_LABELS[state] || state, errorCode });
    return jsonResponse({ ok: true, updated });
  } catch (err) {
    return jsonResponse({ error: 'storage_error', detail: String(err?.message || err) }, 500);
  }
}
