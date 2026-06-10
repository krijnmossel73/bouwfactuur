/**
 * Cloudflare Pages Function: GET /api/storage
 *
 * Returns all stored values for the authenticated user in one call:
 *   { data: { profile, clients, invoices, nextnum } }  (missing keys → null)
 *
 * Responses:
 *   401 — not authenticated (no Cloudflare Access JWT)
 *   503 — D1 binding "DB" not configured (client falls back to localStorage)
 */

const VALID_KEYS = ['profile', 'clients', 'invoices', 'nextnum'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const user = context.data?.user;
  if (!user || !user.id) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'storage_unavailable' }, 503);

  try {
    const { results } = await context.env.DB
      .prepare('SELECT key, value FROM kv WHERE user_id = ?')
      .bind(user.id)
      .all();

    const data = {};
    for (const k of VALID_KEYS) data[k] = null;
    for (const row of results || []) {
      if (!VALID_KEYS.includes(row.key)) continue;
      try { data[row.key] = JSON.parse(row.value); } catch { data[row.key] = null; }
    }
    return json({ data });
  } catch (err) {
    return json({ error: 'storage_error', detail: String(err) }, 500);
  }
}
