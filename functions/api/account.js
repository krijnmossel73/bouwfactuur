/**
 * GET    /api/account — the authenticated user's plan & usage, for the UI.
 * DELETE /api/account — erase the account: D1 rows (kv, invoices, accounts),
 *                       the Stripe customer (cancels any subscription), and the
 *                       Supabase auth user (needs SUPABASE_SERVICE_ROLE_KEY).
 *
 * Returns:
 * {
 *   plan: 'free' | 'pro',
 *   subscriptionStatus, periodEnd,
 *   invoicesCreated, freeLimit,
 *   billingEnabled,             // Stripe configured server-side?
 *   price: { amount, currency, interval, formatted } | null
 * }
 */

import { FREE_INVOICE_LIMIT, isEntitled, getOrCreateAccount } from '../../lib/accounts.js';
import { stripeRequest } from '../../lib/stripe.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let priceCache = null; // { id, data } — per-isolate cache

async function getPrice(env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return null;
  if (priceCache?.id === env.STRIPE_PRICE_ID) return priceCache.data;
  try {
    const p = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/v1/prices/${env.STRIPE_PRICE_ID}`);
    const amount = (p.unit_amount ?? 0) / 100;
    const data = {
      amount: p.unit_amount,
      currency: p.currency,
      interval: p.recurring?.interval || 'month',
      formatted: new Intl.NumberFormat('nl-NL', { style: 'currency', currency: (p.currency || 'eur').toUpperCase() }).format(amount)
        + (p.recurring?.interval === 'year' ? ' per jaar' : ' per maand'),
    };
    priceCache = { id: env.STRIPE_PRICE_ID, data };
    return data;
  } catch {
    return null;
  }
}

export async function onRequestGet(context) {
  const user = context.data?.user;
  if (!user || !user.id) return json({ error: 'unauthorized' }, 401);
  if (!context.env.DB) return json({ error: 'storage_unavailable' }, 503);

  try {
    const account = await getOrCreateAccount(context.env.DB, user);
    const billingEnabled = Boolean(context.env.STRIPE_SECRET_KEY && context.env.STRIPE_PRICE_ID);
    return json({
      plan: isEntitled(account) ? 'pro' : 'free',
      subscriptionStatus: account.subscription_status || null,
      periodEnd: account.current_period_end || null,
      invoicesCreated: account.invoices_created || 0,
      freeLimit: FREE_INVOICE_LIMIT,
      billingEnabled,
      price: billingEnabled ? await getPrice(context.env) : null,
    });
  } catch (err) {
    return json({ error: 'account_error', detail: String(err) }, 500);
  }
}

export async function onRequestDelete(context) {
  const user = context.data?.user;
  if (!user || !user.id) return json({ error: 'unauthorized' }, 401);
  const env = context.env || {};
  if (!env.DB) return json({ error: 'storage_unavailable' }, 503);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    // Without the admin key we could delete the data but the login would remain; refuse so the user gets a clear message.
    return json({ error: 'account_deletion_not_configured' }, 503);
  }

  const result = { data: false, stripe: null, auth: false };
  try {
    // 1. Stripe: deleting the customer cancels active subscriptions immediately.
    if (env.STRIPE_SECRET_KEY) {
      const acct = await env.DB.prepare('SELECT stripe_customer_id FROM accounts WHERE user_id = ?').bind(user.id).first();
      if (acct?.stripe_customer_id) {
        try {
          await stripeRequest(env.STRIPE_SECRET_KEY, 'DELETE', `/v1/customers/${acct.stripe_customer_id}`);
          result.stripe = 'deleted';
        } catch (err) {
          // A missing customer (test-mode reset etc.) must not block deletion
          if (/No such customer/i.test(String(err?.message || err))) result.stripe = 'missing';
          else throw err;
        }
      } else {
        result.stripe = 'none';
      }
    }

    // 2. D1: everything keyed by user_id, in one transaction.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM invoices WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM kv WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM accounts WHERE user_id = ?').bind(user.id),
    ]);
    result.data = true;

    // 3. Supabase auth user via the Admin API (service role key, server-side only).
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      return json({ error: 'auth_delete_failed', detail: text.substring(0, 300), ...result }, 502);
    }
    result.auth = true;
    return json({ ok: true, ...result });
  } catch (err) {
    return json({ error: 'delete_failed', detail: String(err?.message || err), ...result }, 500);
  }
}
