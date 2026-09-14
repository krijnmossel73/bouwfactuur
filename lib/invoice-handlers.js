import { jsonResponse } from './auth.js';
import { InvoiceError } from './invoices.js';

export function guard(context) {
  const user = context.data?.user;
  if (!user || !user.id) return { err: jsonResponse({ error: 'unauthorized' }, 401) };
  if (!context.env?.DB) return { err: jsonResponse({ error: 'storage_unavailable' }, 503) };
  return { user, db: context.env.DB, billingLive: Boolean(context.env.STRIPE_SECRET_KEY) };
}

export function handleError(err) {
  if (err instanceof InvoiceError) return jsonResponse({ error: err.code, ...err.extra }, err.status);
  return jsonResponse({ error: 'storage_error', detail: String(err?.message || err) }, 500);
}
