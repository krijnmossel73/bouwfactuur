// Smoke tests for lib/invoices.js against SQLite via a small D1 shim (node >= 22).
// Run: npm test
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { createInvoice, listInvoices, nextNumber, patchInvoice, softDeleteInvoice, migrateLegacyBlob, updatePeppolByRef } from '../lib/invoices.js';

// Minimal D1 shim over node:sqlite
function d1(db) {
  const wrap = (sql) => {
    let args = [];
    const st = {
      bind: (...a) => { args = a; return st; },
      first: async () => db.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    };
    return st;
  };
  return {
    prepare: wrap,
    batch: async (stmts) => { db.exec('BEGIN'); try { for (const s of stmts) await s.run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}
const raw = new DatabaseSync(':memory:');
raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const db = d1(raw);
const user = { id: 'u1', email: 'k@x.nl' };
const base = { date: '2026-09-15', oa: { naam: 'A' }, og: { naam: 'B' }, project: { factuurdatum: '2026-09-15' }, lines: [{ bedrag: '100' }], totals: { totIncl: 100 } };

console.log('next (empty):', await nextNumber(db, 'u1', 2026));
const a = await createInvoice(db, user, { ...base, nummer: '2026-0001' });
const b = await createInvoice(db, user, { ...base, nummer: '2026-0001' }); // stale prediction from another device
console.log('a,b numbers:', a.nummer, b.nummer, 'next:', await nextNumber(db, 'u1', 2026));
const c = await createInvoice(db, user, { ...base, nummer: 'PROJ-7' });
console.log('custom:', c.nummer);
try { await createInvoice(db, user, { ...base, nummer: 'PROJ-7' }); } catch (e) { console.log('dup custom →', e.status, e.code); }
// freemium gate: 3 created, limit 2, billing live
try { await createInvoice(db, user, base, { billingLive: true }); } catch (e) { console.log('gate →', e.status, e.code, e.extra); }
const p = await patchInvoice(db, 'u1', a.id, { status: 'betaald', peppol: { invoiceId: '99', state: 'sent' } });
console.log('patched:', p.status, p.peppol);
console.log('webhook updated rows:', await updatePeppolByRef(db, '99', { state: 'registered', stateLabel: 'Afgeleverd' }));
await softDeleteInvoice(db, 'u1', b.id);
console.log('list after delete:', (await listInvoices(db, 'u1')).map(i => `${i.nummer}:${i.status}:${i.peppol?.state||'-'}`), 'next:', await nextNumber(db, 'u1', 2026));
// other user can't patch
try { await patchInvoice(db, 'u2', a.id, { status: 'open' }); } catch (e) { console.log('cross-user →', e.status); }
// legacy migration
raw.prepare("INSERT INTO kv (user_id,key,value) VALUES ('u3','invoices',?)").run(JSON.stringify([
  { id: '2', nummer: '2026-0002', date: '2026-08-01', status: 'betaald', totals: { totIncl: 5 }, lines: [] },
  { id: '1', nummer: '2026-0001', date: '2026-07-01', status: 'open', totals: { totIncl: 7 }, lines: [], peppol: { invoiceId: '77', state: 'sent' } },
  { id: '3', nummer: '2026-0001', date: '2026-07-02', status: 'open', totals: {}, lines: [] },
]));
console.log('migrated:', await migrateLegacyBlob(db, { id: 'u3' }), (await listInvoices(db, 'u3')).map(i => i.nummer), 'next u3:', await nextNumber(db, 'u3', 2026), 'kv left:', raw.prepare("SELECT count(*) c FROM kv WHERE user_id='u3'").get().c);
