/** GET /api/invoices/next?year=2026 → { next: "2026-0004" } */
import { jsonResponse } from '../../../lib/auth.js';
import { nextNumber } from '../../../lib/invoices.js';
import { guard, handleError } from './_shared.js';

export async function onRequestGet(context) {
  const g = guard(context);
  if (g.err) return g.err;
  const y = parseInt(new URL(context.request.url).searchParams.get('year') || '', 10);
  try {
    return jsonResponse({ next: await nextNumber(g.db, g.user.id, Number.isInteger(y) && y > 2000 ? y : undefined) });
  } catch (err) {
    return handleError(err);
  }
}
