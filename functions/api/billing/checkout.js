/**
 * POST /api/billing/checkout — start a Stripe Checkout subscription.
 *
 * Creates (or reuses) the Stripe customer for the user and returns the
 * hosted Checkout URL. Payment methods (iDEAL, card, …) follow the
 * Stripe dashboard configuration.
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
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return json({ error: 'billing_unavailable' }, 503);

  try {
    const account = await getOrCreateAccount(env.DB, user);

    // Reuse the Stripe customer when known; create otherwise.
    let customerId = account.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', '/v1/customers', {
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await env.DB
        .prepare(`UPDATE accounts SET stripe_customer_id = ?, updated_at = datetime('now') WHERE user_id = ?`)
        .bind(customerId, user.id)
        .run();
    }

    const origin = new URL(request.url).origin;
    const session = await stripeRequest(env.STRIPE_SECRET_KEY, 'POST', '/v1/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      subscription_data: { metadata: { user_id: user.id } },
      locale: 'nl',
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: 'checkout_error', detail: String(err.message || err) }, 500);
  }
}
