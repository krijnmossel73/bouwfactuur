import { fmt, fmtDate, calcVerval } from './utils.js';
import { BackIcon, DownIcon } from './Icons.jsx';
import { btn1, btn2 } from './styles.js';

/**
 * Full-page print-ready invoice view.
 * Renders an A4-formatted invoice with all Dutch compliance elements.
 */
export default function InvoicePDF({ oa, og, project, lines, totals, btwVerlegd, btwTarief = 21, useGrek, gPerc, onBack }) {
  const { sub, btwB, totIncl, gSplit, normB, arbeid } = totals;
  const verval = calcVerval(project.factuurdatum, project.betaaltermijn);
  const FN = "var(--fn)";

  return (
    <div>
      {/* Toolbar — hidden in print */}
      <div className="print-bar no-print">
        <button onClick={onBack} style={{ ...btn2, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <BackIcon /> Terug
        </button>
        <span style={{ fontSize: '12px', color: 'var(--tm)' }}>
          Gebruik Ctrl+P / ⌘P → "Opslaan als PDF"
        </span>
        <button onClick={() => window.print()} style={{ ...btn1, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <DownIcon /> PDF opslaan
        </button>
      </div>

      {/* A4 Page */}
      <div className="print-page" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '12px', lineHeight: 1.6, color: '#1A1A1A' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '2.5px solid #D97706', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#D97706', fontFamily: FN, letterSpacing: '.06em' }}>FACTUUR</div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#6B7280' }}>
              Nr. {project.factuurnummer || '—'} &nbsp;|&nbsp; Datum: {fmtDate(project.factuurdatum)}
            </div>
            {project.contractNummer && (
              <div style={{ fontSize: '11px', color: '#6B7280' }}>Contract: {project.contractNummer}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>{oa.naam || '—'}</div>
            <div>{oa.adres}</div>
            <div>{oa.postcode} {oa.plaats}</div>
            <div style={{ marginTop: '3px', color: '#6B7280', fontSize: '10px' }}>
              KvK: {oa.kvk || '—'} | BTW: {oa.btw || '—'}
            </div>
          </div>
        </div>

        {/* ── Addresses ── */}
        <div style={{ display: 'flex', gap: '40px', marginBottom: '18px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B7280', fontFamily: FN, fontWeight: 600, marginBottom: '4px' }}>Opdrachtgever</div>
            <div style={{ fontWeight: 600 }}>{og.naam || '—'}</div>
            <div>{og.adres}</div>
            <div>{og.postcode} {og.plaats}</div>
            <div style={{ marginTop: '3px', color: '#6B7280', fontSize: '10px' }}>
              KvK: {og.kvk || '—'} | BTW: {og.btw || '—'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B7280', fontFamily: FN, fontWeight: 600, marginBottom: '4px' }}>Project</div>
            <div style={{ fontWeight: 600 }}>{project.projectNaam || '—'}</div>
            <div style={{ marginTop: '3px', color: '#6B7280', fontSize: '10px' }}>
              Betaaltermijn: {project.betaaltermijn} dagen | Vervaldatum: {fmtDate(verval)}
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <table className="inv-tbl">
          <thead>
            <tr>
              <th>Omschrijving</th><th>Type</th>
              <th className="r">Uren</th><th className="r">Tarief</th><th className="r">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.omschrijving || '—'}</td>
                <td style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#6B7280' }}>{l.type}</td>
                <td className="r">{l.uren || '—'}</td>
                <td className="r">{l.tarief ? fmt(parseFloat(l.tarief)) : '—'}</td>
                <td className="r">{l.bedrag ? fmt(parseFloat(l.bedrag)) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.1em', paddingTop: '10px' }}>
                Subtotaal excl. BTW
              </td>
              <td className="r" style={{ fontWeight: 600, paddingTop: '10px' }}>{fmt(sub)}</td>
            </tr>
            <tr>
              <td colSpan="4" style={{ textAlign: 'right', fontSize: '10px', color: btwVerlegd ? '#D97706' : '#1A1A1A' }}>
                BTW {btwVerlegd ? 21 : btwTarief}% {btwVerlegd && <strong>— VERLEGD</strong>}
              </td>
              <td className="r" style={{ color: btwVerlegd ? '#D97706' : '#1A1A1A' }}>
                {btwVerlegd ? '€ 0,00' : fmt(btwB)}
              </td>
            </tr>
            <tr>
              <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', paddingTop: '12px' }}>Totaal</td>
              <td className="r" style={{ fontWeight: 700, fontSize: '15px', paddingTop: '12px' }}>{fmt(totIncl)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ── BTW Verlegd Banner ── */}
        {btwVerlegd && (
          <div style={{
            background: '#D97706', color: '#fff', padding: '9px 14px', borderRadius: '4px',
            fontSize: '11px', fontFamily: FN, fontWeight: 700, letterSpacing: '.05em',
            marginTop: '18px', textAlign: 'center',
          }}>
            BTW VERLEGD — Art. 12 lid 5 Wet op de omzetbelasting 1968
          </div>
        )}

        {/* ── Payment Instructions ── */}
        <div style={{ marginTop: '18px', padding: '14px', background: '#F9F7F3', borderRadius: '6px', border: '1px solid #E5E2DB' }}>
          <div style={{ fontSize: '9px', letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B7280', fontFamily: FN, fontWeight: 600, marginBottom: '8px' }}>
            Betalingsgegevens
          </div>
          {useGrek ? (
            <>
              <div style={{ fontSize: '10px', color: '#6B7280', marginBottom: '10px' }}>
                Gelieve het factuurbedrag als volgt te voldoen conform de Wet Ketenaansprakelijkheid:
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, padding: '10px 12px', background: '#FEF3C7', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#92400E', fontFamily: FN, fontWeight: 600 }}>G-rekening</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400E', marginTop: '3px', fontFamily: FN }}>{fmt(gSplit)}</div>
                  <div style={{ fontSize: '10px', color: '#A16207', marginTop: '3px' }}>{oa.gRekening || '—'}</div>
                  <div style={{ fontSize: '9px', color: '#A16207' }}>({gPerc}% × arbeid {fmt(arbeid)})</div>
                </div>
                <div style={{ flex: 1, padding: '10px 12px', background: '#F0FDF4', borderRadius: '4px', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.1em', color: '#166534', fontFamily: FN, fontWeight: 600 }}>Normaal rekening</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#166534', marginTop: '3px', fontFamily: FN }}>{fmt(normB)}</div>
                  <div style={{ fontSize: '10px', color: '#15803D', marginTop: '3px' }}>{oa.iban || '—'}</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12px' }}>
              <div>IBAN: <strong>{oa.iban || '—'}</strong></div>
              <div>Bedrag: <strong>{fmt(totIncl)}</strong></div>
              <div style={{ marginTop: '3px', color: '#6B7280', fontSize: '10px' }}>
                o.v.v. factuurnummer {project.factuurnummer || '—'}
              </div>
            </div>
          )}
        </div>

        {/* ── Wka Footer ── */}
        <div style={{
          marginTop: '14px', padding: '10px 12px', background: '#F9F7F3', borderRadius: '4px',
          border: '1px solid #E5E2DB', fontSize: '9px', color: '#6B7280', lineHeight: 1.6,
        }}>
          <strong>Wka-vermelding:</strong>{' '}
          Kenmerk overeenkomst: {project.contractNummer || '—'}.{' '}
          Benaming werk: {project.projectNaam || '—'}.{' '}
          Tijdvak: {fmtDate(project.factuurdatum)}.
          {useGrek && ` Storting G-rekening: ${fmt(gSplit)} (${gPerc}% over loonkostenbestanddeel).`}
          {btwVerlegd && ` BTW verlegd naar ${og.naam || 'opdrachtgever'}, BTW-nr: ${og.btw || '—'}.`}
        </div>
      </div>
    </div>
  );
}
