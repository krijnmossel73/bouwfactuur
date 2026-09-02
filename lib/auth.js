/**
 * Shared auth guard for Pages Functions.
 *
 * The middleware (functions/_middleware.js) verifies the Supabase JWT and
 * sets context.data.user. Handlers that spend money or quota on the
 * user's behalf (KvK, VIES, Peppol) must refuse anonymous callers.
 */

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Returns the authenticated user, or a 401 Response to return as-is.
 * Usage:
 *   const auth = requireUser(context);
 *   if (auth.err) return auth.err;
 *   const user = auth.user;
 */
export function requireUser(context) {
  const user = context.data?.user;
  if (!user || !user.id) return { err: jsonResponse({ error: 'unauthorized' }, 401) };
  return { user };
}
