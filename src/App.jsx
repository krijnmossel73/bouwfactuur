import { useState, useEffect } from 'react';
import { storageSet, setAuthTokenProvider, loadAll, KEYS } from './storage.js';
import { supabase } from './supabase.js';
import AuthModal from './AuthModal.jsx';
import LandingPage from './LandingPage.jsx';
import Uitleg from './Uitleg.jsx';
import PaywallModal from './PaywallModal.jsx';
import { getAccount, openPortal } from './billing.js';
import { TRADE_PERCENTAGES, BLANK_OA, BLANK_OG, BLANK_PROJECT, BLANK_LINE } from './constants.js';
import { fmt, fmtDate, calcVerval, makeInvoiceNumber, calcTotals } from './utils.js';
import { PlusIcon, TrashIcon, FileIcon, EyeIcon, BldgIcon, SaveIcon, DownIcon, ListIcon, LogoIcon } from './Icons.jsx';
import { inp, sel, lbl, btn1, btn2, sec, g2, full, crd, chk, nfo, sinp } from './styles.js';
import InvoicePDF from './InvoicePDF.jsx';
import InvoiceHistory from './InvoiceHistory.jsx';
import ViesButton from './ViesButton.jsx';
import KvkButton from './KvkButton.jsx';
import { generateInvoiceXML, downloadXML } from './invoiceXml.js';
import PeppolPanel from './PeppolPanel.jsx';
import { features } from './config.js';
import { checkInvoice } from './validation.js';

const STEPS = ['Profiel', 'Klant', 'Regels', 'Factuur'];

