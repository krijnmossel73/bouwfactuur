/**
 * Shared inline style fragments used across components.
 * Kept here to avoid duplication while staying framework-light.
 */

export const inp = {
  background: 'var(--sf)', border: '1px solid var(--bd)', borderRadius: '6px',
  padding: '10px 12px', color: 'var(--tx)', fontSize: '13px',
  fontFamily: 'var(--fn)', outline: 'none', width: '100%', boxSizing: 'border-box',
};

export const sel = {
  ...inp, appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8F98' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px',
};

export const lbl = {
  fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--tm)', fontWeight: '500', display: 'block', marginBottom: '3px',
};

export const btn1 = {
  background: 'var(--ac)', color: '#FFFFFF', border: 'none', borderRadius: '6px',
  padding: '11px 20px', fontSize: '11px', fontWeight: '700', fontFamily: 'var(--fn)',
  letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
};

export const btn2 = {
  ...btn1, background: 'transparent', color: 'var(--tm)', border: '1px solid var(--bd)',
};

export const sec = {
  fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ac)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px',
};

export const g2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' };
export const full = { gridColumn: '1/-1' };

export const crd = {
  background: 'var(--sf)', borderRadius: '8px', border: '1px solid var(--bd)', padding: '14px',
};

export const chk = {
  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
  background: 'var(--abg)', borderRadius: '8px', border: '1px solid var(--bd)',
  cursor: 'pointer', marginBottom: '10px',
};

export const nfo = {
  padding: '10px 14px', background: 'var(--abg)', borderRadius: '6px',
  border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px',
  color: 'var(--tm)', lineHeight: 1.6,
};

export const sinp = { ...inp, padding: '8px 10px', fontSize: '12px' };
