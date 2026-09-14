/**
 * Validation helpers for BouwFactuur.
 *
 * - IBAN validation (ISO 13616 mod-97 check)
 * - Invoice compliance check against Belastingdienst factuurvereisten
 *   and Wet Ketenaansprakelijkheid requirements
 */

/** Validate an IBAN using the ISO 13616 mod-97 algorithm. */
export function isValidIban(iban) {
  if (!iban) return false;
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  // Move first 4 chars to the end, convert letters to numbers (A=10..Z=35)
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const val = ch >= 'A' ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of val) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/**
 * Check an invoice against legal requirements.
 *
 * Returns { errors, warnings }:
 * - errors: missing elements that make the invoice non-compliant
 *   (Belastingdienst factuurvereisten / verleggingsregeling / Wka)
 * - warnings: items that are recommended but not strictly required
 */
/**
 * Returns { errors, warnings } as plain strings (kept for existing callers)
 * plus { errorItems, warningItems } with { msg, step } so the UI can jump
 * to the step where the fix lives (0 profiel, 1 klant, 2 regels).
 */
export function checkInvoice({ oa, og, project, lines, btwVerlegd, useGrek }) {
  const errorItems = [];
  const warningItems = [];
  const errors = { push: (msg, step = 0) => errorItems.push({ msg, step }) };
  const warnings = { push: (msg, step = 0) => warningItems.push({ msg, step }) };

  // ── Eigen gegevens (verplicht op elke factuur) ──
  if (!oa.naam) errors.push('Eigen bedrijfsnaam ontbreekt');
  if (!oa.adres || !oa.postcode || !oa.plaats) errors.push('Eigen adresgegevens onvolledig');
  if (!oa.kvk) errors.push('Eigen KvK-nummer ontbreekt');
  if (!oa.btw) errors.push('Eigen BTW-nummer ontbreekt');
  if (!oa.iban) errors.push('IBAN ontbreekt');
  else if (!isValidIban(oa.iban)) errors.push('IBAN is ongeldig (controlegetal klopt niet)');

  // ── Opdrachtgever ──
  if (!og.naam) errors.push('Naam opdrachtgever ontbreekt', 1);
  if (!og.adres || !og.postcode || !og.plaats) errors.push('Adres opdrachtgever onvolledig', 1);

  // ── Verleggingsregeling: BTW-nummer afnemer is verplicht ──
  if (btwVerlegd && !og.btw) {
    errors.push('BTW verlegd vereist het BTW-nummer van de opdrachtgever op de factuur', 1);
  }

  // ── Factuurgegevens ──
  if (!project.factuurnummer) errors.push('Factuurnummer ontbreekt', 2);
  if (!project.factuurdatum) errors.push('Factuurdatum ontbreekt', 2);

  // ── Regels ──
  const hasAmount = lines.some((l) => parseFloat(l.bedrag) > 0);
  if (!hasAmount) errors.push('Geen factuurregels met een bedrag', 2);
  if (lines.some((l) => parseFloat(l.bedrag) > 0 && !l.omschrijving)) {
    errors.push('Eén of meer regels missen een omschrijving (aard van de dienst is verplicht)', 2);
  }

  // ── Wka / G-rekening ──
  if (useGrek) {
    if (!oa.gRekening) errors.push('G-rekening IBAN ontbreekt terwijl G-rekening splitsing aanstaat');
    else if (!isValidIban(oa.gRekening)) errors.push('G-rekening IBAN is ongeldig');
    if (!project.contractNummer) warnings.push('Kenmerk overeenkomst (contractnummer) aanbevolen voor Wka-administratie', 2);
    if (!project.projectNaam) warnings.push('Benaming werk (projectnaam) aanbevolen voor Wka-administratie', 2);
  }

  // ── Overig ──
  if (!og.kvk) warnings.push('KvK-nummer opdrachtgever aanbevolen voor Wka-administratie', 1);

  return {
    errors: errorItems.map((e) => e.msg),
    warnings: warningItems.map((w) => w.msg),
    errorItems,
    warningItems,
  };
}
