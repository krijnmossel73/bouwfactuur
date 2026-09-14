/**
 * Peppol integration for BouwFactuur (client side).
 *
 * 1. Recipient lookup in the public Peppol Directory (free) — is the
 *    opdrachtgever registered under 0106:<KvK>?
 * 2. Send the NLCIUS UBL through B2Brouter (Access Point) in one call.
 * 3. Poll the delivery state (sent → registered → accepted/refused).
 *
 * All calls go through our own /api/peppol/* functions with the user's JWT;
 * the B2Brouter API key never reaches the browser.
 */

import { authHeaders } from './storage.js';

export async function peppolLookup(kvkNummer) {
  const cleaned = String(kvkNummer || '').replace(/\D/g, '');
  if (cleaned.length !== 8) return { found: false, error: 'Ongeldig KvK-nummer.' };

  try {
    const res = await fetch(`/api/peppol/lookup?kvk=${cleaned}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 404) {
      return { found: false, error: null, devMode: true, message: 'Peppol lookup niet beschikbaar in dev-modus.' };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { found: false, error: body.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return { found: false, error: err.name === 'TimeoutError' ? 'Peppol Directory timeout.' : 'Peppol Directory niet bereikbaar.' };
  }
}

/**
 * @returns {Promise<{success:boolean, invoiceId?:string, state?:string, stateLabel?:string, sandbox?:boolean, error?:string, needsSetup?:boolean}>}
 */
export async function peppolSend(xmlString, recipientKvk, number, invoiceId = null) {
  try {
    const res = await fetch('/api/peppol/send', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ xml: xmlString, recipientKvk, number, invoiceId }),
      signal: AbortSignal.timeout(40000),
    });
    if (res.status === 404) return { success: false, error: 'Peppol verzending niet beschikbaar in dev-modus.' };
    return await res.json();
  } catch (err) {
    return { success: false, error: err.name === 'TimeoutError' ? 'Access Point reageerde niet op tijd.' : 'Kon niet verbinden met Peppol Access Point.' };
  }
}

/** @returns {Promise<{state?:string, stateLabel?:string, final?:boolean, errorCode?:string, error?:string}>} */
export async function peppolStatus(invoiceId) {
  try {
    const res = await fetch(`/api/peppol/status?id=${encodeURIComponent(invoiceId)}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || `HTTP ${res.status}` };
    return body;
  } catch {
    return { error: 'Status kon niet worden opgehaald.' };
  }
}
