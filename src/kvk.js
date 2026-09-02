/**
 * KvK (Kamer van Koophandel) API integration.
 *
 * Uses the KvK Zoeken API to look up companies by KvK number or name.
 * Calls go through /api/kvk proxy (Cloudflare Pages Function).
 *
 * The test environment is free and requires no subscription.
 * Production requires a KvK API subscription + API key (set as env var).
 */

/**
 * Validate KvK number format (8 digits).
 */
import { authHeaders } from './storage.js';

export function validateKvkFormat(kvkNumber) {
  if (!kvkNumber) return { valid: false, message: 'Voer een KvK-nummer in.' };
  const cleaned = kvkNumber.replace(/[\s.\-]/g, '');
  if (!/^\d{8}$/.test(cleaned)) {
    return { valid: false, message: 'KvK-nummer moet 8 cijfers zijn.' };
  }
  return { valid: true, cleaned };
}

/**
 * Search KvK by number or name via our proxy.
 * Returns { results: [...], error: null } or { results: [], error: "..." }
 */
export async function searchKvK({ kvkNummer, naam }) {
  const params = new URLSearchParams();
  if (kvkNummer) params.set('kvkNummer', kvkNummer.replace(/[\s.\-]/g, ''));
  if (naam) params.set('naam', naam);

  if (!kvkNummer && !naam) {
    return { results: [], error: 'Geef een KvK-nummer of bedrijfsnaam op.' };
  }

  try {
    const res = await fetch(`/api/kvk?${params.toString()}`, {
      headers: await authHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    // Detect Vite SPA fallback (returns HTML instead of JSON)
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { results: [], error: null, devMode: true, message: 'KvK API niet beschikbaar. Start met `npm run dev` (wrangler).' };
    }

    if (res.status === 404) {
      return { results: [], error: null, devMode: true, message: 'KvK API niet beschikbaar in dev-modus.' };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { results: [], error: body.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { results: data.results || [], error: data.error || null };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { results: [], error: 'KvK API timeout — probeer later opnieuw.' };
    }
    return { results: [], error: 'KvK API niet bereikbaar.' };
  }
}

/**
 * Extract structured company data from a KvK search result.
 */
export function extractCompanyData(result) {
  const data = {
    naam: result.naam || '',
    kvk: result.kvkNummer || '',
    adres: '',
    postcode: '',
    plaats: '',
  };

  // Extract address from the result
  const addr = result.adres?.binnenlandsAdres || result.adres?.buitenlandsAdres;
  if (addr) {
    const street = [addr.straatnaam, addr.huisnummer, addr.huisletter, addr.huisnummertoevoeging]
      .filter(Boolean)
      .join(' ');
    data.adres = street || '';
    data.postcode = addr.postcode || '';
    data.plaats = addr.plaats || '';
  }

  return data;
}
