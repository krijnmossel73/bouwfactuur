/**
 * Peppol Integration for BouwFactuur
 *
 * Two capabilities:
 * 1. Peppol Directory lookup (free, public API) — check if a recipient
 *    is registered on the Peppol network before sending
 * 2. Send invoice via a Peppol Access Point (requires subscription)
 *
 * For NL companies, the Peppol participant ID uses scheme 0106 (KvK number).
 *
 * Supported Access Point providers (configure via env vars):
 * - Storecove (NL-based, REST API, free sandbox)
 * - eConnect
 * - Any provider with a REST API
 */

/**
 * Check if a company is registered on the Peppol network.
 * Uses the free public Peppol Directory at directory.peppol.eu.
 *
 * @param {string} kvkNummer - KvK number (8 digits)
 * @returns {Promise<{found: boolean, name?: string, error?: string}>}
 */
export async function peppolLookup(kvkNummer) {
  if (!kvkNummer || kvkNummer.replace(/\D/g, '').length !== 8) {
    return { found: false, error: 'Ongeldig KvK-nummer.' };
  }

  const cleaned = kvkNummer.replace(/\D/g, '');

  try {
    const res = await fetch(`/api/peppol/lookup?kvk=${cleaned}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 404) {
      return { found: false, error: null, devMode: true, message: 'Peppol lookup niet beschikbaar in dev-modus.' };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { found: false, error: body.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { found: false, error: 'Peppol Directory timeout.' };
    }
    return { found: false, error: 'Peppol Directory niet bereikbaar.' };
  }
}

/**
 * Send an invoice via Peppol through the configured Access Point.
 * Requires PEPPOL_API_KEY env var on the server.
 *
 * @param {string} xmlString - UBL 2.1 NLCIUS invoice XML
 * @param {string} recipientKvk - Recipient KvK number
 * @param {string} senderKvk - Sender KvK number
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function peppolSend(xmlString, recipientKvk, senderKvk) {
  try {
    const res = await fetch('/api/peppol/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xml: xmlString,
        recipientKvk,
        senderKvk,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 404) {
      return { success: false, error: 'Peppol verzending niet beschikbaar in dev-modus.' };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: 'Kon niet verbinden met Peppol Access Point.' };
  }
}
