/**
 * Cloudflare Pages Function: /api/storage/[key]
 *
 * GET    → { value } (null if not set)
 * PUT    → body { value: <any JSON> } — upserts the key for the user
 * DELETE → removes the key for the user
 *
 * Keys are restricted to: profile | clients | invoices | nextnum.
 * Requires Supabase authentication (middleware verifies the JWT and sets context.data.user).
 */

import { FREE_INVOICE_LIMIT, isEntitled, getOrCreateAccount, countNewInvoices } from '../../../lib/accounts.js';

const VALID_KEYS = ['profile', 'clients', 'invoices', 'nextnum'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Soft cap to keep rows well under D1 limits (~1.9 MB serialized value)
const MAX_VALUE_BYTES = 1.9 * 1024 * 1024;

function guard(context) {
  const user = context.data?.user;
  if (!user || !user.id) return { err: json({ error: 'unauthorized' }, 401) };
  if (!context.env.DB) return { err: json({ error: 'storage_unavailable' }, 503) };
  const key = context.params.key;
  if (!VALID_KEYS.includes(key)) return { err: json({ error: 'invalid_key' }, 400) };
  return { user, key, db: context.env.DB };
}

export async function onRequestGet(context) {
  const g = guard(context);
  if (g.err) return g.err;
  try {
    const row = await g.db
      .prepare('SELECT value FROM kv WHERE user_id = ? AND key = ?')
      .bind(g.user.id, g.key)
      .first();
    if (!row) return json({ value: null });
    try { return json({ value: JSON.parse(row.value) }); }
    catch { return json({ value: null }); }
  } catch (err) {
    return json({ error: 'storage_error', detail: String(err) }, 500);
  }
}

export async function onRequestPut(context) {
  const g = guard(context);
  if (g.err) return g.err;
  try {
    let body;
    try { body = await context.request.json(); }
    catch { return json({ error: 'invalid_json' }, 400); }
    if (body === null || typeof body !== 'object' || !('value' in body)) {
      return json({ error: 'missing_value' }, 400);
    }

    const serialized = JSON.stringify(body.value);
    if (serialized === undefined) return json({ error: 'unserializable_value' }, 400);
    if (serialized.length > MAX_VALUE_BYTES) return json({ error: 'value_too_large' }, 413);

    // ── Freemium gate: new invoices count against the lifetime limit ──
    // Only enforced once billing is live (Stripe configured); the counter
    // is tracked regardless so history is accurate when billing launches.
    if (g.key === 'invoices') {
      const prevRow = await g.db
        .prepare('SELECT value FROM kv WHERE user_id = ? AND key = ?')
        .bind(g.user.id, 'invoices')
        .first();
      let previous = [];
      try { previous = prevRow ? JSON.parse(prevRow.value) : []; } catch { previous = []; }

      const newCount = countNewInvoices(body.value, previous);
      if (newCount > 0) {
        const account = await getOrCreateAccount(g.db, g.user);
        const billingLive = Boolean(context.env.STRIPE_SECRET_KEY);
        if (
          billingLive &&
          !isEntitled(account) &&
          (account.invoices_created || 0) + newCount > FREE_INVOICE_LIMIT
        ) {
          return json({
            error: 'subscription_required',
            invoicesCreated: account.invoices_created || 0,
            freeLimit: FREE_INVOICE_LIMIT,
          }, 402);
        }
        await g.db
          .prepare(`UPDATE accounts SET invoices_created = invoices_created + ?, updated_at = datetime('now') WHERE user_id = ?`)
          .bind(newCount, g.user.id)
          .run();
      }
    }

    await g.db
      .prepare(`INSERT INTO kv (user_id, key, value, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT (user_id, key)
                DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .bind(g.user.id, g.key, serialized)
      .run();

    return json({ ok: true });
  } catch (err) {
    return json({ error: 'storage_error', detail: String(err) }, 500);
  }
}

export async function onRequestDelete(context) {
  const g = guard(context);
  if (g.err) return g.err;
  try {
    await g.db
      .prepare('DELETE FROM kv WHERE user_id = ? AND key = ?')
      .bind(g.user.id, g.key)
      .run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'storage_error', detail: String(err) }, 500);
  }
}
