/**
 * Cloudflare Pages Functions Middleware
 *
 * Runs before all /functions/** handlers. Verifies the Supabase Auth
 * JWT from the Authorization header and exposes the user to handlers
 * via context.data.user = { id, email } (or null when unauthenticated).
 *
 * Unlike the previous Cloudflare Access version (which only decoded a
 * header that Access had already validated), this middleware performs
 * full cryptographic verification — required because the browser sends
 * the token directly.
 *
 * Configuration (Pages env vars, see wrangler.toml):
 *   SUPABASE_URL        — https://<project-ref>.supabase.co
 *                         Verification via the project's JWKS endpoint
 *                         (asymmetric signing keys, the default for new
 *                         Supabase projects).
 *   SUPABASE_JWT_SECRET — optional; legacy HS256 shared secret. If set,
 *                         it takes precedence over JWKS.
 *
 * With neither configured, all requests are treated as unauthenticated
 * (the app then runs in localStorage-only mode).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks = null;
let jwksUrl = null;

async function verifyToken(token, env) {
  if (env.SUPABASE_JWT_SECRET) {
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { audience: 'authenticated' });
    return payload;
  }
  if (env.SUPABASE_URL) {
    const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
    if (!jwks || jwksUrl !== url) {
      jwks = createRemoteJWKSet(new URL(url));
      jwksUrl = url;
    }
    const { payload } = await jwtVerify(token, jwks, { audience: 'authenticated' });
    return payload;
  }
  return null;
}

export async function onRequest(context) {
  context.data.user = null;

  const auth = context.request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (token) {
    try {
      const payload = await verifyToken(token, context.env);
      if (payload && payload.sub) {
        context.data.user = {
          id: payload.sub, // Supabase user UUID — stable storage key
          email: payload.email || null,
        };
      }
    } catch {
      // Invalid/expired token → treat as unauthenticated; storage
      // endpoints respond 401 and the client falls back gracefully.
    }
  }

  return context.next();
}
