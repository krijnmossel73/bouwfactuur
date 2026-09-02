/**
 * Cloudflare Pages Function: /api/vies
 *
 * Proxies requests to the official EC VIES REST API to avoid browser CORS issues.
 * The VIES API is free, public, and requires no authentication.
 *
 * Usage: GET /api/vies?country=NL&number=123456789B01
 *
 * Returns JSON:
 *   { valid: true/false, name: "...", address: "...", requestDate: "...", error: null }
 */

import { requireUser } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const auth = requireUser(context);
  if (auth.err) return auth.err;

  const url = new URL(context.request.url);
  const country = url.searchParams.get('country');
  const number = url.searchParams.get('number');

  // Same-origin only: the frontend is served from the same Pages project.
  const corsHeaders = { 'Content-Type': 'application/json' };

  if (!country || !number) {
    return new Response(JSON.stringify({ error: 'Missing country or number parameter.' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Validate country code format
  if (!/^[A-Z]{2}$/.test(country.toUpperCase())) {
    return new Response(JSON.stringify({ error: 'Invalid country code.' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Sanitize number — alphanumeric only
  const cleanNumber = number.replace(/[^A-Za-z0-9]/g, '');
  if (cleanNumber.length < 2 || cleanNumber.length > 15) {
    return new Response(JSON.stringify({ error: 'Invalid VAT number length.' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const viesUrl = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country.toUpperCase()}/vat/${cleanNumber}`;

  try {
    const viesRes = await fetch(viesUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!viesRes.ok) {
      const text = await viesRes.text();
      return new Response(JSON.stringify({
        error: `VIES returned HTTP ${viesRes.status}.`,
        detail: text.substring(0, 200),
      }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data = await viesRes.json();

    // The VIES REST API returns various fields. Map to our format.
    const result = {
      valid: data.isValid === true || data.valid === true || data.userError === 'VALID',
      name: data.name || data.traderName || null,
      address: data.address || data.traderAddress || null,
      requestDate: data.requestDate || null,
      countryCode: data.countryCode || country.toUpperCase(),
      vatNumber: data.vatNumber || cleanNumber,
      error: null,
    };

    // Clean up "---" placeholders from VIES
    if (result.name === '---') result.name = null;
    if (result.address === '---') result.address = null;

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'VIES service unavailable. Probeer later opnieuw.',
      detail: err.message,
    }), {
      status: 502,
      headers: corsHeaders,
    });
  }
}

