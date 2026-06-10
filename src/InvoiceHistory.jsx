import { useRef } from 'react';
import { fmt, fmtDate } from './utils.js';
import { BackIcon, PlusIcon, EyeIcon, CopyIcon, TrashIcon, ListIcon, DownIcon } from './Icons.jsx';
import { btn1, btn2, sec, crd } from './styles.js';

export default function InvoiceHistory({
  invoices, onBack, onNew, onLoad, onDuplicate, onDelete,
  onToggleStatus, onExportBackup, onImportBackup,
}) {
  const fileRef = useRef(null);

  const open = invoices.filter((i) => (i.status ?? 'open') === 'open');
  const openTotal = open.reduce((a, i) => a + (i.totals?.totIncl ?? 0), 0);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header bar */}
      <div style={{ borderBottom: '1px solid var(--bd)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} style={{ ...btn2, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <BackIcon /> Terug
          </button>
          <span style={{ ...sec, margin: 0 }}><ListIcon /> Factuurhistorie</span>
        </div>
        <button onClick={onNew} style={{ ...btn1, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PlusIcon /> Nieuw
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Outstanding summary */}
        {invoices.length > 0 && (
          <div style={{ ...crd, marginBottom: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600 }}>Openstaand</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ac)', marginTop: '2px' }}>{fmt(openTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600 }}>Open facturen</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{open.length} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--tm)' }}>van {invoices.length}</span></div>
            </div>
          </div>
        )}

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tm)' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>Nog geen opgeslagen facturen</div>
            <div style={{ fontSize: '11px' }}>Maak een factuur aan en sla deze op.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invoices.map((inv) => {
              const isOpen = (inv.status ?? 'open') === 'open';
              return (
                <div key={inv.id} style={{ ...crd, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {inv.nummer} — {inv.og?.naam || 'Onbekend'}
                      <button
                        onClick={() => onToggleStatus(inv.id)}
                        title={isOpen ? 'Markeer als betaald' : 'Markeer als open'}
                        style={{
                          fontSize: '9px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                          padding: '3px 8px', borderRadius: '10px', cursor: 'pointer',
                          background: isOpen ? 'rgba(245,158,11,.12)' : 'rgba(22,163,74,.12)',
                          color: isOpen ? 'var(--ac)' : 'var(--ok)',
                          border: `1px solid ${isOpen ? 'rgba(245,158,11,.4)' : 'rgba(22,163,74,.4)'}`,
                        }}
                      >
                        {isOpen ? 'Open' : 'Betaald'}
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--tm)', marginTop: '3px' }}>
                      {fmtDate(inv.date)} &nbsp;|&nbsp; {inv.project?.projectNaam || '—'} &nbsp;|&nbsp;
                      <span style={{ color: 'var(--ac)', fontWeight: 600 }}>{fmt(inv.totals?.totIncl ?? 0)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => onLoad(inv)} style={{ ...btn2, padding: '6px 10px', fontSize: '10px' }} title="Openen">
                      <EyeIcon />
                    </button>
                    <button onClick={() => onDuplicate(inv)} style={{ ...btn2, padding: '6px 10px', fontSize: '10px' }} title="Dupliceren">
                      <CopyIcon />
                    </button>
                    <button onClick={() => onDelete(inv.id)} style={{ ...btn2, padding: '6px 10px', fontSize: '10px', color: 'var(--dn)', borderColor: 'var(--dn)' }} title="Verwijderen">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Backup / restore */}
        <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid var(--bd)' }}>
          <div style={{ fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600, marginBottom: '8px' }}>
            Gegevensbeheer
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={onExportBackup} style={{ ...btn2, padding: '7px 12px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <DownIcon /> Backup downloaden
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ ...btn2, padding: '7px 12px', fontSize: '10px' }}>
              Backup terugzetten
            </button>
            <input
              ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportBackup(f);
                e.target.value = '';
              }}
            />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--tm)', marginTop: '6px', lineHeight: 1.6 }}>
            Gegevens staan lokaal in deze browser. Download regelmatig een backup om verlies te voorkomen.
          </div>
        </div>
      </div>
    </div>
  );
}
