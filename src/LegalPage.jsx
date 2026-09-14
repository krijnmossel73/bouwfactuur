import { btn2 } from './styles.js';

/** Shared shell for the privacy statement and algemene voorwaarden. */
export default function LegalPage({ title, updated, onBack, loggedIn, children }) {
  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ borderBottom: '1px solid var(--bd)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#" style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-.01em', color: 'var(--tx)', textDecoration: 'none' }}>
          Bouw<span style={{ color: 'var(--ac)' }}>Factuur</span>
        </a>
        <button onClick={onBack} style={{ ...btn2, padding: '7px 14px', fontSize: '13px' }}>
          {loggedIn ? '← Terug naar de app' : '← Terug'}
        </button>
      </div>
      <div className="legal" style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 4px' }}>{title}</h1>
        <div style={{ fontSize: '12px', color: 'var(--tm)', marginBottom: '24px' }}>Laatst bijgewerkt: {updated}</div>
        {children}
        <div style={{ marginTop: '36px', paddingTop: '16px', borderTop: '1px solid var(--bd)', fontSize: '12px', color: 'var(--tm)' }}>
          <a href="#/privacy" style={{ color: 'var(--tm)' }}>Privacyverklaring</a> · <a href="#/voorwaarden" style={{ color: 'var(--tm)' }}>Algemene voorwaarden</a> · <a href="#/uitleg" style={{ color: 'var(--tm)' }}>Uitleg</a>
        </div>
      </div>
    </div>
  );
}
