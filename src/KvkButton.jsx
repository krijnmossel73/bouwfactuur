import { useState } from 'react';
import { searchKvK, extractCompanyData, validateKvkFormat } from './kvk.js';

/**
 * Inline KvK lookup button shown next to a KvK-nummer input field.
 * Validates the number, queries the KvK API, and auto-fills company fields.
 */
export default function KvkButton({ kvkValue, onResult }) {
  const [status, setStatus] = useState('idle'); // idle | loading | found | notfound | error
  const [detail, setDetail] = useState(null);

  const lookup = async () => {
    if (!kvkValue || kvkValue.trim().length === 0) {
      setStatus('error');
      setDetail('Voer een KvK-nummer in');
      return;
    }

    const fmt = validateKvkFormat(kvkValue);
    if (!fmt.valid) {
      setStatus('error');
      setDetail(fmt.message);
      return;
    }

    setStatus('loading');
    setDetail(null);

    const result = await searchKvK({ kvkNummer: fmt.cleaned });

    if (result.devMode) {
      setStatus('error');
      setDetail(result.message);
      return;
    }

    if (result.error) {
      setStatus('error');
      setDetail(result.error);
      return;
    }

    if (result.results.length === 0) {
      setStatus('notfound');
      setDetail('Geen bedrijf gevonden met dit KvK-nummer.');
      return;
    }

    // Take the first result (prefer hoofdvestiging)
    const main = result.results.find(r => r.type === 'hoofdvestiging') || result.results[0];
    const company = extractCompanyData(main);

    setStatus('found');
    setDetail(`✓ ${company.naam}${company.plaats ? ` — ${company.plaats}` : ''}`);

    if (onResult) onResult(company);
  };

  const colors = {
    idle: { bg: 'var(--bd)', color: 'var(--tm)' },
    loading: { bg: 'var(--bd)', color: 'var(--ac)' },
    found: { bg: 'rgba(74,222,128,0.12)', color: 'var(--ok)' },
    notfound: { bg: 'rgba(248,113,113,0.12)', color: 'var(--dn)' },
    error: { bg: 'rgba(251,191,36,0.12)', color: 'var(--ac)' },
  };

  const c = colors[status];

  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={lookup}
          disabled={status === 'loading'}
          style={{
            background: c.bg,
            color: c.color,
            border: `1px solid ${c.color}40`,
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 600,
            fontFamily: 'var(--fn)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? '⟳ Zoeken...' : 'KvK Opzoeken'}
        </button>
      </div>
      {detail && (
        <div style={{
          fontSize: '10px',
          color: c.color,
          marginTop: '3px',
          lineHeight: 1.4,
          padding: '4px 8px',
          background: c.bg,
          borderRadius: '4px',
          maxWidth: '100%',
          wordBreak: 'break-word',
        }}>
          {detail}
        </div>
      )}
    </div>
  );
}
