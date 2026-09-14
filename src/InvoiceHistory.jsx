import { useRef } from 'react';
import { fmt, fmtDate } from './utils.js';
import { BackIcon, PlusIcon, EyeIcon, CopyIcon, TrashIcon, ListIcon, DownIcon } from './Icons.jsx';
import { btn1, btn2, sec, crd } from './styles.js';

export default function InvoiceHistory({
  onDeleteAccount,
  invoices, onBack, onNew, onLoad, onPdf, onDuplicate, onDelete,
  onToggleStatus, onExportBackup, onImportBackup,
  account, onUpgrade, onManageSubscription,
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
              <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600 }}>Openstaand</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ac)', marginTop: '2px' }}>{fmt(openTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600 }}>Open facturen</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>{open.length} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--tm)' }}>van {invoices.length}</span></div>
            </div>
          </div>
        )}

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tm)' }}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>Nog geen opgeslagen facturen</div>
            <div style={{ fontSize: '13px' }}>Maak een factuur aan en sla deze op.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invoices.map((inv) => {
              const isOpen = (inv.status ?? 'open') === 'open';
              return (
                <div key={inv.id} style={{ ...crd, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {inv.nummer} — {inv.og?.naam || 'Onbekend'}
                      <button
                        onClick={() => onToggleStatus(inv.id)}
                        title={isOpen ? 'Markeer als betaald' : 'Markeer als open'}
                        style={{
                          fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                          padding: '3px 8px', borderRadius: '10px', cursor: 'pointer',
                          background: isOpen ? 'rgba(245,158,11,.12)' : 'rgba(22,163,74,.12)',
                          color: isOpen ? 'var(--ac)' : 'var(--ok)',
                          border: `1px solid ${isOpen ? 'rgba(245,158,11,.4)' : 'rgba(22,163,74,.4)'}`,
                        }}
                      >
                        {isOpen ? 'Open' : 'Betaald'}
                      </button>
                      {inv.peppol?.invoiceId && (() => {
                        const bad = inv.peppol.state === 'refused' || inv.peppol.state === 'error';
                        return (
                          <span
                            title={`Peppol via B2Brouter (ref ${inv.peppol.invoiceId})`}
                            style={{
                              fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                              padding: '3px 8px', borderRadius: '10px',
                              background: bad ? 'rgba(220,38,38,.10)' : 'rgba(37,99,235,.10)',
                              color: bad ? '#B91C1C' : '#1D4ED8',
                              border: `1px solid ${bad ? 'rgba(220,38,38,.35)' : 'rgba(37,99,235,.35)'}`,
                            }}
                          >
                            Peppol: {inv.peppol.stateLabel || inv.peppol.state}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--tm)', marginTop: '3px' }}>
                      {fmtDate(inv.date)}{inv.project?.projectNaam ? <> &nbsp;·&nbsp; {inv.project.projectNaam}</> : null} &nbsp;·&nbsp;
                      <span style={{ color: 'var(--ac)', fontWeight: 600, fontFamily: 'var(--fm)' }}>{fmt(inv.totals?.totIncl ?? 0)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => onLoad(inv)} style={{ ...btn2, padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }} title="Openen" aria-label="Openen">
                      <EyeIcon /><span className="btn-txt">Openen</span>
                    </button>
                    <button onClick={() => onPdf(inv)} style={{ ...btn2, padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }} title="PDF downloaden" aria-label="PDF downloaden">
                      <DownIcon /><span className="btn-txt">PDF</span>
                    </button>
                    <button onClick={() => onDuplicate(inv)} style={{ ...btn2, padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }} title="Kopiëren als nieuwe factuur" aria-label="Kopiëren">
                      <CopyIcon /><span className="btn-txt">Kopiëren</span>
                    </button>
                    <button onClick={() => onDelete(inv.id)} style={{ ...btn2, padding: '6px 10px', fontSize: '12px', color: 'var(--dn)', borderColor: 'var(--dn)' }} title="Verwijderen" aria-label="Verwijderen">
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Subscription */}
        {account?.billingEnabled && (
          <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid var(--bd)' }}>
            <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600, marginBottom: '8px' }}>
              Abonnement
            </div>
            {account.plan === 'pro' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px' }}>
                  <strong>BouwFactuur Pro</strong> — {account.subscriptionStatus === 'past_due' ? 'betaling in behandeling' : 'actief'}
                </span>
                <button onClick={onManageSubscription} style={{ ...btn2, padding: '6px 12px', fontSize: '12px' }}>
                  Abonnement beheren
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: 'var(--tm)' }}>
                  Gratis plan: {account.invoicesCreated ?? 0} van {account.freeLimit ?? 2} facturen gebruikt
                </span>
                <button onClick={onUpgrade} style={{ ...btn1, padding: '6px 12px', fontSize: '12px' }}>
                  Upgrade naar Pro
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backup / restore */}
        <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid var(--bd)' }}>
          <div style={{ fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tm)', fontWeight: 600, marginBottom: '8px' }}>
            Gegevensbeheer
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={onExportBackup} style={{ ...btn2, padding: '7px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <DownIcon /> Backup downloaden
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ ...btn2, padding: '7px 12px', fontSize: '12px' }}>
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
          <div style={{ fontSize: '12px', color: 'var(--tm)', marginTop: '6px', lineHeight: 1.6 }}>
            Uw gegevens worden veilig in de cloud opgeslagen, gekoppeld aan uw account. Download af en toe een backup voor extra zekerheid.
            Zie de <a href="#/privacy" style={{ color: 'var(--tm)' }}>privacyverklaring</a> en <a href="#/voorwaarden" style={{ color: 'var(--tm)' }}>algemene voorwaarden</a>.
          </div>

          <div style={{ marginTop: '22px', paddingTop: '14px', borderTop: '1px dashed var(--bd)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tm)', marginBottom: '6px' }}>Account verwijderen</div>
            <div style={{ fontSize: '12px', color: 'var(--tm)', lineHeight: 1.6, marginBottom: '8px' }}>
              Verwijdert uw account, profiel, opdrachtgevers en alle facturen definitief, en beëindigt een lopend abonnement. Download eerst een backup: facturen moet u 7 jaar bewaren.
            </div>
            <button onClick={onDeleteAccount} style={{ ...btn2, padding: '7px 12px', fontSize: '12px', color: 'var(--dn)', borderColor: 'rgba(220,38,38,.4)' }}>
              Account en alle gegevens verwijderen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
