/**
 * Storage layer for BouwFactuur — cloud-only (Cloudflare D1 via /api/storage).
 *
 * Requires an authenticated Supabase session; every request carries the
 * session JWT as a Bearer token. There is NO localStorage backend: data
 * lives exclusively in D1, tied to the user's account.
 *
 * The only remaining localStorage interaction is a one-time, read-only
 * MIGRATION on first login: data created by earlier versions of the app
 * (which stored everything in this browser) is pushed up to D1 once and
 * then removed from localStorage.
 *
 * All functions throw on failure so the UI can inform the user — with no
 * local fallback, a silent write failure would mean data loss.
 */

let tokenProvider = null; // async () => access token string | null

/** Logical storage keys — must match the server-side allowlist. */
export const KEYS = {
  profile: 'profile',
  clients: 'clients',
  invoices: 'invoices',
  nextNum: 'nextnum',
};

/**
 * Register a function that returns the current Supabase access token.
 * Called before every request so refreshed tokens are picked up.
 */
export function setAuthTokenProvider(fn) {
  tokenProvider = fn;
}

export async function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (tokenProvider) {
    const token = await tokenProvider();
    if (token) h['Authorization'] = `Bearer ${token}`;
  }
  return h;
}

// ── Remote (D1) primitives ──

async function remoteGetAll() {
  const res = await fetch('/api/storage', { headers: await authHeaders() });
  if (!res.ok) throw new Error(`storage read failed (${res.status})`);
  const body = await res.json();
  return body.data || {};
}

async function remoteSet(key, value) {
  const res = await fetch(`/api/storage/${key}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const err = new Error(`storage write failed (${res.status})`);
    err.status = res.status; // 402 = subscription_required (freemium gate)
    throw err;
  }
}

async function remoteDel(key) {
  const res = await fetch(`/api/storage/${key}`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error(`storage delete failed (${res.status})`);
}

// ── Legacy localStorage migration (read-once, then clean up) ──

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function legacyRead(prefix) {
  const get = (k, fb) => {
    try {
      const raw = localStorage.getItem(prefix + k);
      return raw === null ? fb : JSON.parse(raw);
    } catch { return fb; }
  };
  return {
    prefix,
    profile: get(KEYS.profile, null),
    clients: get(KEYS.clients, []),
    invoices: get(KEYS.invoices, []),
    nextnum: get(KEYS.nextNum, null),
  };
}

function legacyHasData(d) {
  return d.profile != null || d.clients.length > 0 || d.invoices.length > 0 || d.nextnum != null;
}

function legacyCleanup(prefix) {
  try {
    for (const k of Object.values(KEYS)) localStorage.removeItem(prefix + k);
  } catch { /* noop */ }
}

/**
 * Find legacy local data: the user-scoped prefix from the previous
 * version first, then the anonymous prefix from before login existed.
 */
function findLegacyData(userId) {
  const candidates = [`bf:${simpleHash(userId)}:`, 'bouwfactuur:'];
  for (const prefix of candidates) {
    const d = legacyRead(prefix);
    if (legacyHasData(d)) return d;
  }
  return null;
}

// ── Public API ──

/**
 * Load all app data for the authenticated user. Performs the one-time
 * legacy migration when D1 is still empty for this user.
 *
 * @param {string} userId — Supabase user UUID (for locating legacy data)
 * @returns {Promise<{profile, clients, invoices, nextNum, migrated}>}
 * @throws when cloud storage is unreachable
 */
export async function loadAll(userId) {
  const remote = await remoteGetAll();

  const remoteEmpty =
    remote.profile == null &&
    !(Array.isArray(remote.clients) && remote.clients.length) &&
    !(Array.isArray(remote.invoices) && remote.invoices.length) &&
    remote.nextnum == null;

  if (remoteEmpty) {
    const legacy = userId ? findLegacyData(userId) : null;
    if (legacy) {
      // Push legacy data to D1; only clean local copies up after success.
      const writes = [];
      if (legacy.profile != null) writes.push(remoteSet(KEYS.profile, legacy.profile));
      if (legacy.clients.length) writes.push(remoteSet(KEYS.clients, legacy.clients));
      if (legacy.invoices.length) writes.push(remoteSet(KEYS.invoices, legacy.invoices));
      writes.push(remoteSet(KEYS.nextNum, legacy.nextnum ?? 1));
      await Promise.all(writes);
      legacyCleanup(legacy.prefix);
      return {
        profile: legacy.profile,
        clients: legacy.clients,
        invoices: legacy.invoices,
        nextNum: legacy.nextnum ?? 1,
        migrated: true,
      };
    }
    return { profile: null, clients: [], invoices: [], nextNum: 1, migrated: false };
  }

  return {
    profile: remote.profile ?? null,
    clients: Array.isArray(remote.clients) ? remote.clients : [],
    invoices: Array.isArray(remote.invoices) ? remote.invoices : [],
    nextNum: remote.nextnum ?? 1,
    migrated: false,
  };
}

/**
 * Write a value to cloud storage.
 * @throws when the write fails — callers must handle this visibly.
 */
export async function storageSet(key, value) {
  await remoteSet(key, value);
}

/** Remove a key from cloud storage. @throws on failure */
export async function storageDel(key) {
  await remoteDel(key);
}

/** Remove all of the user's data from cloud storage. @throws on failure */
export async function storageClearAll() {
  await Promise.all(Object.values(KEYS).map((k) => remoteDel(k)));
}
