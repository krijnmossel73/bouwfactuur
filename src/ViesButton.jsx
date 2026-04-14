import { useState } from 'react';
import { validateVIES, validateFormat } from './vies.js';

/**
 * Inline VIES validation button shown next to a BTW input field.
 * Shows a small status indicator and can auto-fill company name/address.
 */
export default function ViesButton({ btwValue, onResult }) {
  const [status, setStatus] = useState('idle'); // idle | loading | valid | invalid | error
  const [detail, setDetail] = useState(null);

  const check = async () => {
    if (!btwValue || btwValue.length < 4) {
      setStatus('error');
      setDetail('Voer een BTW-nummer in');
      return;
    }

    // Quick format check
    const fmt = validateFormat(btwValue);
    if (!fmt.valid) {
      setStatus('invalid');
      setDetail(fmt.message);
      return;
    }

    setStatus('loading');
    setDetail(null);

    const result = await validateVIES(btwValue);

    if (result.valid === true) {
      setStatus('valid');
      setDetail(result.name
        ? `✓ ${result.name}${result.address ? ` — ${result.address}` : ''}`
        : (result.formatOnly ? result.message : '✓ Geldig in VIES')
      );
      if (onResult) onResult(result);
    } else if (result.valid === false) {
      setStatus('invalid');
      setDetail(result.error || 'Ongeldig BTW-nummer');
    } else {
      setStatus('error');
      setDetail(result.error || 'Kon niet verifiëren');
    }
  };

  const colors = {
    idle: { bg: 'var(--bd)', color: 'var(--tm)' },
    loading: { bg: 'var(--bd)', color: 'var(--ac)' },
    valid: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
    invalid: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
    error: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  };

  const c = colors[status];

  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={check}
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
          {status === 'loading' ? '⟳ Controleren...' : 'VIES Check'}
        </button>
        {status !== 'idle' && status !== 'loading' && (
          <span style={{
            fontSize: '10px',
            color: c.color,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}>
            {status === 'valid' ? '●' : status === 'invalid' ? '●' : '●'}
          </span>
        )}
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
