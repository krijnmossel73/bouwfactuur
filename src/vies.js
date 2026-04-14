/**
 * VIES VAT Number Validation for BouwFactuur.
 *
 * Uses the official European Commission VIES REST API (free, no key needed).
 * Calls go through /api/vies proxy to avoid CORS issues in the browser.
 *
 * In local dev (npm run dev), falls back to format-only validation
 * since the proxy function won't be available.
 */

// Dutch BTW number format: NL + 9 digits + B + 2 digits = NL123456789B01
const BTW_PATTERNS = {
  NL: /^NL\d{9}B\d{2}$/,
  DE: /^DE\d{9}$/,
  BE: /^BE0\d{9}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  AT: /^ATU\d{8}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  IT: /^IT\d{11}$/,
  PL: /^PL\d{10}$/,
  LU: /^LU\d{8}$/,
  IE: /^IE\d{7}[A-Z]{1,2}$/,
  PT: /^PT\d{9}$/,
};

/**
 * Parse a BTW/VAT string into country code + number.
 * Strips spaces, dots, dashes. Returns null if unparseable.
 */
export function parseBTW(raw) {
  if (!raw || raw.length < 4) return null;
  const cleaned = raw.replace(/[\s.\-]/g, '').toUpperCase();
  const country = cleaned.substring(0, 2);
  const number = cleaned.substring(2);
  if (!/^[A-Z]{2}$/.test(country) || !number) return null;
  return { country, number, full: cleaned };
}

/**
 * Validate format only (offline check).
 * Returns { valid, message }.
 */
export function validateFormat(btwString) {
  const parsed = parseBTW(btwString);
  if (!parsed) {
    return { valid: false, message: 'Ongeldig formaat. Gebruik landcode + nummer (bijv. NL123456789B01).' };
  }

  const pattern = BTW_PATTERNS[parsed.country];
  if (pattern && !pattern.test(parsed.full)) {
    return { valid: false, message: `Ongeldig ${parsed.country} BTW-nummer formaat.` };
  }

  // If no specific pattern, accept any alphanumeric after country code
  if (!pattern && parsed.number.length < 4) {
    return { valid: false, message: 'BTW-nummer te kort.' };
  }

  return { valid: true, message: 'Formaat correct.' };
}

/**
 * Validate against the VIES API via our proxy.
 * Returns { valid, name, address, error, requestDate }.
 */
export async function validateVIES(btwString) {
  const parsed = parseBTW(btwString);
  if (!parsed) {
    return { valid: false, error: 'Ongeldig formaat.' };
  }

  // Format check first
  const fmt = validateFormat(btwString);
  if (!fmt.valid) {
    return { valid: false, error: fmt.message };
  }

  try {
    // Call our proxy (Cloudflare Pages Function)
    const res = await fetch(`/api/vies?country=${parsed.country}&number=${parsed.number}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // If proxy isn't available (local dev), fall back to format-only
      if (res.status === 404) {
        return {
          valid: true,
          name: null,
          address: null,
          error: null,
          formatOnly: true,
          message: 'Formaat correct (VIES niet beschikbaar in dev-modus).',
        };
      }
      return { valid: false, error: `VIES fout (HTTP ${res.status}).` };
    }

    const data = await res.json();

    if (data.error) {
      return { valid: false, error: data.error };
    }

    return {
      valid: data.valid,
      name: data.name || null,
      address: data.address || null,
      requestDate: data.requestDate || null,
      error: data.valid ? null : 'BTW-nummer niet geldig in VIES.',
    };
  } catch (err) {
    // Network error or timeout — fall back to format-only
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { valid: null, error: 'VIES timeout — probeer later opnieuw.' };
    }

    // If fetch fails entirely (e.g. dev mode, no proxy), format-only
    return {
      valid: true,
      formatOnly: true,
      message: 'Formaat correct (VIES niet bereikbaar).',
    };
  }
}
