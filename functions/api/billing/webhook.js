/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 *
 * Verifies the Stripe-Signature header (HMAC over the raw body) and
 * updates the accounts table. Subscribed events:
 *   - checkout.session.completed         → link customer, activate
 *   - customer.subscription.updated      → status / period changes
 *   - customer.subscription.deleted      → canceled
 *
 * No Bearer auth here: authenticity comes from the signature.
 */

import { stripeRequest, verifyStripeSignature } from '../../../lib/stripe.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tsToIso(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

async function applySubscription(db, { userId = null, customerId, status, periodEnd }) {
  if (userId) {
    await db
      .prepare(`UPDATE accounts SET stripe_customer_id = COALESCE(?, stripe_customer_id),
                subscription_status = ?, current_period_end = ?, updated_at = datetime('now')
                WHERE user_id = ?`)
      .bind(customerId || null, status, periodEnd, userId)
      .run();
  } else if (customerId) {
    await db
      .prepare(`UPDATE accounts SET subscription_status = ?, current_period_end = ?, updated_at = datetime('now')
                WHERE stripe_customer_id = ?`)
      .bind(status, periodEnd, customerId)
      .run();
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB || !env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'billing_unavailable' }, 503);
  }

  const rawBody = await request.text();
  const valid = await verifyStripeSignature(
    rawBody,
    request.headers.get('Stripe-Signature'),
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!valid) return json({ error: 'invalid_signature' }, 400);

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }

  try {
    const obj = event.data?.object || {};

    switch (event.type) {
      case 'checkout.session.completed': {
        // Activate immediately; the subscription fetch fills in exact state.
        let status = 'active';
        let periodEnd = null;
        if (obj.subscription) {
          try {
            const sub = await stripeRequest(env.STRIPE_SECRET_KEY, 'GET', `/v1/subscriptions/${obj.subscription}`);
            status = sub.status || 'active';
            periodEnd = tsToIso(sub.current_period_end);
          } catch { /* keep defaults */ }
        }
        await applySubscription(env.DB, {
          userId: obj.client_reference_id || null,
          customerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
          status,
          periodEnd,
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await applySubscription(env.DB, {
          userId: obj.metadata?.user_id || null,
          customerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
          status: event.type.endsWith('deleted') ? 'canceled' : (obj.status || 'canceled'),
          periodEnd: tsToIso(obj.current_period_end),
        });
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }

    return json({ received: true });
  } catch (err) {
    // 500 → Stripe retries with backoff, which is what we want on DB hiccups.
    return json({ error: 'webhook_error', detail: String(err.message || err) }, 500);
  }
}
