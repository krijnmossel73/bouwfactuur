/**
 * POST /api/billing/portal — open the Stripe customer portal, where the
 * user manages payment methods, sees invoices, and cancels.
 */

import { getOrCreateAccount } from '../../../lib/accounts.js';
import { stripeRequest } from '../../../lib/stripe.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  const user = context.data?.user;
  if (!user || !user.id) return json({ error: 'unauthorized' }, 401);
  const { env, request } = context;
  if (!env.DB) return json({ error: 'storage_unavailable' }, 503);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'billing_unavailable' }, 503);

  try {
    const account = await getOrCreateAccount(env.DB, user);
    if (!account.stripe_customer_id) return json({ error: 'no_customer' }, 400);

    const origin = new URL(request.url).origin;
    const session = await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', '/v1/billing_portal/sessions', {
      customer: account.stripe_customer_id,
      return_url: origin,
    });
    return json({ url: session.url });
  } catch (err) {
    return json({ error: 'portal_error', detail: String(err.message || err) }, 500);
  }
}
