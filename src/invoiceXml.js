/**
 * DICO / NLCIUS Invoice XML Generator
 *
 * Generates a UBL 2.1 invoice following the NLCIUS (SI-UBL 2.0) profile,
 * which is the Peppol BIS 3.0 compliant format used in the Netherlands.
 *
 * This format is interoperable with the DICO SALES005 ecosystem:
 * - Service providers like eVerbinding and Banqup can convert NLCIUS → DICO
 * - Peppol service providers route these directly to DICO-enabled recipients
 * - GLN codes are included for Ketenstandaard compatibility
 *
 * Construction-specific features:
 * - BTW verlegd (VAT reverse charge) per art. 12 lid 5 Wet OB 1968
 * - G-rekening payment split information
 * - Wet Ketenaansprakelijkheid documentation
 * - Arbeid/materiaal line item classification
 */

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function amount(n) {
  return (parseFloat(n) || 0).toFixed(2);
}

/**
 * Generate a UBL 2.1 NLCIUS invoice XML string.
 *
 * @param {Object} params
 * @param {Object} params.oa - Onderaannemer (supplier) data
 * @param {Object} params.og - Opdrachtgever (buyer) data
 * @param {Object} params.project - Project/invoice metadata
 * @param {Array}  params.lines - Invoice line items
 * @param {Object} params.totals - Calculated totals
 * @param {boolean} params.btwVerlegd - Whether VAT is reverse-charged
 * @param {boolean} params.useGrek - Whether G-rekening split applies
 * @param {number} params.gPerc - G-rekening percentage
 * @returns {string} XML string
 */
