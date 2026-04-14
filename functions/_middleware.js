/**
 * Cloudflare Pages Functions Middleware
 *
 * Runs before all /functions/** handlers.
 * Extracts user identity from the Cloudflare Access JWT
 * (Cf-Access-Jwt-Assertion header) and passes it to handlers
 * via context.data.user.
 *
 * When Cloudflare Access is in front of the app, the JWT is already
 * validated before reaching our Functions — we just decode the payload.
 *
 * If Access is NOT configured (local dev, or Access not enabled),
 * handlers still work but context.data.user will be null.
 */

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload (middle part)
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const jwt = context.request.headers.get('cf-access-jwt-assertion');

  if (jwt) {
    const payload = decodeJwtPayload(jwt);
    if (payload) {
      context.data.user = {
        email: payload.email || null,
        sub: payload.sub || null, // Unique user ID
        iat: payload.iat || null,
        exp: payload.exp || null,
        // Use email as the user identifier for storage scoping
        id: payload.email || payload.sub || 'anonymous',
      };
    } else {
      context.data.user = null;
    }
  } else {
    context.data.user = null;
  }

  // Continue to the next handler
  return await context.next();
}
