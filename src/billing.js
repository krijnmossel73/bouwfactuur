/**
 * Billing API client — account/plan info, Stripe Checkout, customer portal.
 */

import { authHeaders } from './storage.js';

/** Fetch the user's plan & usage. Returns null when unavailable. */
export async function getAccount() {
  try {
    const res = await fetch('/api/account', { headers: await authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Start Stripe Checkout: redirects the browser on success. @throws on failure */
export async function startCheckout() {
  const res = await fetch('/api/billing/checkout', { method: 'POST', headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'checkout failed');
  window.location.href = body.url;
}

/** Open the Stripe customer portal (manage/cancel). @throws on failure */
export async function openPortal() {
  const res = await fetch('/api/billing/portal', { method: 'POST', headers: await authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'portal failed');
  window.location.href = body.url;
}
