import { useState } from 'react';
import { supabase } from './supabase.js';
import { inp, lbl, btn1, btn2 } from './styles.js';

/**
 * Authentication modal: email/password login, registration,
 * Google OAuth, and password reset — all via Supabase Auth.
 *
 * Modes: 'login' | 'register' | 'forgot' | 'newPassword'
 * (newPassword is shown after a password-recovery redirect)
 */
export default function AuthModal({ mode: initialMode = 'login', onClose, onDone }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'error'|'ok', text }

  const fail = (text) => setMsg({ type: 'error', text });
  const ok = (text) => setMsg({ type: 'ok', text });

  const translate = (m) => {
    const t = String(m || '');
    if (/invalid login credentials/i.test(t)) return 'Onjuist e-mailadres of wachtwoord.';
    if (/email not confirmed/i.test(t)) return 'Bevestig eerst uw e-mailadres via de link in uw mailbox.';
    if (/already registered/i.test(t)) return 'Dit e-mailadres is al geregistreerd. Probeer in te loggen.';
    if (/password should be at least/i.test(t)) return 'Wachtwoord moet minimaal 6 tekens zijn.';
    if (/rate limit/i.test(t)) return 'Te veel pogingen. Probeer het later opnieuw.';
    return t || 'Er ging iets mis. Probeer het opnieuw.';
  };

  const submit = async () => {
    if (busy || !supabase) return;
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return fail(translate(error.message));
        onDone?.();
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return fail(translate(error.message));
        if (data.user && !data.session) {
          ok('Account aangemaakt. Bevestig uw e-mailadres via de link in uw mailbox, en log daarna in.');
          setMode('login');
        } else {
          onDone?.();
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) return fail(translate(error.message));
        ok('Als dit e-mailadres bekend is, ontvangt u een herstellink per e-mail.');
      } else if (mode === 'newPassword') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return fail(translate(error.message));
        ok('Wachtwoord bijgewerkt.');
        onDone?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy || !supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { fail(translate(error.message)); setBusy(false); }
    // On success the browser redirects to Google.
  };

  const titles = {
    login: 'Inloggen',
    register: 'Account aanmaken',
    forgot: 'Wachtwoord vergeten',
    newPassword: 'Nieuw wachtwoord instellen',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onClick={(e) => { if (e.target === e.currentTarget && mode !== 'newPassword') onClose?.(); }}
    >
      <div style={{ background: 'var(--bg)', border: '1px solid var(--bd)', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '360px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{titles[mode]}</span>
          {mode !== 'newPassword' && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tm)', fontSize: '16px', lineHeight: 1 }} title="Sluiten">×</button>
          )}
        </div>

        {msg && (
          <div style={{
            padding: '8px 12px', borderRadius: '5px', fontSize: '11px', marginBottom: '12px', lineHeight: 1.5,
            background: msg.type === 'error' ? 'rgba(220,38,38,.08)' : 'rgba(22,163,74,.08)',
            border: `1px solid ${msg.type === 'error' ? 'rgba(220,38,38,.3)' : 'rgba(22,163,74,.3)'}`,
            color: msg.type === 'error' ? 'var(--dn)' : 'var(--ok)',
          }}>
            {msg.text}
          </div>
        )}

        {mode !== 'newPassword' && (
          <div style={{ marginBottom: '10px' }}>
            <span style={lbl}>E-mailadres</span>
            <input
              type="email" style={inp} value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        )}

        {mode !== 'forgot' && (
          <div style={{ marginBottom: '14px' }}>
            <span style={lbl}>{mode === 'newPassword' ? 'Nieuw wachtwoord' : 'Wachtwoord'}</span>
            <input
              type="password" style={inp} value={password}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        )}

        <button onClick={submit} disabled={busy} style={{ ...btn1, width: '100%', opacity: busy ? 0.6 : 1, marginBottom: '10px' }}>
          {busy ? 'Bezig…' : titles[mode]}
        </button>

        {(mode === 'login' || mode === 'register') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--bd)' }} />
              <span style={{ fontSize: '9px', color: 'var(--tm)', letterSpacing: '.08em' }}>OF</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--bd)' }} />
            </div>
            <button onClick={google} disabled={busy} style={{ ...btn2, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: busy ? 0.6 : 1 }}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              Doorgaan met Google
            </button>
          </>
        )}

        <div style={{ marginTop: '14px', fontSize: '10px', color: 'var(--tm)', display: 'flex', justifyContent: 'space-between' }}>
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('register'); setMsg(null); }} style={linkBtn}>Account aanmaken</button>
              <button onClick={() => { setMode('forgot'); setMsg(null); }} style={linkBtn}>Wachtwoord vergeten?</button>
            </>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <button onClick={() => { setMode('login'); setMsg(null); }} style={linkBtn}>← Terug naar inloggen</button>
          )}
        </div>
      </div>
    </div>
  );
}

const linkBtn = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
  fontSize: '10px', color: 'var(--ac)', textDecoration: 'underline',
};