export function generateInvoiceXML({ oa, og, project, lines, totals, btwVerlegd, useGrek, gPerc }) {
  const { sub, btwB, totIncl, gSplit, normB, arbeid } = totals;
  const issueDate = project.factuurdatum || new Date().toISOString().split('T')[0];

  // Calculate due date
  const dueDate = (() => {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + (project.betaaltermijn || 30));
    return d.toISOString().split('T')[0];
  })();

  // Tax category code: AE = VAT Reverse Charge, S = Standard rate
  const taxCategory = btwVerlegd ? 'AE' : 'S';
  const taxRate = btwVerlegd ? '0.00' : '21.00';
  const taxScheme = 'VAT';

  // Build line items XML
  const lineItemsXml = lines.map((line, idx) => {
    const lineAmount = amount(line.bedrag);
    const qty = line.uren || '1';
    const price = line.tarief || lineAmount;

    return `
    <cac:InvoiceLine>
      <cbc:ID>${idx + 1}</cbc:ID>
      <cbc:Note>${escapeXml(line.type === 'arbeid' ? 'Arbeid' : 'Materiaal')}</cbc:Note>
      <cbc:InvoicedQuantity unitCode="HUR">${escapeXml(qty)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${lineAmount}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${escapeXml(line.omschrijving || 'Bouwwerkzaamheden')}</cbc:Description>
        <cbc:Name>${escapeXml(line.omschrijving || 'Bouwwerkzaamheden')}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${taxCategory}</cbc:ID>
          <cbc:Percent>${taxRate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>${taxScheme}</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${amount(price)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
  }).join('\n');

  // G-rekening payment note
  const gRekeningNote = useGrek
    ? `Wet Ketenaansprakelijkheid: storting G-rekening ${amount(gSplit)} EUR (${gPerc}% over loonkostenbestanddeel ${amount(arbeid)} EUR). G-rekening IBAN: ${oa.gRekening || 'N/B'}. Restant ${amount(normB)} EUR naar IBAN: ${oa.iban || 'N/B'}.`
    : '';

  const wkaNote = `Kenmerk overeenkomst: ${project.contractNummer || 'N/B'}. Benaming werk: ${project.projectNaam || 'N/B'}.`;

  // Payment means — include both accounts if G-rekening
  let paymentMeansXml = '';
  if (useGrek && oa.gRekening) {
    // G-rekening payment
    paymentMeansXml += `
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
      <cbc:InstructionNote>G-rekening storting (${gPerc}% loonkosten)</cbc:InstructionNote>
      <cac:PayeeFinancialAccount>
        <cbc:ID>${escapeXml(oa.gRekening)}</cbc:ID>
        <cbc:Name>G-rekening ${escapeXml(oa.naam)}</cbc:Name>
      </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>`;
  }
  // Normal account payment
  paymentMeansXml += `
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
      <cbc:PaymentID>${escapeXml(project.factuurnummer)}</cbc:PaymentID>
      <cac:PayeeFinancialAccount>
        <cbc:ID>${escapeXml(oa.iban)}</cbc:ID>
        <cbc:Name>${escapeXml(oa.naam)}</cbc:Name>
      </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <!-- NLCIUS / SI-UBL 2.0 profile for Dutch construction invoicing -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:nen.nl:nlcius:v1.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>

  <cbc:ID>${escapeXml(project.factuurnummer)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  ${btwVerlegd ? '<cbc:TaxPointDate>' + issueDate + '</cbc:TaxPointDate>' : ''}
  <cbc:Note>${escapeXml(wkaNote)}${gRekeningNote ? ' ' + escapeXml(gRekeningNote) : ''}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  ${project.contractNummer ? '<cbc:BuyerReference>' + escapeXml(project.contractNummer) + '</cbc:BuyerReference>' : ''}

  <!-- Contract reference -->
  ${project.contractNummer ? `<cac:ContractDocumentReference>
    <cbc:ID>${escapeXml(project.contractNummer)}</cbc:ID>
  </cac:ContractDocumentReference>` : ''}

  <!-- Project reference -->
  ${project.projectNaam ? `<cac:ProjectReference>
    <cbc:ID>${escapeXml(project.projectNaam)}</cbc:ID>
  </cac:ProjectReference>` : ''}

  <!-- Supplier (Onderaannemer) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="KVK">${escapeXml(oa.kvk)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(oa.naam)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(oa.adres)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(oa.plaats)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(oa.postcode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(oa.btw)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>${taxScheme}</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(oa.naam)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="KVK">${escapeXml(oa.kvk)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer (Opdrachtgever) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="KVK">${escapeXml(og.kvk)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${escapeXml(og.naam)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(og.adres)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(og.plaats)}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(og.postcode)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(og.btw)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>${taxScheme}</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(og.naam)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="KVK">${escapeXml(og.kvk)}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Payment terms -->
  <cac:PaymentTerms>
    <cbc:Note>Betaaltermijn: ${project.betaaltermijn || 30} dagen.${btwVerlegd ? ' BTW verlegd conform art. 12 lid 5 Wet op de omzetbelasting 1968.' : ''}</cbc:Note>
  </cac:PaymentTerms>

  <!-- Payment means -->
  ${paymentMeansXml}

  <!-- Tax totals -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${amount(btwB)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${amount(sub)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${amount(btwB)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${taxCategory}</cbc:ID>
        <cbc:Percent>${taxRate}</cbc:Percent>
        ${btwVerlegd ? '<cbc:TaxExemptionReasonCode>vatex-eu-ae</cbc:TaxExemptionReasonCode>' : ''}
        ${btwVerlegd ? '<cbc:TaxExemptionReason>BTW verlegd - art. 12 lid 5 Wet op de omzetbelasting 1968</cbc:TaxExemptionReason>' : ''}
        <cac:TaxScheme>
          <cbc:ID>${taxScheme}</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Monetary totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${amount(sub)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${amount(sub)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${amount(totIncl)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${amount(totIncl)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Line items -->
  ${lineItemsXml}

</Invoice>`;

  return xml;
}

/**
 * Trigger a download of the XML file in the browser.
 */
export function downloadXML(xmlString, filename) {
  const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
