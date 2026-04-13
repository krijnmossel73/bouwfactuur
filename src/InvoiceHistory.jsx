import { fmt, fmtDate } from './utils.js';
import { BackIcon, PlusIcon, EyeIcon, CopyIcon, TrashIcon, ListIcon } from './Icons.jsx';
import { btn1, btn2, sec, crd } from './styles.js';

export default function InvoiceHistory({ invoices, onBack, onNew, onLoad, onDuplicate, onDelete }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header bar */}
      <div style={{ borderBottom: '1px solid var(--bd)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      {/* Invoice list */}
      <div style={{ padding: '20px' }}>
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tm)' }}>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>Nog geen opgeslagen facturen</div>
            <div style={{ fontSize: '11px' }}>Maak een factuur aan en sla deze op.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invoices.map(inv => (
              <div key={inv.id} style={{ ...crd, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {inv.nummer} — {inv.og?.naam || 'Onbekend'}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
