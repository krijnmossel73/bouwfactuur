/**
 * Invoice persistence (D1 `invoices` table) and server-side numbering.
 *
 * Numbering: `YYYY-NNNN`, sequential per user per year, allocated at insert
 * time so two devices can never issue the same number. A user may type a
 * custom number; it is accepted when unused and non-sequential-looking,
 * otherwise the server allocates. Content is immutable after creation
 * (Dutch practice: correct with a credit note, don't edit an issued invoice).
 */

import { FREE_INVOICE_LIMIT, isEntitled, getOrCreateAccount } from './accounts.js';

const SEQ_RE = /^(\d{4})-(\d{1,6})$/;

export class InvoiceError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export function pad(n) { return String(n).padStart(4, '0'); }

/** Row → the invoice object the client already understands. */
export function rowToInvoice(row) {
  let data = {};
  try { data = JSON.parse(row.data) || {}; } catch { data = {}; }
  let peppol = null;
  try { peppol = row.peppol ? JSON.parse(row.peppol) : null; } catch { peppol = null; }
  return {
    ...data,
    id: row.id,
    nummer: row.number,
    date: row.date,
    status: row.status,
    ...(peppol ? { peppol } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

export async function listInvoices(db, userId) {
  const { results } = await db
    .prepare('SELECT * FROM invoices WHERE user_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC')
    .bind(userId)
    .all();
  return (results || []).map(rowToInvoice);
}

/** Soft-deleted invoices, most recently deleted first. */
export async function listDeletedInvoices(db, userId) {
  const { results } = await db
    .prepare('SELECT * FROM invoices WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC')
    .bind(userId)
    .all();
  return (results || []).map(rowToInvoice);
}

/** Undo a soft delete. The number was never released, so no conflict is possible. */
export async function restoreInvoice(db, userId, id) {
  const res = await db
    .prepare("UPDATE invoices SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL")
    .bind(id, userId)
    .run();
  if (!res.meta?.changes) throw new InvoiceError('not_found', 404);
  const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  return rowToInvoice(row);
}

/** Highest allocated sequence for (user, year), deleted rows included. */
async function maxSeq(db, userId, year) {
  const row = await db
    .prepare('SELECT MAX(seq) AS m FROM invoices WHERE user_id = ? AND year = ?')
    .bind(userId, year)
    .first();
  return Number(row?.m) || 0;
}

/** Predicted next number for the UI. */
export async function nextNumber(db, userId, year = new Date().getFullYear()) {
  const m = await maxSeq(db, userId, year);
  return `${year}-${pad(m + 1)}`;
}

function yearOf(dateStr) {
  const y = parseInt(String(dateStr || '').slice(0, 4), 10);
  return Number.isInteger(y) && y > 2000 ? y : new Date().getFullYear();
}

async function assertUnderLimit(db, user, count, billingLive) {
  const account = await getOrCreateAccount(db, user);
  if (billingLive && !isEntitled(account) && (account.invoices_created || 0) + count > FREE_INVOICE_LIMIT) {
    throw new InvoiceError('subscription_required', 402, {
      invoicesCreated: account.invoices_created || 0,
      freeLimit: FREE_INVOICE_LIMIT,
    });
  }
}

function stripMeta(inv) {
  // Everything except the columns we keep separately
  const rest = { ...(inv || {}) };
  for (const k of ['id', 'nummer', 'status', 'peppol', 'createdAt', 'updatedAt']) delete rest[k];
  return rest;
}

/**
 * Insert one invoice. Returns the stored invoice (server id and number).
 *
 * - number strategy: if the client number looks like `YYYY-NNNN` for the
 *   invoice's year, allocate max+1 for that year (the client shows a
 *   prediction that may already be taken by another device); otherwise
 *   accept the custom number if unused.
 * - the insert and the lifetime counter bump run in one D1 batch (atomic).
 */
export async function createInvoice(db, user, inv, { billingLive = false, countTowardsLimit = true, keepNumber = false } = {}) {
  if (!inv || typeof inv !== 'object') throw new InvoiceError('invalid_invoice', 400);
  const date = String(inv.date || inv.project?.factuurdatum || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const year = yearOf(date);
  const total = Number(inv.totals?.totIncl);
  const status = inv.status === 'betaald' ? 'betaald' : 'open';
  const requested = String(inv.nummer || inv.project?.factuurnummer || '').trim();

  if (countTowardsLimit) await assertUnderLimit(db, user, 1, billingLive);

  const m = requested.match(SEQ_RE);
  // keepNumber: restore path, the backup's number is the legal number of that invoice
  const sequential = !requested || (!keepNumber && m && Number(m[1]) === year);

  if (!sequential) {
    const dup = await db.prepare('SELECT id FROM invoices WHERE user_id = ? AND number = ?').bind(user.id, requested).first();
    if (dup) throw new InvoiceError('number_taken', 409, { number: requested });
  }

  const id = crypto.randomUUID();
  const dataJson = JSON.stringify(stripMeta(inv));
  const peppolJson = inv.peppol ? JSON.stringify(inv.peppol) : null;
  const peppolRef = inv.peppol?.invoiceId ? String(inv.peppol.invoiceId) : null;

  for (let attempt = 0; attempt < 4; attempt++) {
    let seq = m && Number(m[1]) === year ? Number(m[2]) : null;
    let number = requested;
    if (sequential) {
      seq = (await maxSeq(db, user.id, year)) + 1;
      number = `${year}-${pad(seq)}`;
    }
    try {
      const stmts = [
        db.prepare(`INSERT INTO invoices (id, user_id, number, year, seq, date, status, total, data, peppol, peppol_ref)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, user.id, number, year, seq, date, status, Number.isFinite(total) ? total : null, dataJson, peppolJson, peppolRef),
      ];
      if (countTowardsLimit) {
        stmts.push(db.prepare(`UPDATE accounts SET invoices_created = invoices_created + 1, updated_at = datetime('now') WHERE user_id = ?`).bind(user.id));
      }
      await db.batch(stmts);
      const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
      return rowToInvoice(row);
    } catch (err) {
      const msg = String(err?.message || err);
      if (/UNIQUE/i.test(msg) && sequential) continue; // raced another device; re-read max and retry
      if (/UNIQUE/i.test(msg)) throw new InvoiceError('number_taken', 409, { number });
      throw err;
    }
  }
  throw new InvoiceError('numbering_conflict', 409);
}

/** Update mutable fields only: status and/or peppol state. */
export async function patchInvoice(db, userId, id, patch) {
  const sets = [];
  const binds = [];
  if (patch.status !== undefined) {
    if (!['open', 'betaald'].includes(patch.status)) throw new InvoiceError('invalid_status', 400);
    sets.push('status = ?'); binds.push(patch.status);
  }
  if (patch.peppol !== undefined) {
    sets.push('peppol = ?'); binds.push(patch.peppol ? JSON.stringify(patch.peppol) : null);
    sets.push('peppol_ref = ?'); binds.push(patch.peppol?.invoiceId ? String(patch.peppol.invoiceId) : null);
  }
  if (!sets.length) throw new InvoiceError('nothing_to_update', 400);
  sets.push("updated_at = datetime('now')");
  const res = await db
    .prepare(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ? AND user_id = ? AND deleted_at IS NULL`)
    .bind(...binds, id, userId)
    .run();
  if (!res.meta?.changes) throw new InvoiceError('not_found', 404);
  const row = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first();
  return rowToInvoice(row);
}

export async function softDeleteInvoice(db, userId, id) {
  const res = await db
    .prepare("UPDATE invoices SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL")
    .bind(id, userId)
    .run();
  if (!res.meta?.changes) throw new InvoiceError('not_found', 404);
}

/**
 * Update Peppol delivery state by B2Brouter reference (webhook path; no user).
 * Merges into the existing peppol JSON so invoiceId/sentAt are kept.
 */
export async function updatePeppolByRef(db, ref, { state, stateLabel, errorCode }) {
  const { results } = await db.prepare('SELECT id, peppol FROM invoices WHERE peppol_ref = ?').bind(String(ref)).all();
  let n = 0;
  for (const row of results || []) {
    let cur = {};
    try { cur = row.peppol ? JSON.parse(row.peppol) : {}; } catch { cur = {}; }
    const next = { ...cur, invoiceId: String(ref), state, stateLabel: stateLabel || state, errorCode: errorCode || null, updatedAt: new Date().toISOString() };
    await db.prepare("UPDATE invoices SET peppol = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(next), row.id).run();
    n++;
  }
  return n;
}

/**
 * One-time migration of the legacy kv "invoices" blob into rows.
 * Runs when the user has no rows yet and a blob exists; the blob is
 * removed afterwards. Legacy numbers are kept; on a duplicate the
 * number gets a "-2", "-3" suffix so nothing is lost.
 */
export async function migrateLegacyBlob(db, user) {
  const existing = await db.prepare('SELECT 1 FROM invoices WHERE user_id = ? LIMIT 1').bind(user.id).first();
  if (existing) return 0;
  const kvRow = await db.prepare("SELECT value FROM kv WHERE user_id = ? AND key = 'invoices'").bind(user.id).first();
  if (!kvRow) return 0;
  let list = [];
  try { list = JSON.parse(kvRow.value); } catch { list = []; }
  if (!Array.isArray(list) || !list.length) {
    await db.prepare("DELETE FROM kv WHERE user_id = ? AND key IN ('invoices','nextnum')").bind(user.id).run();
    return 0;
  }
  let n = 0;
  // Oldest first so sequence numbers come out in chronological order
  const ordered = [...list].sort((a, b) => String(a?.date || a?.project?.factuurdatum || '').localeCompare(String(b?.date || b?.project?.factuurdatum || '')));
  for (const inv of ordered) {
    const base = String(inv.nummer || inv.project?.factuurnummer || `legacy-${n + 1}`);
    for (let k = 0; k < 20; k++) {
      const number = k === 0 ? base : `${base}-${k + 1}`;
      const m = number.match(SEQ_RE);
      const year = yearOf(inv.date || inv.project?.factuurdatum);
      const seq = m && Number(m[1]) === year ? Number(m[2]) : null;
      try {
        await db.prepare(`INSERT INTO invoices (id, user_id, number, year, seq, date, status, total, data, peppol, peppol_ref, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
          .bind(
            String(inv.id || crypto.randomUUID()), user.id, number, year, seq,
            String(inv.date || inv.project?.factuurdatum || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
            inv.status === 'betaald' ? 'betaald' : 'open',
            Number.isFinite(Number(inv.totals?.totIncl)) ? Number(inv.totals.totIncl) : null,
            JSON.stringify(stripMeta(inv)),
            inv.peppol ? JSON.stringify(inv.peppol) : null,
            inv.peppol?.invoiceId ? String(inv.peppol.invoiceId) : null,
          ).run();
        n++;
        break;
      } catch (err) {
        if (!/UNIQUE/i.test(String(err?.message || err))) throw err;
        if (/invoices\.id|PRIMARY/i.test(String(err?.message || err))) { inv.id = crypto.randomUUID(); k--; continue; }
      }
    }
  }
  await db.prepare("DELETE FROM kv WHERE user_id = ? AND key IN ('invoices','nextnum')").bind(user.id).run();
  return n;
}
