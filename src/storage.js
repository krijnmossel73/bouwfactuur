/**
 * Storage abstraction layer for BouwFactuur.
 *
 * Currently uses localStorage with per-user key scoping.
 * When Cloudflare Access is enabled, each user's data is isolated
 * by prefixing storage keys with their user ID.
 *
 * To upgrade to Supabase or Cloudflare D1, replace the implementations
 * below — the rest of the app won't change.
 *
 * Every method is async to match the Supabase/D1 signatures you'll
 * eventually migrate to.
 */

let userScope = '';

/**
 * Set the current user scope for storage isolation.
 * Call this after authentication to prefix all keys with the user ID.
 * @param {string} userId — user email or ID (empty string for anonymous)
 */
export function setStorageUser(userId) {
  // Simple hash to avoid storing email directly in key names
  userScope = userId ? simpleHash(userId) : '';
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

function prefix() {
  return userScope ? `bf:${userScope}:` : 'bouwfactuur:';
}

/**
 * Get storage keys (dynamically scoped per user).
 */
export function getKeys() {
  const p = prefix();
  return {
    profile:  `${p}profile`,
    clients:  `${p}clients`,
    invoices: `${p}invoices`,
    nextNum:  `${p}nextnum`,
  };
}

// Legacy export for backwards compatibility
export const KEYS = {
  get profile()  { return getKeys().profile; },
  get clients()  { return getKeys().clients; },
  get invoices() { return getKeys().invoices; },
  get nextNum()  { return getKeys().nextNum; },
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
 * Clear all BouwFactuur data for the current user.
 * @returns {Promise<void>}
 */
export async function storageClearAll() {
  const keys = getKeys();
  Object.values(keys).forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* noop */ }
  });
}
