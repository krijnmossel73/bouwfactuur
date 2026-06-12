/**
 * GET /api/account — the authenticated user's plan & usage, for the UI.
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
