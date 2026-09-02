/**
 * Cloudflare Pages Function: /api/kvk
 *
 * Proxies requests to the KvK Zoeken API.
 * 
 * Uses KVK_API_KEY environment variable for production.
 * Falls back to the free KvK test environment if no key is set.
 *
 * Usage: GET /api/kvk?kvkNummer=12345678
 *    or: GET /api/kvk?naam=Bouwbedrijf
 */

const TEST_API_KEY = 'l7xx1f2691f2520d487b902f4e0b57a0b197';
const TEST_URL = 'https://api.kvk.nl/test/api/v2/zoeken';
const PROD_URL = 'https://api.kvk.nl/api/v2/zoeken';

import { requireUser } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const auth = requireUser(context);
  if (auth.err) return auth.err;

  const url = new URL(context.request.url);
  const kvkNummer = url.searchParams.get('kvkNummer');
  const naam = url.searchParams.get('naam');

  const corsHeaders = { 'Content-Type': 'application/json' };

  if (!kvkNummer && !naam) {
    return new Response(JSON.stringify({ error: 'Missing kvkNummer or naam parameter.' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Use production key if available, otherwise test environment
  const apiKey = context.env?.KVK_API_KEY || TEST_API_KEY;
  const baseUrl = context.env?.KVK_API_KEY ? PROD_URL : TEST_URL;
  const isTest = !context.env?.KVK_API_KEY;

  // Build KvK API query
  const kvkParams = new URLSearchParams();
  if (kvkNummer) {
    // Sanitize: digits only
    const cleaned = kvkNummer.replace(/[^\d]/g, '');
    if (cleaned.length !== 8) {
      return new Response(JSON.stringify({ error: 'KvK-nummer moet 8 cijfers zijn.' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    kvkParams.set('kvkNummer', cleaned);
  }
  if (naam) {
    kvkParams.set('naam', naam.substring(0, 100));
  }
  kvkParams.set('resultatenPerPagina', '5');

  const kvkUrl = `${baseUrl}?${kvkParams.toString()}`;

  try {
    const kvkRes = await fetch(kvkUrl, {
      headers: {
        'apikey': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!kvkRes.ok) {
      const text = await kvkRes.text();
      return new Response(JSON.stringify({
        error: `KvK API returned HTTP ${kvkRes.status}.`,
        detail: text.substring(0, 300),
        isTest,
      }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data = await kvkRes.json();

    // Map KvK results to a simpler format
    const results = (data.resultaten || []).map(r => ({
      kvkNummer: r.kvkNummer || '',
      vestigingsnummer: r.vestigingsnummer || '',
      naam: r.naam || r.handelsnaam || '',
      type: r.type || '',
      adres: r.adres || null,
    }));

    return new Response(JSON.stringify({
      results,
      total: data.totaal || 0,
      isTest,
      error: null,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'KvK service niet bereikbaar.',
      detail: err.message,
      isTest,
    }), {
      status: 502,
      headers: corsHeaders,
    });
  }
}

