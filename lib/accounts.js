/**
 * Account & entitlement logic for the freemium model.
 *
 * Free tier: FREE_INVOICE_LIMIT invoices (lifetime, counted server-side
 * when a row is inserted in the invoices table). A subscription in an entitled
 * status removes the limit. past_due is treated as entitled so a failed
 * renewal doesn't instantly lock someone out mid-retry.
 */

export const FREE_INVOICE_LIMIT = 2;

const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'];

export function isEntitled(account) {
  return ENTITLED_STATUSES.includes(account?.subscription_status);
}

/** Fetch the user's account row, creating it if missing. */
export async function getOrCreateAccount(db, user) {
  const existing = await db
    .prepare('SELECT * FROM accounts WHERE user_id = ?')
    .bind(user.id)
    .first();
  if (existing) return existing;
  await db
    .prepare('INSERT INTO accounts (user_id, email) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING')
    .bind(user.id, user.email || null)
    .run();
  return (
    (await db.prepare('SELECT * FROM accounts WHERE user_id = ?').bind(user.id).first()) ||
    { user_id: user.id, email: user.email, invoices_created: 0, subscription_status: null }
  );
}
