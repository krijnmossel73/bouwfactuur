import { useState } from 'react';
import { startCheckout } from './billing.js';
import { btn1, btn2 } from './styles.js';

/**
 * Paywall: shown when a free user hits the invoice limit.
 * `account` comes from /api/account (freeLimit, price, …).
 */
export default function PaywallModal({ account, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const upgrade = async () => {
    setBusy(true);
    setError(false);
    try {
      await startCheckout(); // redirects on success
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const freeLimit = account?.freeLimit ?? 2;
  const priceLine = account?.price?.formatted
    ? `${account.price.formatted}, maandelijks opzegbaar.`
    : 'Maandelijks opzegbaar.';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}
    >
      <div style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '400px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-.01em', marginBottom: '8px' }}>
          Uw {freeLimit} gratis facturen zijn gebruikt
        </div>
        <p style={{ fontSize: '12px', color: 'var(--tm)', lineHeight: 1.7, margin: '0 0 14px' }}>
          Met <strong style={{ color: 'var(--tx)' }}>BouwFactuur Pro</strong> maakt u onbeperkt
          facturen, inclusief de compliance-controle, G-rekening splitsing en
          UBL/Peppol-export. {priceLine}
        </p>

        <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none' }}>
          {['Onbeperkt facturen maken', 'Veilig betalen via iDEAL of kaart', 'Op elk moment opzegbaar via uw accountportaal'].map((t) => (
            <li key={t} style={{ fontSize: '11px', color: 'var(--tx)', lineHeight: 1.9 }}>
              <span style={{ color: 'var(--ok)', fontWeight: 700 }}>✓</span> {t}
            </li>
          ))}
        </ul>

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: '5px', fontSize: '11px', marginBottom: '12px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)', color: 'var(--dn)' }}>
            Er ging iets mis bij het starten van de betaling. Probeer het opnieuw.
          </div>
        )}

        <button onClick={upgrade} disabled={busy} style={{ ...btn1, width: '100%', opacity: busy ? 0.6 : 1, marginBottom: '8px' }}>
          {busy ? 'Bezig…' : 'Upgrade naar BouwFactuur Pro'}
        </button>
        <button onClick={onClose} disabled={busy} style={{ ...btn2, width: '100%', opacity: busy ? 0.6 : 1 }}>
          Later
        </button>
      </div>
    </div>
  );
}
