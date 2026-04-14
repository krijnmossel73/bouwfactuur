/**
 * Cloudflare Pages Function: /api/peppol/lookup
 *
 * Looks up a company in the Peppol Directory by KvK number.
 * The Peppol Directory API is free and public (directory.peppol.eu).
 *
 * For NL companies, the Peppol participant ID scheme is:
 *   0106 = KvK number
 *   0190 = OIN (Organisatie Identificatie Nummer, for government)
 *
 * Usage: GET /api/peppol/lookup?kvk=12345678
 */

const PEPPOL_DIRECTORY = 'https://directory.peppol.eu';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const kvk = url.searchParams.get('kvk');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (!kvk || !/^\d{8}$/.test(kvk)) {
    return new Response(JSON.stringify({ error: 'KvK-nummer moet 8 cijfers zijn.' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Peppol participant ID for NL KvK: scheme 0106
  const participantId = `iso6523-actorid-upis::0106:${kvk}`;

  try {
    const dirRes = await fetch(
      `${PEPPOL_DIRECTORY}/search/1.0/json?participant=${encodeURIComponent(participantId)}`,
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!dirRes.ok) {
      // 404 means not found in directory — valid response
      if (dirRes.status === 404) {
        return new Response(JSON.stringify({
          found: false,
          kvk,
          participantId: `0106:${kvk}`,
          error: null,
        }), { status: 200, headers: corsHeaders });
      }

      return new Response(JSON.stringify({
        found: false,
        error: `Peppol Directory returned HTTP ${dirRes.status}.`,
      }), { status: 502, headers: corsHeaders });
    }

    const data = await dirRes.json();
    const totalResults = data['total-result-count'] || 0;

    if (totalResults === 0) {
      return new Response(JSON.stringify({
        found: false,
        kvk,
        participantId: `0106:${kvk}`,
        error: null,
      }), { status: 200, headers: corsHeaders });
    }

    // Extract participant info
    const match = data.match?.[0] || {};
    const entities = match.entity || [];
    const name = entities[0]?.name?.[0]?.name || null;
    const country = entities[0]?.countryCode || 'NL';

    // Extract supported document types
    const docTypes = (match.docTypeID || []).map(dt => dt.value || dt).filter(Boolean);
    const supportsInvoice = docTypes.some(dt =>
      dt.includes('Invoice') || dt.includes('invoice')
    );

    return new Response(JSON.stringify({
      found: true,
      kvk,
      participantId: `0106:${kvk}`,
      name,
      country,
      supportsInvoice,
      documentTypes: docTypes.length,
      error: null,
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      found: false,
      error: 'Peppol Directory niet bereikbaar.',
      detail: err.message,
    }), { status: 502, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
