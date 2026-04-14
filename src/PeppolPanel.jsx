import { useState } from 'react';
import { peppolLookup, peppolSend } from './peppol.js';

/**
 * Peppol panel shown on the invoice preview step.
 * Flow: Check recipient → Show status → Send if available.
 */
export default function PeppolPanel({ recipientKvk, recipientName, senderKvk, xmlString, onGenerateXml }) {
  const [lookupStatus, setLookupStatus] = useState('idle'); // idle | loading | found | notfound | error
  const [lookupData, setLookupData] = useState(null);
  const [sendStatus, setSendStatus] = useState('idle'); // idle | loading | sent | error | needsSetup
  const [sendResult, setSendResult] = useState(null);

  const doLookup = async () => {
    if (!recipientKvk || recipientKvk.replace(/\D/g, '').length !== 8) {
      setLookupStatus('error');
      setLookupData({ error: 'Vul het KvK-nummer van de opdrachtgever in (stap 2).' });
      return;
    }

    setLookupStatus('loading');
    setLookupData(null);
    setSendStatus('idle');
    setSendResult(null);

    const result = await peppolLookup(recipientKvk);

    if (result.devMode) {
      setLookupStatus('error');
      setLookupData(result);
      return;
    }

    if (result.error) {
      setLookupStatus('error');
      setLookupData(result);
      return;
    }

    if (result.found) {
      setLookupStatus('found');
      setLookupData(result);
    } else {
      setLookupStatus('notfound');
      setLookupData(result);
    }
  };

  const doSend = async () => {
    setSendStatus('loading');
    setSendResult(null);

    // Generate fresh XML
    const xml = onGenerateXml();

    const result = await peppolSend(xml, recipientKvk, senderKvk);

    if (result.needsSetup) {
      setSendStatus('needsSetup');
      setSendResult(result);
    } else if (result.success) {
      setSendStatus('sent');
      setSendResult(result);
    } else {
      setSendStatus('error');
      setSendResult(result);
    }
  };

  const statusColors = {
    idle: { bg: 'var(--sf)', border: 'var(--bd)', accent: 'var(--tm)' },
    loading: { bg: 'var(--sf)', border: 'var(--ac)', accent: 'var(--ac)' },
    found: { bg: '#F0FDF4', border: '#86EFAC', accent: '#16A34A' },
    notfound: { bg: '#FFF7ED', border: '#FED7AA', accent: '#C2410C' },
    error: { bg: '#FEF2F2', border: '#FECACA', accent: '#DC2626' },
  };

  const c = statusColors[lookupStatus] || statusColors.idle;

  return (
    <div style={{
      marginTop: '14px',
      padding: '14px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: '8px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '10px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
        <span style={{
          fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: c.accent,
        }}>
          Peppol e-Invoicing
        </span>
      </div>

      {/* Lookup section */}
      {lookupStatus === 'idle' && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--tm)', marginBottom: '8px', lineHeight: 1.5 }}>
            Controleer of {recipientName || 'de opdrachtgever'} facturen kan ontvangen via het Peppol netwerk.
          </div>
          <button
            onClick={doLookup}
            style={{
              background: 'var(--ac)', color: '#fff', border: 'none',
              borderRadius: '5px', padding: '8px 16px', fontSize: '11px',
              fontWeight: 600, fontFamily: 'var(--fn)', cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            Peppol status controleren
          </button>
        </div>
      )}

      {lookupStatus === 'loading' && (
        <div style={{ fontSize: '11px', color: 'var(--ac)' }}>
          ⟳ Zoeken in Peppol Directory...
        </div>
      )}

      {lookupStatus === 'found' && (
        <div>
          <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, marginBottom: '4px' }}>
            ● Geregistreerd op Peppol
          </div>
          <div style={{ fontSize: '10px', color: '#166534', lineHeight: 1.5 }}>
            {lookupData?.name && <div>Naam: {lookupData.name}</div>}
            <div>Peppol ID: {lookupData?.participantId}</div>
            {lookupData?.supportsInvoice && <div>Facturen ontvangen: ✓ ondersteund</div>}
          </div>

          {/* Send section */}
          {sendStatus === 'idle' && (
            <button
              onClick={doSend}
              style={{
                marginTop: '10px',
                background: '#16A34A', color: '#fff', border: 'none',
                borderRadius: '5px', padding: '8px 16px', fontSize: '11px',
                fontWeight: 600, fontFamily: 'var(--fn)', cursor: 'pointer',
                letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              Verzend via Peppol
            </button>
          )}

          {sendStatus === 'loading' && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--ac)' }}>
              ⟳ Factuur verzenden via Peppol...
            </div>
          )}

          {sendStatus === 'sent' && (
            <div style={{
              marginTop: '10px', padding: '8px 12px', background: '#DCFCE7',
              borderRadius: '4px', fontSize: '11px', color: '#166534',
            }}>
              ✓ Factuur verzonden via Peppol
              {sendResult?.messageId && <span> (ref: {sendResult.messageId})</span>}
            </div>
          )}

          {sendStatus === 'needsSetup' && (
            <div style={{
              marginTop: '10px', padding: '10px 12px', background: '#FFF7ED',
              borderRadius: '4px', fontSize: '11px', color: '#9A3412', lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Peppol verzending nog niet geconfigureerd</div>
              <div>Om facturen via Peppol te verzenden heb je een Access Point nodig. Stel de volgende environment variables in via Cloudflare Pages:</div>
              <div style={{
                marginTop: '6px', padding: '6px 8px', background: '#FEF3C7',
                borderRadius: '3px', fontFamily: 'var(--fn)', fontSize: '10px',
              }}>
                PEPPOL_API_KEY = jouw API key<br />
                PEPPOL_PROVIDER = storecove<br />
                PEPPOL_SENDER_ID = jouw legal entity ID
              </div>
              <div style={{ marginTop: '6px' }}>
                Aanbevolen providers: <a href="https://www.storecove.com" target="_blank" rel="noopener" style={{ color: '#C2410C' }}>Storecove</a> (NL, gratis sandbox) of <a href="https://econnect.eu" target="_blank" rel="noopener" style={{ color: '#C2410C' }}>eConnect</a> (bouw-sector).
              </div>
            </div>
          )}

          {sendStatus === 'error' && (
            <div style={{
              marginTop: '10px', padding: '8px 12px', background: '#FEF2F2',
              borderRadius: '4px', fontSize: '11px', color: '#991B1B',
            }}>
              ✗ {sendResult?.error || 'Verzending mislukt.'}
            </div>
          )}
        </div>
      )}

      {lookupStatus === 'notfound' && (
        <div>
          <div style={{ fontSize: '12px', color: '#C2410C', fontWeight: 600, marginBottom: '4px' }}>
            ○ Niet gevonden op Peppol
          </div>
          <div style={{ fontSize: '10px', color: '#7C2D12', lineHeight: 1.5 }}>
            {recipientName || 'De opdrachtgever'} (KvK: {recipientKvk}) is niet geregistreerd op het Peppol netwerk. Gebruik de PDF- of XML-export om de factuur handmatig te verzenden.
          </div>
          <button
            onClick={() => { setLookupStatus('idle'); setLookupData(null); }}
            style={{
              marginTop: '8px', background: 'transparent', color: '#C2410C',
              border: '1px solid #FDBA74', borderRadius: '4px', padding: '5px 12px',
              fontSize: '10px', fontFamily: 'var(--fn)', cursor: 'pointer',
            }}
          >
            Opnieuw controleren
          </button>
        </div>
      )}

      {lookupStatus === 'error' && (
        <div>
          <div style={{ fontSize: '11px', color: '#DC2626', marginBottom: '4px' }}>
            {lookupData?.error || lookupData?.message || 'Fout bij Peppol lookup.'}
          </div>
          <button
            onClick={() => { setLookupStatus('idle'); setLookupData(null); }}
            style={{
              marginTop: '6px', background: 'transparent', color: '#DC2626',
              border: '1px solid #FECACA', borderRadius: '4px', padding: '5px 12px',
              fontSize: '10px', fontFamily: 'var(--fn)', cursor: 'pointer',
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      )}
    </div>
  );
}
