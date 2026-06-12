/**
 * Minimal Stripe API client for Cloudflare Workers/Pages Functions.
 *
 * Uses raw fetch with form encoding instead of the stripe SDK to keep
 * the Functions bundle small. Pinned API version for stable shapes
 * (current_period_end on the subscription root).
 */

const STRIPE_API = 'https://api.stripe.com';
const STRIPE_VERSION = '2024-06-20';

/** Flatten nested params into Stripe's form encoding (a[b][0][c]=x). */
function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) formEncode(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === 'object') formEncode(item, `${key}[${i}]`, out);
      else out.push(`${key}[${i}]=${encodeURIComponent(item)}`);
    });
    else out.push(`${key}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

/** Call the Stripe API. @throws on non-2xx with Stripe's error message */
export async function stripeRequest(secretKey, method, path, params = null) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params ? formEncode(params) : undefined,
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Stripe API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * Verify a Stripe webhook signature (Stripe-Signature header).
 * Scheme: HMAC-SHA256 over `${timestamp}.${rawBody}` with the endpoint
 * secret; header carries `t=<ts>,v1=<hex>[,v1=...]`.
 *
 * @returns {Promise<boolean>}
 */
export async function verifyStripeSignature(rawBody, sigHeader, endpointSecret, toleranceSec = 300) {
  if (!sigHeader || !endpointSecret) return false;

  const parts = {};
  for (const kv of sigHeader.split(',')) {
    const [k, v] = kv.split('=', 2);
    if (k === 'v1') (parts.v1 ??= []).push(v);
    else parts[k.trim()] = v;
  }
  const ts = parseInt(parts.t, 10);
  if (!ts || !parts.v1?.length) return false;
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(endpointSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time-ish comparison against each provided v1 signature
  return parts.v1.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}
