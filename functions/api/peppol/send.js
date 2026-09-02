/**
 * Cloudflare Pages Function: /api/peppol/send
 *
 * Sends a UBL invoice via a Peppol Access Point.
 *
 * Requires environment variables:
 *   PEPPOL_API_KEY     — API key from your Access Point provider
 *   PEPPOL_PROVIDER    — Provider name: "storecove" (default) | "econnect" | "custom"
 *   PEPPOL_API_URL     — Custom API URL (only needed for "custom" provider)
 *   PEPPOL_SENDER_ID   — Your Peppol sender identifier (e.g. legal entity ID)
 *
 * Usage: POST /api/peppol/send
 * Body: { xml: "...", recipientKvk: "12345678", senderKvk: "87654321" }
 *
 * Supported providers:
 * - Storecove (storecove.com) — NL-based, free sandbox, REST API
 * - eConnect (econnect.eu) — NL construction-focused
 * - Custom — any provider with a REST API
 */

// Provider configurations
const PROVIDERS = {
  storecove: {
    // Storecove API: POST /api/v2/document_submissions
    // Docs: https://www.storecove.com/docs/
    sendUrl: 'https://api.storecove.com/api/v2/document_submissions',
    buildRequest: (xml, recipientKvk, senderEntityId, apiKey) => ({
      url: 'https://api.storecove.com/api/v2/document_submissions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        legalEntityId: senderEntityId,
        routing: {
          eIdentifiers: [{
            scheme: 'NL:KVK',
            id: recipientKvk,
          }],
        },
        document: {
          documentType: 'invoice',
          rawDocumentData: {
            document: btoa(xml),
            parseStrategy: 'ubl',
          },
        },
      }),
    }),
    parseResponse: (data) => ({
      success: true,
      messageId: data.guid || data.id || 'submitted',
    }),
  },

  econnect: {
    // eConnect API — adapt as needed per their docs
    buildRequest: (xml, recipientKvk, senderEntityId, apiKey, apiUrl) => ({
      url: apiUrl || 'https://api.econnect.eu/v1/invoices',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/xml',
      },
      body: xml,
    }),
    parseResponse: (data) => ({
      success: true,
      messageId: data.messageId || data.id || 'submitted',
    }),
  },
};

import { requireUser } from '../../../lib/auth.js';

export async function onRequestPost(context) {
  // Sending via the Access Point costs money and goes out under our
  // PEPPOL_SENDER_ID, so anonymous callers are refused outright.
  const auth = requireUser(context);
  if (auth.err) return auth.err;

  const corsHeaders = { 'Content-Type': 'application/json' };

  // Check for API key
  const apiKey = context.env?.PEPPOL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Peppol is nog niet geconfigureerd. Stel PEPPOL_API_KEY in via Cloudflare Pages → Settings → Environment variables.',
      needsSetup: true,
    }), { status: 200, headers: corsHeaders });
  }

  // Parse request body
  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Ongeldig request.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const { xml, recipientKvk, senderKvk } = body;

  if (!xml || !recipientKvk) {
    return new Response(JSON.stringify({ success: false, error: 'XML en ontvanger KvK-nummer zijn verplicht.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  // Determine provider
  const providerName = (context.env?.PEPPOL_PROVIDER || 'storecove').toLowerCase();
  const provider = PROVIDERS[providerName];
  const senderEntityId = context.env?.PEPPOL_SENDER_ID || '';
  const customUrl = context.env?.PEPPOL_API_URL || '';

  if (!provider && providerName !== 'custom') {
    return new Response(JSON.stringify({
      success: false,
      error: `Onbekende Peppol provider: ${providerName}. Gebruik "storecove", "econnect", of "custom".`,
    }), { status: 400, headers: corsHeaders });
  }

  try {
    let reqConfig;

    if (providerName === 'custom') {
      if (!customUrl) {
        return new Response(JSON.stringify({
          success: false,
          error: 'PEPPOL_API_URL is vereist voor custom provider.',
        }), { status: 400, headers: corsHeaders });
      }
      reqConfig = {
        url: customUrl,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/xml',
        },
        body: xml,
      };
    } else {
      reqConfig = provider.buildRequest(xml, recipientKvk, senderEntityId, apiKey, customUrl);
    }

    const apRes = await fetch(reqConfig.url, {
      method: reqConfig.method,
      headers: reqConfig.headers,
      body: reqConfig.body,
      signal: AbortSignal.timeout(20000),
    });

    if (!apRes.ok) {
      const errText = await apRes.text();
      return new Response(JSON.stringify({
        success: false,
        error: `Access Point fout (HTTP ${apRes.status}).`,
        detail: errText.substring(0, 500),
      }), { status: 200, headers: corsHeaders });
    }

    const data = await apRes.json().catch(() => ({}));
    const result = provider
      ? provider.parseResponse(data)
      : { success: true, messageId: data.id || 'submitted' };

    return new Response(JSON.stringify({
      ...result,
      provider: providerName,
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Kon niet verbinden met Peppol Access Point.',
      detail: err.message,
    }), { status: 502, headers: corsHeaders });
  }
}

