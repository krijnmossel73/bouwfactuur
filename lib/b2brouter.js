/**
 * B2Brouter API client (Peppol Access Point).
 *
 * Docs: https://docs.b2brouter.net/en/developers/overview
 * Ref:  https://developer.b2brouter.net/reference
 *
 * One base URL for both environments; the key decides the environment:
 * keys starting with "test_" are routed to the sandbox, "prod_" (or no
 * prefix) to production. Sandbox never touches the real Peppol network.
 *
 * Environment variables:
 *   B2BROUTER_API_KEY      required (secret). test_… or prod_…
 *   B2BROUTER_ACCOUNT_ID   optional. Issuing account; resolved via GET /accounts
 *                          and cached when omitted (fine for a single-account key)
 *   B2BROUTER_API_VERSION  optional. Pinned X-B2B-API-Version, default 2026-06-26
 *   B2BROUTER_API_URL      optional. Default https://api.b2brouter.net
 */

const DEFAULT_URL = 'https://api.b2brouter.net';
const DEFAULT_VERSION = '2026-06-26';

export function b2bConfigured(env) {
  return Boolean(env?.B2BROUTER_API_KEY);
}

export function b2bIsSandbox(env) {
  return String(env?.B2BROUTER_API_KEY || '').startsWith('test_');
}

export class B2BrouterError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'B2BrouterError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function baseUrl(env) {
  return (env?.B2BROUTER_API_URL || DEFAULT_URL).replace(/\/+$/, '');
}

function headers(env, extra = {}) {
  return {
    'X-B2B-API-Key': env.B2BROUTER_API_KEY,
    'X-B2B-API-Version': env.B2BROUTER_API_VERSION || DEFAULT_VERSION,
    Accept: 'application/json',
    ...extra,
  };
}

/**
 * Normalise B2Brouter error bodies. They come as
 *   { error: { code, message, details? } }  or  { errors: [...] }  or plain text.
 */
async function toError(res) {
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  const err = body?.error || {};
  const message = err.message
    || (Array.isArray(body?.errors) ? body.errors.map((e) => (typeof e === 'string' ? e : e.message || JSON.stringify(e))).join('; ') : null)
    || text.substring(0, 300)
    || `HTTP ${res.status}`;
  return new B2BrouterError(message, {
    status: res.status,
    code: err.code,
    details: err.details || body?.errors || null,
  });
}

async function request(env, path, { method = 'GET', body, contentType, timeout = 20000 } = {}) {
  const res = await fetch(`${baseUrl(env)}${path}`, {
    method,
    headers: headers(env, contentType ? { 'Content-Type': contentType } : {}),
    body,
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

// ── Account ────────────────────────────────────────────────────────────

let accountCache = { key: '', id: null };

/** Issuing account id: from env, or the first account visible to the key. */
export async function resolveAccountId(env) {
  if (env.B2BROUTER_ACCOUNT_ID) return String(env.B2BROUTER_ACCOUNT_ID);
  if (accountCache.id && accountCache.key === env.B2BROUTER_API_KEY) return accountCache.id;

  const data = await request(env, '/accounts?offset=0&limit=25');
  const list = Array.isArray(data) ? data : data?.accounts || data?.data || [];
  const first = list[0];
  if (!first?.id) {
    throw new B2BrouterError('Geen B2Brouter-account gevonden voor deze API key. Stel B2BROUTER_ACCOUNT_ID in.', { status: 404 });
  }
  accountCache = { key: env.B2BROUTER_API_KEY, id: String(first.id) };
  return accountCache.id;
}

// ── Invoices ───────────────────────────────────────────────────────────

/**
 * Import a UBL invoice and (by default) queue it for sending in one call.
 * B2Brouter reads the recipient from AccountingCustomerParty/EndpointID,
 * matches or creates the contact, and picks transport/document type from
 * its directory. Returns the invoice representation (id, state, number…).
 *
 * POST /accounts/{id}/invoices/import?send_after_import=true
 * Body: data URI (documented import format), content-type octet-stream.
 */
export async function importInvoice(env, xml, { send = true, fileName = 'factuur.xml' } = {}) {
  const accountId = await resolveAccountId(env);
  const b64 = toBase64(new TextEncoder().encode(xml));
  const params = new URLSearchParams({ send_after_import: String(send), issued: 'true' });
  const inv = await request(env, `/accounts/${encodeURIComponent(accountId)}/invoices/import?${params}`, {
    method: 'POST',
    contentType: 'application/octet-stream',
    body: `data:text/xml;name=${encodeURIComponent(fileName)};base64,${b64}`,
    timeout: 30000,
  });
  return normaliseInvoice(inv);
}

/** GET /invoices/{id} */
export async function getInvoice(env, id) {
  const inv = await request(env, `/invoices/${encodeURIComponent(id)}`);
  return normaliseInvoice(inv);
}

/** GET /invoices/{id}/validate (pre-send validation of an existing invoice) */
export async function validateInvoice(env, id) {
  return request(env, `/invoices/${encodeURIComponent(id)}/validate`);
}

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function normaliseInvoice(raw) {
  const inv = raw?.invoice || raw || {};
  return {
    id: inv.id,
    number: inv.number,
    state: inv.state,               // new | sent | registered | refused | error | …
    errorCode: inv.error_code || inv.errorCode || null,
    errorMessage: inv.error_message || inv.errorMessage || inv.last_error || null,
    transport: inv.transport_type_code || inv.transport || null,
    documentType: inv.document_type_code || null,
    updatedAt: inv.updated_at || null,
    raw: inv,
  };
}

// ── Directory (Peppol participant lookup via B2Brouter) ────────────────

/**
 * GET /directory/nl/0106/{kvk}
 * Always async: first call returns 202, poll the same URL until 200/404/422/424.
 * In the sandbox the real SML is never queried; use the public Peppol Directory
 * for real-world checks (functions/api/peppol/lookup.js does).
 */
export async function directoryLookupKvk(env, kvk, { attempts = 4, delayMs = 1200 } = {}) {
  const path = `/directory/nl/0106/${encodeURIComponent(kvk)}`;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${baseUrl(env)}${path}`, { headers: headers(env), signal: AbortSignal.timeout(10000) });
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    if (res.status === 404) return { found: false };
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    const invoice = data?.Invoice || data?.invoice || null;
    return {
      found: true,
      name: data?.name || null,
      transport: invoice?.transport_type_code || null,
      documentType: invoice?.document_type_code || null,
      raw: data,
    };
  }
  return { found: false, pending: true };
}

/** Dutch labels for B2Brouter invoice states shown in the UI. */
export const STATE_LABELS = {
  new: 'Concept bij Access Point',
  draft: 'Concept bij Access Point',
  issued: 'Uitgegeven',
  sending: 'Wordt verzonden',
  sent: 'Verzonden',
  registered: 'Afgeleverd bij ontvanger',
  accepted: 'Geaccepteerd door ontvanger',
  refused: 'Geweigerd door ontvanger',
  error: 'Fout bij verzenden',
  paid: 'Betaald',
};
