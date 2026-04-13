/**
 * Storage abstraction layer for BouwFactuur.
 *
 * Currently uses localStorage. To upgrade to Supabase or Cloudflare D1,
 * replace the implementations below — the rest of the app won't change.
 *
 * Every method is async to match the Supabase/D1 signatures you'll
 * eventually migrate to.
 */

const PREFIX = 'bouwfactuur:';

export const KEYS = {
  profile:  `${PREFIX}profile`,
  clients:  `${PREFIX}clients`,
  invoices: `${PREFIX}invoices`,
  nextNum:  `${PREFIX}nextnum`,
};

/**
 * Read a value from storage.
 * @param {string} key
 * @param {*} fallback — returned if key doesn't exist or parse fails
 * @returns {Promise<*>}
 */
export async function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Write a value to storage.
 * @param {string} key
 * @param {*} value — will be JSON-serialised
 * @returns {Promise<void>}
 */
export async function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[BouwFactuur] Storage write failed for ${key}:`, err);
  }
}

/**
 * Remove a key from storage.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function storageDel(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`[BouwFactuur] Storage delete failed for ${key}:`, err);
  }
}

/**
 * Clear all BouwFactuur data. Useful for a "reset" button.
 * @returns {Promise<void>}
 */
export async function storageClearAll() {
  Object.values(KEYS).forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  });
}
