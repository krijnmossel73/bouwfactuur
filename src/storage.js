/**
 * Storage layer for BouwFactuur.
 *
 * Two backends:
 *  - REMOTE (Cloudflare D1 via /api/storage) — used when the user is
 *    authenticated through Cloudflare Access AND the D1 binding exists.
 *    Data follows the user across browsers and devices.
 *  - LOCAL (localStorage, per-user key scoping) — used in local dev,
 *    when not authenticated, or when the D1 binding is absent. Identical
 *    to the pre-D1 behaviour, so the app degrades gracefully.
 *
 * In remote mode every write is ALSO mirrored to localStorage as an
 * offline backup; on load, remote data wins whenever it exists.
 *
 * Migration: on the first authenticated load against an empty D1 store,
 * any existing localStorage data is pushed up automatically (one-time).
 */

let userScope = '';
let mode = 'local'; // 'local' | 'remote'

/** Logical storage keys — must match the server-side allowlist. */
export const KEYS = {
  profile: 'profile',
  clients: 'clients',
  invoices: 'invoices',
  nextNum: 'nextnum',
};

export function getStorageMode() {
  return mode;
}

/**
 * Set the current user scope for localStorage key isolation.
 * @param {string} userId — user email or ID (empty string for anonymous)
 */
export function setStorageUser(userId) {
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

function lsKey(key) {
  // Produces the same physical keys as the pre-D1 version
  // (e.g. "bf:<hash>:profile"), so existing data keeps working.
  return prefix() + key;
}

// ── localStorage primitives ──

function localGet(physicalKey, fallback) {
  try {
    const raw = localStorage.getItem(physicalKey);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function localSet(physicalKey, value) {
  try {
    localStorage.setItem(physicalKey, JSON.stringify(value));
  } catch (err) {
    console.error(`[BouwFactuur] Local storage write failed for ${physicalKey}:`, err);
  }
}

function localDel(physicalKey) {
  try {
    localStorage.removeItem(physicalKey);
  } catch { /* noop */ }
}

// ── Remote (D1) primitives ──

async function remoteGetAll() {
  const res = await fetch('/api/storage');
  if (!res.ok) {
    const err = new Error(`remote storage unavailable (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return body.data || {};
}

async function remoteSet(key, value) {
  const res = await fetch(`/api/storage/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`remote write failed (${res.status})`);
}

async function remoteDel(key) {
  const res = await fetch(`/api/storage/${key}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`remote delete failed (${res.status})`);
}

// ── Unified API ──

/**
 * Load all app data, deciding the backend and migrating if needed.
 * Call once on app start, AFTER setStorageUser().
 *
 * @param {boolean} authenticated — whether a Cloudflare Access user is present
 * @returns {Promise<{profile, clients, invoices, nextNum, mode, migrated}>}
 */
export async function loadAll(authenticated) {
  const local = {
    profile: localGet(lsKey(KEYS.profile), null),
    clients: localGet(lsKey(KEYS.clients), []),
    invoices: localGet(lsKey(KEYS.invoices), []),
    nextnum: localGet(lsKey(KEYS.nextNum), null),
  };

  if (!authenticated) {
    mode = 'local';
    return shape(local, 'local', false);
  }

  let remote;
  try {
    remote = await remoteGetAll();
  } catch {
    // 503 (no D1 binding), 401, network error → behave exactly as before D1
    mode = 'local';
    return shape(local, 'local', false);
  }

  mode = 'remote';

  const remoteEmpty =
    remote.profile == null &&
    !(Array.isArray(remote.clients) && remote.clients.length) &&
    !(Array.isArray(remote.invoices) && remote.invoices.length) &&
    remote.nextnum == null;

  const localHasData =
    local.profile != null ||
    (local.clients && local.clients.length > 0) ||
    (local.invoices && local.invoices.length > 0) ||
    local.nextnum != null;

  // One-time migration: empty cloud + existing local data → push local up
  if (remoteEmpty && localHasData) {
    let migrated = false;
    try {
      const writes = [];
      if (local.profile != null) writes.push(remoteSet(KEYS.profile, local.profile));
      if (local.clients?.length) writes.push(remoteSet(KEYS.clients, local.clients));
      if (local.invoices?.length) writes.push(remoteSet(KEYS.invoices, local.invoices));
      writes.push(remoteSet(KEYS.nextNum, local.nextnum ?? 1));
      await Promise.all(writes);
      migrated = true;
    } catch (err) {
      console.error('[BouwFactuur] Migration to cloud storage incomplete:', err);
      // Stay in remote mode — subsequent saves will sync.
    }
    return shape(local, 'remote', migrated);
  }

  if (remoteEmpty) {
    return shape({ profile: null, clients: [], invoices: [], nextnum: null }, 'remote', false);
  }

  return shape(
    {
      profile: remote.profile ?? null,
      clients: Array.isArray(remote.clients) ? remote.clients : [],
      invoices: Array.isArray(remote.invoices) ? remote.invoices : [],
      nextnum: remote.nextnum,
    },
    'remote',
    false
  );
}

function shape(d, m, migrated) {
  return {
    profile: d.profile ?? null,
    clients: d.clients ?? [],
    invoices: d.invoices ?? [],
    nextNum: d.nextnum ?? 1,
    mode: m,
    migrated,
  };
}

/**
 * Read a value. In remote mode, fetches from D1 (localStorage fallback on error).
 * @param {string} key — one of KEYS
 * @param {*} fallback
 */
export async function storageGet(key, fallback) {
  if (mode === 'remote') {
    try {
      const res = await fetch(`/api/storage/${key}`);
      if (res.ok) {
        const body = await res.json();
        return body.value == null ? fallback : body.value;
      }
    } catch { /* fall through to local */ }
  }
  return localGet(lsKey(key), fallback);
}

/**
 * Write a value. Always mirrors to localStorage; in remote mode also writes D1.
 * @param {string} key — one of KEYS
 * @param {*} value
 */
export async function storageSet(key, value) {
  localSet(lsKey(key), value);
  if (mode === 'remote') {
    try {
      await remoteSet(key, value);
    } catch (err) {
      console.error(`[BouwFactuur] Cloud write failed for ${key} (saved locally):`, err);
    }
  }
}

/** Remove a key from storage. */
export async function storageDel(key) {
  localDel(lsKey(key));
  if (mode === 'remote') {
    try { await remoteDel(key); } catch (err) {
      console.error(`[BouwFactuur] Cloud delete failed for ${key}:`, err);
    }
  }
}

/** Clear all BouwFactuur data for the current user (both backends). */
export async function storageClearAll() {
  for (const key of Object.values(KEYS)) {
    localDel(lsKey(key));
    if (mode === 'remote') {
      try { await remoteDel(key); } catch { /* noop */ }
    }
  }
}
