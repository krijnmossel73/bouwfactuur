import { btn1, btn2 } from './styles.js';

/**
 * Public landing page, shown to non-logged-in visitors.
 * BouwFactuur requires an account: all data lives in cloud storage.
 */
export default function LandingPage({ onLogin, onRegister }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top bar ── */}
      <div style={{ borderBottom: '1px solid var(--bd)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-.01em' }}>
          Bouw<span style={{ color: 'var(--ac)' }}>Factuur</span>
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onLogin} style={{ ...btn2, padding: '7px 14px', fontSize: '11px' }}>Inloggen</button>
          <button onClick={onRegister} style={{ ...btn1, padding: '7px 14px', fontSize: '11px' }}>Registreren</button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ maxWidth: '640px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, margin: '0 0 14px' }}>
            Compliant facturen voor de bouw,<br />in drie stappen
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--tm)', lineHeight: 1.7, margin: '0 auto 24px', maxWidth: '520px' }}>
            BouwFactuur is gemaakt voor onderaannemers en zzp'ers in de bouw.
            Maak facturen die voldoen aan de Nederlandse regels: BTW verlegd,
            G-rekening splitsing, Wka-administratie en e-facturatie via UBL.
            Een ingebouwde controle waarschuwt vóór verzending als er iets
            ontbreekt.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
            <button onClick={onRegister} style={{ ...btn1, padding: '11px 26px', fontSize: '12px' }}>
              Gratis account aanmaken
            </button>
            <button onClick={onLogin} style={{ ...btn2, padding: '11px 26px', fontSize: '12px' }}>
              Inloggen
            </button>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--tm)', marginBottom: '10px' }}>
            Uw eerste 2 facturen zijn gratis — geen betaalgegevens nodig.
          </div>

          <a
            href="#/uitleg"
            style={{ fontSize: '11px', color: 'var(--ac)', textDecoration: 'underline' }}
          >
            Hoe werkt BouwFactuur? Lees de uitleg →
          </a>

          {/* ── Feature highlights ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginTop: '40px', textAlign: 'left' }}>
            {[
              {
                t: 'BTW verlegd & G-rekening',
                d: 'Verleggingsregeling conform art. 12 lid 5 Wet OB, met automatische G-rekening splitsing per vakgebied.',
              },
              {
                t: 'Controle vóór verzending',
                d: 'Toets op de factuurvereisten van de Belastingdienst en Wka-administratie, inclusief IBAN-validatie.',
              },
              {
                t: 'E-factuur (UBL / Peppol)',
                d: 'Exporteer naast PDF ook een NLCIUS UBL 2.1 e-factuur, klaar voor verzending via Peppol.',
              },
              {
                t: 'Overal beschikbaar',
                d: 'Uw gegevens staan veilig in de cloud, gekoppeld aan uw account, op al uw apparaten.',
              },
            ].map((f) => (
              <div key={f.t} style={{ border: '1px solid var(--bd)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '5px' }}>{f.t}</div>
                <div style={{ fontSize: '10px', color: 'var(--tm)', lineHeight: 1.6 }}>{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid var(--bd)', padding: '12px 24px', textAlign: 'center', fontSize: '10px', color: 'var(--tm)' }}>
        BouwFactuur — facturatie voor de bouwsector · <a href="#/uitleg" style={{ color: 'var(--tm)' }}>Uitleg</a>
      </div>
    </div>
  );
}
