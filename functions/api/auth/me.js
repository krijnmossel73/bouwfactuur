/**
 * Cloudflare Pages Function: /api/auth/me
 *
 * Returns the current user's identity as extracted from the
 * Cloudflare Access JWT by the middleware.
 *
 * Response:
 *   { authenticated: true, email: "user@example.com", id: "..." }
 *   or
 *   { authenticated: false }
 */

export async function onRequestGet(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const user = context.data?.user;

  if (user && user.email) {
    return new Response(JSON.stringify({
      authenticated: true,
      email: user.email,
      id: user.id,
    }), { status: 200, headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    authenticated: false,
  }), { status: 200, headers: corsHeaders });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