export default function App() {
  // ── Core state ──
  const [view, setView] = useState('editor'); // editor | history | pdf
  const [step, setStep] = useState(0);
  const [oa, setOa] = useState({ ...BLANK_OA });
  const [og, setOg] = useState({ ...BLANK_OG });
  const [project, setProject] = useState({ ...BLANK_PROJECT });
  const [lines, setLines] = useState([{ ...BLANK_LINE }]);
  const [btwVerlegd, setBtwVerlegd] = useState(true);
  const [btwTarief, setBtwTarief] = useState(21);
  const [useGrek, setUseGrek] = useState(true);
  const [customGPerc, setCustomGPerc] = useState(null);

  // ── Persisted collections ──
  const [savedClients, setSavedClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [nextNum, setNextNum] = useState(1);

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [profLoaded, setProfLoaded] = useState(false);
  const [user, setUser] = useState(null); // { email, id } or null
  const [loadError, setLoadError] = useState(false);
  const [route, setRoute] = useState(window.location.hash); // '' | '#/uitleg'
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'register' | 'newPassword'
  const [account, setAccount] = useState(null); // /api/account payload or null
  const [paywall, setPaywall] = useState(false);

  const gPerc = customGPerc !== null ? customGPerc : (TRADE_PERCENTAGES[oa.trade] || 40);
  const totals = calcTotals(lines, btwVerlegd, useGrek, gPerc, btwTarief);
  const verval = calcVerval(project.factuurdatum, project.betaaltermijn);
  const compliance = checkInvoice({ oa, og, project, lines, btwVerlegd, useGrek });

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // ── Auth + data loading (account required; all data in cloud storage) ──
  const resetData = () => {
    setOa({ ...BLANK_OA }); setProfLoaded(false);
    setOg({ ...BLANK_OG }); setProject({ ...BLANK_PROJECT });
    setLines([{ ...BLANK_LINE }]);
    setSavedClients([]); setInvoices([]); setNextNum(1);
    setView('editor'); setStep(0);
  };

  const applySession = async (session) => {
    const sUser = session?.user || null;
    setLoadError(false);

    if (!sUser) {
      setUser(null);
      setAuthTokenProvider(null);
      setAccount(null);
      setPaywall(false);
      resetData();
      return;
    }

    setUser({ email: sUser.email, id: sUser.id });
    setAuthTokenProvider(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || null;
    });

    try {
      const res = await loadAll(sUser.id);
      if (res.profile) { setOa(res.profile); setProfLoaded(true); }
      setSavedClients(res.clients);
      setInvoices(res.invoices);
      setNextNum(res.nextNum);
      if (res.migrated) flash('Gegevens gemigreerd naar uw account');
      setAccount(await getAccount());
    } catch {
      setLoadError(true);
    }
  };

  const refreshAccount = async () => setAccount(await getAccount());

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);

    // Back from Stripe Checkout?
    const qp = new URLSearchParams(window.location.search);
    const checkout = qp.get('checkout');
    if (checkout) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      if (checkout === 'success') {
        flash('Bedankt! Uw abonnement wordt geactiveerd.');
        // Webhook may lag a few seconds; refresh entitlement shortly after.
        setTimeout(() => { getAccount().then(setAccount); }, 4000);
      }
    }

    let sub = null;
    (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        await applySession(data.session);
        ({ data: { subscription: sub } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
            applySession(session);
            if (event === 'SIGNED_IN') setAuthModal(null);
          } else if (event === 'PASSWORD_RECOVERY') {
            setAuthModal('newPassword');
          }
        }));
      }
      setLoading(false);
    })();
    return () => { sub?.unsubscribe(); window.removeEventListener('hashchange', onHash); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    // applySession(null) follows via onAuthStateChange (SIGNED_OUT)
  };

  /**
   * Persist a value to cloud storage with visible failure handling.
   * Returns true on success; on failure flashes an error and returns false
   * so callers can avoid advancing dependent state (e.g. invoice numbers).
   */
  const persist = async (key, value) => {
    try {
      await storageSet(key, value);
      return true;
    } catch (err) {
      if (err?.status === 402) {
        refreshAccount();
        setPaywall(true);
      } else {
        flash('Opslaan mislukt — controleer uw internetverbinding');
      }
      return false;
    }
  };

  // ── Auto-generate first invoice number ──
  useEffect(() => {
    if (!loading && !project.factuurnummer) {
      setProject((p) => ({ ...p, factuurnummer: makeInvoiceNumber(nextNum) }));
    }
  }, [loading]);

  // ═══════════════════════════════════════════
  //  ACTIONS
  // ═══════════════════════════════════════════
  const saveProfile = async () => {
    if (!(await persist(KEYS.profile, oa))) return;
    setProfLoaded(true);
    flash('Profiel opgeslagen');
  };

  const saveClient = async () => {
    if (!og.naam) return;
    const idx = savedClients.findIndex((c) => c.naam === og.naam);
    const next = [...savedClients];
    if (idx >= 0) next[idx] = { ...og }; else next.push({ ...og });
    setSavedClients(next);
    if (!(await persist(KEYS.clients, next))) return;
    flash(`Klant "${og.naam}" opgeslagen`);
  };

  const loadClient = (c) => { setOg({ ...c }); flash(`"${c.naam}" geladen`); };

  const atFreeLimit =
    account?.billingEnabled &&
    account?.plan === 'free' &&
    (account?.invoicesCreated ?? 0) >= (account?.freeLimit ?? 2);

  const saveInvoice = async () => {
    if (atFreeLimit) { setPaywall(true); return; }
    const inv = {
      id: Date.now().toString(),
      date: project.factuurdatum,
      nummer: project.factuurnummer,
      status: 'open',
      oa: { ...oa }, og: { ...og }, project: { ...project },
      lines: [...lines], btwVerlegd, btwTarief, useGrek, gPerc,
      totals: { ...totals },
    };
    const next = [inv, ...invoices];
    if (!(await persist(KEYS.invoices, next))) return;
    setInvoices(next);
    const nn = nextNum + 1;
    setNextNum(nn);
    await persist(KEYS.nextNum, nn);
    flash(`Factuur ${inv.nummer} opgeslagen`);
    refreshAccount();
  };

  const loadInvoice = (inv) => {
    setOa(inv.oa); setOg(inv.og); setProject(inv.project); setLines(inv.lines);
    setBtwVerlegd(inv.btwVerlegd); setBtwTarief(inv.btwTarief ?? 21);
    setUseGrek(inv.useGrek); setCustomGPerc(inv.gPerc);
    setView('editor'); setStep(3);
    flash(`Factuur ${inv.nummer} geladen`);
  };

  const dupInvoice = (inv) => {
    setOa(inv.oa); setOg(inv.og);
    setProject({
      ...inv.project,
      factuurnummer: makeInvoiceNumber(nextNum),
      factuurdatum: new Date().toISOString().split('T')[0],
    });
    setLines(inv.lines); setBtwVerlegd(inv.btwVerlegd); setBtwTarief(inv.btwTarief ?? 21);
    setUseGrek(inv.useGrek); setCustomGPerc(inv.gPerc);
    setView('editor'); setStep(2);
    flash('Gedupliceerd — pas aan');
  };

  const delInvoice = async (id) => {
    const inv = invoices.find((i) => i.id === id);
    if (!window.confirm(`Factuur ${inv?.nummer || ''} definitief verwijderen?`)) return;
    const next = invoices.filter((i) => i.id !== id);
    if (!(await persist(KEYS.invoices, next))) return;
    setInvoices(next);
    flash('Verwijderd');
  };

  const toggleInvoiceStatus = async (id) => {
    const next = invoices.map((i) =>
      i.id === id ? { ...i, status: (i.status ?? 'open') === 'open' ? 'betaald' : 'open' } : i
    );
    if (!(await persist(KEYS.invoices, next))) return;
    setInvoices(next);
  };

  // ── Backup / restore (localStorage is fragile — give users an escape hatch) ──
  const exportBackup = () => {
    const data = {
      app: 'bouwfactuur', version: 1, exportedAt: new Date().toISOString(),
      profile: profLoaded ? oa : null, clients: savedClients, invoices, nextNum,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bouwfactuur-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash('Backup gedownload');
  };

  const importBackup = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'bouwfactuur') throw new Error('not a bouwfactuur backup');
      if (!window.confirm('Backup terugzetten? Huidige gegevens worden overschreven.')) return;
      const cls = Array.isArray(data.clients) ? data.clients : [];
      const invs = Array.isArray(data.invoices) ? data.invoices : [];
      const nn = Number.isInteger(data.nextNum) ? data.nextNum : 1;
      await Promise.all([
        data.profile ? storageSet(KEYS.profile, data.profile) : null,
        storageSet(KEYS.clients, cls),
        storageSet(KEYS.invoices, invs),
        storageSet(KEYS.nextNum, nn),
      ].filter(Boolean));
      if (data.profile) { setOa(data.profile); setProfLoaded(true); }
      setSavedClients(cls);
      setInvoices(invs);
      setNextNum(nn);
      flash('Backup teruggezet');
    } catch (err) {
      if (err?.status === 402) { refreshAccount(); setPaywall(true); }
      else flash(String(err).includes('storage') ? 'Opslaan mislukt — controleer uw internetverbinding' : 'Ongeldig backupbestand');
    }
  };

  const newInvoice = () => {
    setOg({ ...BLANK_OG });
    setProject({
      ...BLANK_PROJECT,
      factuurnummer: makeInvoiceNumber(nextNum),
      factuurdatum: new Date().toISOString().split('T')[0],
    });
    setLines([{ ...BLANK_LINE }]);
    setBtwVerlegd(true); setBtwTarief(21); setUseGrek(true); setCustomGPerc(null);
    setStep(profLoaded ? 1 : 0);
    setView('editor');
  };

  // ── Line item helpers ──
  const updateLine = (i, f, v) => {
    const n = [...lines]; n[i] = { ...n[i], [f]: v };
    if (f === 'uren' || f === 'tarief') {
      const u = parseFloat(f === 'uren' ? v : n[i].uren) || 0;
      const t = parseFloat(f === 'tarief' ? v : n[i].tarief) || 0;
      n[i].bedrag = u && t ? (u * t).toFixed(2) : n[i].bedrag;
    }
    setLines(n);
  };
  const addLine = () => setLines([...lines, { ...BLANK_LINE }]);
  const removeLine = (i) => lines.length > 1 && setLines(lines.filter((_, j) => j !== i));

  const exportPDF = () => { setView('pdf'); setTimeout(() => window.print(), 400); };

  // ═══════════════════════════════════════════
  //  ROUTE: PDF
  // ═══════════════════════════════════════════
  // ── Public routes & auth gate ──
  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tm)' }}>Laden...</div>;
  }

  if (route === '#/uitleg') {
    return (
      <>
        {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onDone={() => setAuthModal(null)} />}
        <Uitleg
          loggedIn={!!user}
          onBack={() => { window.location.hash = ''; }}
          onRegister={() => setAuthModal('register')}
        />
      </>
    );
  }

  if (!user) {
    return (
      <>
        {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onDone={() => setAuthModal(null)} />}
        <LandingPage
          onLogin={() => setAuthModal('login')}
          onRegister={() => setAuthModal('register')}
        />
      </>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>Gegevens konden niet worden geladen</div>
        <div style={{ fontSize: '11px', color: 'var(--tm)', maxWidth: '320px', lineHeight: 1.6 }}>
          Er is een probleem met de verbinding naar de cloudopslag. Controleer uw internetverbinding en probeer het opnieuw.
        </div>
        <button
          style={{ ...btn1, padding: '9px 20px' }}
          onClick={async () => {
            const { data } = await supabase.auth.getSession();
            applySession(data.session);
          }}
        >
          Opnieuw proberen
        </button>
        <button style={{ ...btn2, padding: '7px 16px', fontSize: '10px' }} onClick={logout}>Uitloggen</button>
      </div>
    );
  }

  if (view === 'pdf') {
    return (
      <InvoicePDF
        oa={oa} og={og} project={project} lines={lines}
        totals={totals} btwVerlegd={btwVerlegd} btwTarief={btwTarief} useGrek={useGrek}
        gPerc={gPerc} onBack={() => setView('editor')}
      />
    );
  }

  // ═══════════════════════════════════════════
  //  ROUTE: HISTORY
  // ═══════════════════════════════════════════
  if (view === 'history') {
    return (
      <InvoiceHistory
        invoices={invoices}
        onBack={() => setView('editor')}
        onNew={newInvoice}
        onLoad={loadInvoice}
        onDuplicate={dupInvoice}
        onDelete={delInvoice}
        onToggleStatus={toggleInvoiceStatus}
        onExportBackup={exportBackup}
        onImportBackup={importBackup}
        account={account}
        onUpgrade={() => { setView('editor'); setPaywall(true); }}
        onManageSubscription={async () => {
          try { await openPortal(); } catch { flash('Kon het accountportaal niet openen'); }
        }}
      />
    );
  }

  // ═══════════════════════════════════════════
  //  ROUTE: EDITOR
  // ═══════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Paywall ── */}
      {paywall && <PaywallModal account={account} onClose={() => setPaywall(false)} />}

      {/* ── Auth modal ── */}
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onDone={() => setAuthModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ac)', color: '#FFFFFF', padding: '10px 18px', borderRadius: '6px',
          fontSize: '11px', fontWeight: 700, zIndex: 999, letterSpacing: '.04em',
          boxShadow: '0 4px 12px rgba(217,119,6,.2)', animation: 'fadeIn .2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--sf) 0%, var(--bg) 100%)',
        borderBottom: '1px solid var(--bd)', padding: '14px 20px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', background: 'var(--ac)', borderRadius: '5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LogoIcon />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '.05em', color: 'var(--ac)' }}>
              BOUWFACTUUR
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--abg)', borderRadius: '4px', border: '1px solid var(--bd)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tm)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <span style={{ fontSize: '10px', color: 'var(--tm)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
                {account?.plan === 'pro' && (
                  <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '.08em', padding: '2px 6px', borderRadius: '8px', background: 'rgba(22,163,74,.12)', color: 'var(--ok)', border: '1px solid rgba(22,163,74,.4)' }}>PRO</span>
                )}
                <span
                  title="Cloudopslag — uw gegevens zijn beschikbaar op al uw apparaten"
                  style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.05em', color: 'var(--ok)' }}
                >
                  ☁
                </span>
                <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--dn)', marginLeft: '2px', padding: 0 }} title="Uitloggen">✕</button>
              </div>
            )}
            <button onClick={() => setView('history')} style={{ ...btn2, padding: '6px 10px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ListIcon /> {invoices.length}
            </button>
          </div>
        </div>

        {/* Free plan usage */}
        {account?.billingEnabled && account?.plan === 'free' && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
            padding: '7px 12px', marginBottom: '10px', borderRadius: '6px', fontSize: '10px',
            background: atFreeLimit ? 'rgba(220,38,38,.07)' : 'var(--abg)',
            border: `1px solid ${atFreeLimit ? 'rgba(220,38,38,.3)' : 'var(--bd)'}`,
            color: atFreeLimit ? 'var(--dn)' : 'var(--tm)',
          }}>
            <span>
              {atFreeLimit
                ? 'Uw gratis facturen zijn gebruikt — upgrade om verder te factureren.'
                : `Gratis plan: nog ${Math.max(0, (account.freeLimit ?? 2) - (account.invoicesCreated ?? 0))} van ${account.freeLimit ?? 2} facturen.`}
            </span>
            <button onClick={() => setPaywall(true)} style={{ ...btn1, padding: '4px 10px', fontSize: '9px', flexShrink: 0 }}>
              Upgrade
            </button>
          </div>
        )}

        {/* Step progress */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i === step ? 'var(--ac)' : i < step ? 'var(--acd)' : 'var(--bd)',
              transition: 'all .3s',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          {STEPS.map((s, i) => (
            <span key={i} onClick={() => setStep(i)} style={{
              fontSize: '9px', letterSpacing: '.08em', textTransform: 'uppercase',
              color: i === step ? 'var(--ac)' : 'var(--tm)',
              fontWeight: i === step ? 600 : 400, cursor: 'pointer',
            }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div style={{ padding: '18px' }}>

        {/* ═══ STEP 0: Profile ═══ */}
        {step === 0 && (
          <div>
            <div style={sec}><BldgIcon /> Uw bedrijfsgegevens</div>
            {profLoaded && <div style={{ ...nfo, marginBottom: '12px' }}>Profiel geladen uit opslag.</div>}
            <div style={g2}>
              <div style={full}><span style={lbl}>Bedrijfsnaam</span><input style={inp} value={oa.naam} onChange={(e) => setOa({ ...oa, naam: e.target.value })} placeholder="Bouwbedrijf Jansen B.V." /></div>
              <div style={full}><span style={lbl}>Adres</span><input style={inp} value={oa.adres} onChange={(e) => setOa({ ...oa, adres: e.target.value })} placeholder="Bouwstraat 12" /></div>
              <div><span style={lbl}>Postcode</span><input style={inp} value={oa.postcode} onChange={(e) => setOa({ ...oa, postcode: e.target.value })} placeholder="1234 AB" /></div>
              <div><span style={lbl}>Plaats</span><input style={inp} value={oa.plaats} onChange={(e) => setOa({ ...oa, plaats: e.target.value })} placeholder="Purmerend" /></div>
              <div><span style={lbl}>KvK-nummer</span><input style={inp} value={oa.kvk} onChange={(e) => setOa({ ...oa, kvk: e.target.value })} placeholder="12345678" /><KvkButton kvkValue={oa.kvk} onResult={(c) => {
                if (c.naam && !oa.naam) setOa((p) => ({ ...p, naam: c.naam }));
                if (c.adres && !oa.adres) setOa((p) => ({ ...p, adres: c.adres }));
                if (c.postcode && !oa.postcode) setOa((p) => ({ ...p, postcode: c.postcode }));
                if (c.plaats && !oa.plaats) setOa((p) => ({ ...p, plaats: c.plaats }));
              }} /></div>
              <div><span style={lbl}>BTW-nummer</span><input style={inp} value={oa.btw} onChange={(e) => setOa({ ...oa, btw: e.target.value })} placeholder="NL123456789B01" /><ViesButton btwValue={oa.btw} /></div>
              <div><span style={lbl}>IBAN (normaal)</span><input style={inp} value={oa.iban} onChange={(e) => setOa({ ...oa, iban: e.target.value })} placeholder="NL91ABNA0417164300" /></div>
              <div><span style={lbl}>G-rekening IBAN</span><input style={inp} value={oa.gRekening} onChange={(e) => setOa({ ...oa, gRekening: e.target.value })} placeholder="NL91ABNA0990000000" /></div>
              <div style={full}>
                <span style={lbl}>Vakgebied</span>
                <select style={sel} value={oa.trade} onChange={(e) => { setOa({ ...oa, trade: e.target.value }); setCustomGPerc(null); }}>
                  {Object.entries(TRADE_PERCENTAGES).map(([t, p]) => <option key={t} value={t}>{t} ({p}%)</option>)}
                </select>
              </div>
            </div>
            <button onClick={saveProfile} style={{ ...btn1, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center' }}>
              <SaveIcon /> Profiel opslaan
            </button>
          </div>
        )}

        {/* ═══ STEP 1: Client ═══ */}
        {step === 1 && (
          <div>
            <div style={sec}><BldgIcon /> Opdrachtgever</div>
            {savedClients.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <span style={lbl}>Opgeslagen klanten — klik om te laden</span>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                  {savedClients.map((c, i) => (
                    <button key={i} onClick={() => loadClient(c)} style={{ ...btn2, padding: '5px 10px', fontSize: '10px' }}>{c.naam}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={g2}>
              <div style={full}><span style={lbl}>Bedrijfsnaam</span><input style={inp} value={og.naam} onChange={(e) => setOg({ ...og, naam: e.target.value })} placeholder="Hoofdaannemer De Vries B.V." /></div>
              <div style={full}><span style={lbl}>Adres</span><input style={inp} value={og.adres} onChange={(e) => setOg({ ...og, adres: e.target.value })} placeholder="Industrieweg 45" /></div>
              <div><span style={lbl}>Postcode</span><input style={inp} value={og.postcode} onChange={(e) => setOg({ ...og, postcode: e.target.value })} placeholder="5678 CD" /></div>
              <div><span style={lbl}>Plaats</span><input style={inp} value={og.plaats} onChange={(e) => setOg({ ...og, plaats: e.target.value })} placeholder="Rotterdam" /></div>
              <div><span style={lbl}>KvK-nummer</span><input style={inp} value={og.kvk} onChange={(e) => setOg({ ...og, kvk: e.target.value })} placeholder="87654321" /><KvkButton kvkValue={og.kvk} onResult={(c) => {
                if (c.naam && !og.naam) setOg((p) => ({ ...p, naam: c.naam }));
                if (c.adres && !og.adres) setOg((p) => ({ ...p, adres: c.adres }));
                if (c.postcode && !og.postcode) setOg((p) => ({ ...p, postcode: c.postcode }));
                if (c.plaats && !og.plaats) setOg((p) => ({ ...p, plaats: c.plaats }));
              }} /></div>
              <div><span style={lbl}>BTW-nummer</span><input style={inp} value={og.btw} onChange={(e) => setOg({ ...og, btw: e.target.value })} placeholder="NL987654321B01" /><ViesButton btwValue={og.btw} onResult={(r) => {
                if (r.name && !og.naam) setOg((prev) => ({ ...prev, naam: r.name }));
                if (r.address && !og.adres) {
                  // VIES returns address as single string — try to split
                  const parts = r.address.split('\n').filter(Boolean);
                  if (parts.length >= 2) {
                    setOg((prev) => ({ ...prev, adres: parts[0], plaats: parts[parts.length - 1] }));
                  } else if (parts.length === 1) {
                    setOg((prev) => ({ ...prev, adres: parts[0] }));
                  }
                }
              }} /></div>
            </div>
            <button onClick={saveClient} style={{ ...btn2, marginTop: '10px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <SaveIcon /> Klant opslaan
            </button>
            <div style={{ marginTop: '16px' }}>
              <label style={chk} onClick={() => setBtwVerlegd(!btwVerlegd)}>
                <input type="checkbox" checked={btwVerlegd} readOnly />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>BTW verlegd (verleggingsregeling bouw)</span>
              </label>
              {btwVerlegd && <div style={nfo}>BTW verlegd naar opdrachtgever conform art. 12 lid 5 Wet OB 1968.</div>}
              {!btwVerlegd && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ ...lbl, whiteSpace: 'nowrap', marginBottom: 0 }}>BTW-tarief</span>
                  <select style={{ ...sel, width: '180px' }} value={btwTarief} onChange={(e) => setBtwTarief(parseInt(e.target.value))}>
                    <option value={21}>21% — algemeen</option>
                    <option value={9}>9% — renovatie woning &gt; 2 jr (arbeid)</option>
                    <option value={0}>0% — vrijgesteld / export</option>
                  </select>
                </div>
              )}
              <label style={{ ...chk, marginTop: '10px' }} onClick={() => setUseGrek(!useGrek)}>
                <input type="checkbox" checked={useGrek} readOnly />
                <span style={{ fontSize: '12px', fontWeight: 500 }}>G-rekening splitsing</span>
              </label>
              {useGrek && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <span style={{ ...lbl, whiteSpace: 'nowrap', marginBottom: 0 }}>G-rek %</span>
                  <input type="number" style={{ ...inp, width: '80px' }} value={gPerc}
                    onChange={(e) => setCustomGPerc(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} />
                  <span style={{ fontSize: '10px', color: 'var(--tm)' }}>over loonkosten</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Lines ═══ */}
        {step === 2 && (
          <div>
            <div style={sec}><FileIcon /> Project & Factuurregels</div>
            <div style={g2}>
              <div><span style={lbl}>Factuurnummer</span><input style={inp} value={project.factuurnummer} onChange={(e) => setProject({ ...project, factuurnummer: e.target.value })} /></div>
              <div><span style={lbl}>Factuurdatum</span><input type="date" style={inp} value={project.factuurdatum} onChange={(e) => setProject({ ...project, factuurdatum: e.target.value })} /></div>
              <div><span style={lbl}>Contractnummer</span><input style={inp} value={project.contractNummer} onChange={(e) => setProject({ ...project, contractNummer: e.target.value })} placeholder="CTR-2026-001" /></div>
              <div><span style={lbl}>Betaaltermijn (dgn)</span><input type="number" style={inp} value={project.betaaltermijn} onChange={(e) => setProject({ ...project, betaaltermijn: parseInt(e.target.value) || 30 })} />
                {verval && <span style={{ fontSize: '10px', color: 'var(--tm)', marginTop: '3px', display: 'block' }}>Vervaldatum: {fmtDate(verval)}</span>}
              </div>
              <div style={full}><span style={lbl}>Projectnaam</span><input style={inp} value={project.projectNaam} onChange={(e) => setProject({ ...project, projectNaam: e.target.value })} placeholder="Nieuwbouw appartementen Zuidas Blok C" /></div>
            </div>

            {/* Line items */}
            <div style={{ marginTop: '18px' }}>
              <div style={{ ...sec, fontSize: '11px' }}>Regels</div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 78px 66px 66px 86px 30px', gap: '5px', padding: '5px 0', borderBottom: '1px solid var(--bd)', marginBottom: '5px', minWidth: '480px' }}>
                  <span style={lbl}>Omschrijving</span><span style={lbl}>Type</span><span style={lbl}>Uren</span><span style={lbl}>Tarief</span><span style={lbl}>Bedrag</span><span />
                </div>
                {lines.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 78px 66px 66px 86px 30px', gap: '5px', alignItems: 'center', marginBottom: '4px', minWidth: '480px' }}>
                    <input style={sinp} value={l.omschrijving} onChange={(e) => updateLine(i, 'omschrijving', e.target.value)} placeholder="Metselwerk verd. 3" />
                    <select style={{ ...sel, padding: '8px 5px', fontSize: '10px', paddingRight: '20px', backgroundPosition: 'right 4px center' }} value={l.type} onChange={(e) => updateLine(i, 'type', e.target.value)}>
                      <option value="arbeid">Arbeid</option><option value="materiaal">Mat.</option>
                    </select>
                    <input type="number" style={sinp} value={l.uren} onChange={(e) => updateLine(i, 'uren', e.target.value)} placeholder="0" />
                    <input type="number" style={sinp} value={l.tarief} onChange={(e) => updateLine(i, 'tarief', e.target.value)} placeholder="0.00" />
                    <input type="number" style={sinp} value={l.bedrag} onChange={(e) => updateLine(i, 'bedrag', e.target.value)} placeholder="0.00" />
                    <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', color: 'var(--tm)', cursor: 'pointer', padding: '3px' }}><TrashIcon /></button>
                  </div>
                ))}
              </div>
              <button onClick={addLine} style={{ ...btn2, padding: '6px 12px', fontSize: '10px', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <PlusIcon /> Regel
              </button>
            </div>

            {/* Totals card */}
            <div style={{ ...crd, marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 18px', fontSize: '12px' }}>
                <span style={{ color: 'var(--tm)' }}>Arbeid:</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totals.arbeid)}</span>
                <span style={{ color: 'var(--tm)' }}>Materiaal:</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totals.materiaal)}</span>
                <span style={{ color: 'var(--tm)' }}>Subtotaal excl. BTW:</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totals.sub)}</span>
                <span style={{ color: 'var(--tm)' }}>BTW {btwVerlegd ? '(verlegd)' : `${btwTarief}%`}:</span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: btwVerlegd ? 'var(--ac)' : 'var(--tx)' }}>
                  {btwVerlegd ? '€ 0,00 (verlegd)' : fmt(totals.btwB)}
                </span>
                <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--bd)', margin: '2px 0' }} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Totaal:</span>
                <span style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', color: 'var(--ac)' }}>{fmt(totals.totIncl)}</span>
                {useGrek && <>
                  <div style={{ gridColumn: '1/-1', borderTop: '1px dashed var(--bd)', margin: '2px 0' }} />
                  <span style={{ color: 'var(--tm)', fontSize: '11px' }}>→ G-rek ({gPerc}% × arbeid):</span>
                  <span style={{ textAlign: 'right', fontSize: '11px', color: 'var(--ac)' }}>{fmt(totals.gSplit)}</span>
                  <span style={{ color: 'var(--tm)', fontSize: '11px' }}>→ Normaal:</span>
                  <span style={{ textAlign: 'right', fontSize: '11px' }}>{fmt(totals.normB)}</span>
                </>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Preview ═══ */}
        {step === 3 && (
          <div>
            <div style={sec}><EyeIcon /> Factuurvoorbeeld</div>

            {/* Compliance check */}
            {(compliance.errors.length > 0 || compliance.warnings.length > 0) ? (
              <div style={{ marginBottom: '14px' }}>
                {compliance.errors.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.3)', borderRadius: '6px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dn)', marginBottom: '5px' }}>
                      Factuur niet compleet ({compliance.errors.length})
                    </div>
                    {compliance.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: '11px', color: 'var(--tx)', lineHeight: 1.7 }}>• {e}</div>
                    ))}
                  </div>
                )}
                {compliance.warnings.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'var(--abg)', border: '1px solid rgba(245,158,11,.3)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ac)', marginBottom: '5px' }}>
                      Aanbevolen ({compliance.warnings.length})
                    </div>
                    {compliance.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize: '11px', color: 'var(--tm)', lineHeight: 1.7 }}>• {w}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.3)', borderRadius: '6px', marginBottom: '14px', fontSize: '11px', color: 'var(--ok)', fontWeight: 600 }}>
                ✓ Voldoet aan factuurvereisten Belastingdienst{useGrek ? ' en Wka' : ''}
              </div>
            )}

            {/* Compact in-app preview */}
            <div style={{ background: '#FEFDFB', borderRadius: '8px', padding: '18px', color: '#1A1A1A', fontFamily: "Georgia,serif", fontSize: '11px', lineHeight: 1.5, boxShadow: '0 2px 12px rgba(0,0,0,.1)', border: '1px solid #E5E2DB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '2px solid #D97706', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#D97706', fontFamily: 'var(--fn)', letterSpacing: '.05em' }}>FACTUUR</div>
                  <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '3px' }}>Nr. {project.factuurnummer} | {fmtDate(project.factuurdatum)}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px' }}>
                  <div style={{ fontWeight: 700 }}>{oa.naam}</div><div>{oa.postcode} {oa.plaats}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.12em', color: '#6B7280', fontFamily: 'var(--fn)', fontWeight: 600, marginBottom: '2px' }}>Aan</div>
                  <div style={{ fontWeight: 600 }}>{og.naam || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.12em', color: '#6B7280', fontFamily: 'var(--fn)', fontWeight: 600, marginBottom: '2px' }}>Project</div>
                  <div style={{ fontWeight: 600 }}>{project.projectNaam || '—'}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead><tr>
                  <th style={{ textAlign: 'left', padding: '4px', borderBottom: '1.5px solid #E5E2DB', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--fn)', color: '#6B7280' }}>Omschrijving</th>
                  <th style={{ textAlign: 'right', padding: '4px', borderBottom: '1.5px solid #E5E2DB', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--fn)', color: '#6B7280' }}>Bedrag</th>
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: '3px 4px', borderBottom: '1px solid #E5E2DB' }}>{l.omschrijving || '—'} <span style={{ fontSize: '8px', color: '#9CA3AF' }}>({l.type})</span></td>
                      <td style={{ padding: '3px 4px', borderBottom: '1px solid #E5E2DB', textAlign: 'right', fontFamily: 'var(--fn)' }}>{l.bedrag ? fmt(parseFloat(l.bedrag)) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', fontSize: '10px' }}>
                <div style={{ width: '180px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotaal:</span><span style={{ fontFamily: 'var(--fn)' }}>{fmt(totals.sub)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: btwVerlegd ? '#D97706' : '#1A1A1A' }}><span>BTW{btwVerlegd ? ' verlegd' : ` ${btwTarief}%`}:</span><span style={{ fontFamily: 'var(--fn)' }}>{btwVerlegd ? '€ 0,00' : fmt(totals.btwB)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px', marginTop: '3px', paddingTop: '3px', borderTop: '2px solid #D97706' }}>
                    <span>Totaal:</span><span style={{ fontFamily: 'var(--fn)' }}>{fmt(totals.totIncl)}</span>
                  </div>
                </div>
              </div>

              {btwVerlegd && <div style={{ background: '#D97706', color: '#fff', padding: '5px 8px', borderRadius: '3px', fontSize: '9px', fontFamily: 'var(--fn)', fontWeight: 700, textAlign: 'center', marginTop: '10px' }}>BTW VERLEGD — Art. 12 lid 5 Wet OB 1968</div>}

              {useGrek && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <div style={{ flex: 1, padding: '7px 10px', background: '#FEF3C7', borderRadius: '4px' }}>
                    <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#92400E', fontFamily: 'var(--fn)', fontWeight: 600 }}>G-rekening</div>
                    <div style={{ fontWeight: 700, color: '#92400E', fontFamily: 'var(--fn)', marginTop: '2px', fontSize: '13px' }}>{fmt(totals.gSplit)}</div>
                  </div>
                  <div style={{ flex: 1, padding: '7px 10px', background: '#F0FDF4', borderRadius: '4px' }}>
                    <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#166534', fontFamily: 'var(--fn)', fontWeight: 600 }}>Normaal</div>
                    <div style={{ fontWeight: 700, color: '#166534', fontFamily: 'var(--fn)', marginTop: '2px', fontSize: '13px' }}>{fmt(totals.normB)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button onClick={exportPDF} style={{ ...btn1, flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <DownIcon /> PDF
              </button>
              {features.xmlExport && (
              <button onClick={() => {
                const xml = generateInvoiceXML({ oa, og, project, lines, totals, btwVerlegd, btwTarief, useGrek, gPerc });
                downloadXML(xml, `factuur-${project.factuurnummer || 'draft'}.xml`);
                flash('DICO/NLCIUS XML gedownload');
              }} style={{ ...btn2, flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--ac)', color: 'var(--ac)' }}>
                <FileIcon /> XML
              </button>
              )}
              <button onClick={saveInvoice} style={{ ...btn2, flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--ok)', color: 'var(--ok)' }}>
                <SaveIcon /> Opslaan
              </button>
            </div>

            {/* Peppol e-Invoicing */}
            {features.peppol && (
              <PeppolPanel
                recipientKvk={og.kvk}
                recipientName={og.naam}
                senderKvk={oa.kvk}
                onGenerateXml={() => generateInvoiceXML({ oa, og, project, lines, totals, btwVerlegd, btwTarief, useGrek, gPerc })}
              />
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--bd)' }}>
          <button style={{ ...btn2, visibility: step === 0 ? 'hidden' : 'visible' }} onClick={() => setStep(step - 1)}>← Vorige</button>
          {step < 3
            ? <button style={btn1} onClick={() => setStep(step + 1)}>Volgende →</button>
            : <button style={btn2} onClick={newInvoice}><PlusIcon /> Nieuwe factuur</button>
          }
        </div>
      </div>
    </div>
  );
}
