import { useState, useEffect, useRef } from 'react';
import { peppolLookup, peppolSend, peppolStatus } from './peppol.js';

/**
 * Peppol panel shown on the invoice preview step.
 * Flow: Check recipient → Show status → Send if available.
 */
const FINAL_STATES = new Set(['registered', 'accepted', 'refused', 'error', 'paid']);
const GOOD_STATES = new Set(['sent', 'registered', 'accepted', 'paid']);

export default function PeppolPanel({ recipientKvk, recipientName, invoiceNumber, savedId, previous, onGenerateXml, onSent }) {
  const [lookupStatus, setLookupStatus] = useState(previous?.invoiceId ? 'found' : 'idle'); // idle | loading | found | notfound | error
  const [lookupData, setLookupData] = useState(previous?.invoiceId ? { participantId: `0106:${String(recipientKvk || '').replace(/\D/g, '')}` } : null);
  const [sendStatus, setSendStatus] = useState(previous?.invoiceId ? 'sent' : 'idle'); // idle | loading | sent | error | needsSetup
  const [sendResult, setSendResult] = useState(previous || null);
  const [delivery, setDelivery] = useState(previous ? { state: previous.state, stateLabel: previous.stateLabel } : null);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef(null);

  const refreshStatus = async (id) => {
    const invoiceId = id || sendResult?.invoiceId;
    if (!invoiceId) return null;
    setChecking(true);
    const st = await peppolStatus(invoiceId);
    setChecking(false);
    if (!st.error) {
      setDelivery(st);
      onSent?.({ ...(sendResult || {}), invoiceId, state: st.state, stateLabel: st.stateLabel, errorCode: st.errorCode || null });
    }
    return st;
  };

  // After a send, poll a handful of times: B2Brouter transitions arrive
  // asynchronously within seconds (sent → registered → accepted/refused).
  useEffect(() => {
    if (sendStatus !== 'sent' || !sendResult?.invoiceId) return undefined;
    if (delivery && FINAL_STATES.has(delivery.state)) return undefined;
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      const st = await refreshStatus(sendResult.invoiceId);
      if (tries >= 6 || (st && !st.error && FINAL_STATES.has(st.state))) clearInterval(pollRef.current);
    }, 4000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendStatus, sendResult?.invoiceId]);

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

    const result = await peppolSend(xml, recipientKvk, invoiceNumber, savedId);

    if (result.needsSetup) {
      setSendStatus('needsSetup');
      setSendResult(result);
    } else if (result.success) {
      setSendStatus('sent');
      setSendResult(result);
      setDelivery({ state: result.state, stateLabel: result.stateLabel });
      onSent?.({ invoiceId: result.invoiceId, state: result.state, stateLabel: result.stateLabel, sandbox: result.sandbox, sentAt: result.sentAt });
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
          fontSize: '13px', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: c.accent,
        }}>
          Peppol e-Invoicing
        </span>
      </div>

      {/* Lookup section */}
      {lookupStatus === 'idle' && (
        <div>
          <div style={{ fontSize: '13px', color: 'var(--tm)', marginBottom: '8px', lineHeight: 1.5 }}>
            Controleer of {recipientName || 'de opdrachtgever'} facturen kan ontvangen via het Peppol netwerk.
          </div>
          <button
            onClick={doLookup}
            style={{
              background: 'var(--ac)', color: '#fff', border: 'none',
              borderRadius: '5px', padding: '8px 16px', fontSize: '13px',
              fontWeight: 600, fontFamily: 'var(--fn)', cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            Peppol status controleren
          </button>
        </div>
      )}

      {lookupStatus === 'loading' && (
        <div style={{ fontSize: '13px', color: 'var(--ac)' }}>
          ⟳ Zoeken in Peppol Directory...
        </div>
      )}

      {lookupStatus === 'found' && (
        <div>
          <div style={{ fontSize: '14px', color: '#16A34A', fontWeight: 600, marginBottom: '4px' }}>
            ● Geregistreerd op Peppol
          </div>
          <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.5 }}>
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
                borderRadius: '5px', padding: '8px 16px', fontSize: '13px',
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
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ac)' }}>
              ⟳ Factuur verzenden via Peppol...
            </div>
          )}

          {sendStatus === 'sent' && (() => {
            const st = delivery?.state || sendResult?.state;
            const label = delivery?.stateLabel || sendResult?.stateLabel || st;
            const bad = st === 'refused' || st === 'error';
            const done = FINAL_STATES.has(st);
            return (
              <div style={{
                marginTop: '10px', padding: '8px 12px',
                background: bad ? '#FEF2F2' : '#DCFCE7',
                borderRadius: '4px', fontSize: '13px', color: bad ? '#991B1B' : '#166534', lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 600 }}>
                  {bad ? '✗' : done ? '✓' : '⟳'} {label}
                  {sendResult?.sandbox && <span style={{ fontWeight: 400 }}> (sandbox, geen echte verzending)</span>}
                </div>
                {sendResult?.invoiceId && <div>B2Brouter referentie: {sendResult.invoiceId}</div>}
                {delivery?.errorCode && <div>Foutcode: {delivery.errorCode}</div>}
                {delivery?.errorMessage && <div>{delivery.errorMessage}</div>}
                {!done && !GOOD_STATES.has(st) && st && <div style={{ fontSize: '12px' }}>Wordt verwerkt door het Access Point…</div>}
                <button
                  onClick={() => refreshStatus()}
                  disabled={checking}
                  style={{
                    marginTop: '6px', background: 'transparent', color: bad ? '#991B1B' : '#166534',
                    border: `1px solid ${bad ? '#FECACA' : '#86EFAC'}`, borderRadius: '4px', padding: '4px 10px',
                    fontSize: '12px', fontFamily: 'var(--fn)', cursor: checking ? 'wait' : 'pointer',
                  }}
                >
                  {checking ? 'Controleren…' : 'Status vernieuwen'}
                </button>
              </div>
            );
          })()}

          {sendStatus === 'needsSetup' && (
            <div style={{
              marginTop: '10px', padding: '10px 12px', background: '#FFF7ED',
              borderRadius: '4px', fontSize: '13px', color: '#9A3412', lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Peppol verzending nog niet geconfigureerd</div>
              <div>Om facturen via Peppol te verzenden heeft BouwFactuur een B2Brouter API key nodig. Stel deze in als Cloudflare Pages secret:</div>
              <div style={{
                marginTop: '6px', padding: '6px 8px', background: '#FEF3C7',
                borderRadius: '3px', fontFamily: 'var(--fn)', fontSize: '12px',
              }}>
                B2BROUTER_API_KEY = test_… (sandbox) of prod_… (productie)
              </div>
              <div style={{ marginTop: '6px' }}>
                Keys vind je in <a href="https://app.b2brouter.net" target="_blank" rel="noopener" style={{ color: '#C2410C' }}>B2Brouter</a> onder Developers → API Keys.
              </div>
            </div>
          )}

          {sendStatus === 'error' && (
            <div style={{
              marginTop: '10px', padding: '8px 12px', background: '#FEF2F2',
              borderRadius: '4px', fontSize: '13px', color: '#991B1B',
            }}>
              ✗ {sendResult?.error || 'Verzending mislukt.'}
            </div>
          )}
        </div>
      )}

      {lookupStatus === 'notfound' && (
        <div>
          <div style={{ fontSize: '14px', color: '#C2410C', fontWeight: 600, marginBottom: '4px' }}>
            ○ Niet gevonden op Peppol
          </div>
          <div style={{ fontSize: '12px', color: '#7C2D12', lineHeight: 1.5 }}>
            {recipientName || 'De opdrachtgever'} (KvK: {recipientKvk}) is niet geregistreerd op het Peppol netwerk. Gebruik de PDF- of XML-export om de factuur handmatig te verzenden.
          </div>
          <button
            onClick={() => { setLookupStatus('idle'); setLookupData(null); }}
            style={{
              marginTop: '8px', background: 'transparent', color: '#C2410C',
              border: '1px solid #FDBA74', borderRadius: '4px', padding: '5px 12px',
              fontSize: '12px', fontFamily: 'var(--fn)', cursor: 'pointer',
            }}
          >
            Opnieuw controleren
          </button>
        </div>
      )}

      {lookupStatus === 'error' && (
        <div>
          <div style={{ fontSize: '13px', color: '#DC2626', marginBottom: '4px' }}>
            {lookupData?.error || lookupData?.message || 'Fout bij Peppol lookup.'}
          </div>
          <button
            onClick={() => { setLookupStatus('idle'); setLookupData(null); }}
            style={{
              marginTop: '6px', background: 'transparent', color: '#DC2626',
              border: '1px solid #FECACA', borderRadius: '4px', padding: '5px 12px',
              fontSize: '12px', fontFamily: 'var(--fn)', cursor: 'pointer',
            }}
          >
            Opnieuw proberen
          </button>
        </div>
      )}
    </div>
  );
}
