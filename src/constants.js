/**
 * G-rekening deposit percentages per trade.
 * Source: Bouwend Nederland / RSM Global NL guidelines.
 * These represent the percentage of the LABOR component
 * that should be deposited into the G-rekening.
 */
export const TRADE_PERCENTAGES = {
  'Betonherstel': 90,
  'CV-installateur': 50,
  'Dakdekker': 50,
  'Elektra-installateur': 75,
  'Grondwerker': 33,
  'Hoveniersbedrijf': 90,
  'Loodgieter': 50,
  'Metselaar': 90,
  'Renovatiebedrijf': 50,
  'Rioolontstopper': 90,
  'Schilder': 70,
  'Schoonmaakbedrijf': 90,
  'Sloopbedrijf': 50,
  'Staalconstructie': 50,
  'Stratenmaker': 90,
  'Stukadoor': 90,
  'Tegelzetter': 55,
  'Timmerman': 55,
  'Vlechter': 45,
  'Vloerenlegger': 80,
  'Vloerenbedrijf': 90,
  'Anders': 40,
};

/** Blank onderaannemer (your company) */
export const BLANK_OA = {
  naam: '', adres: '', postcode: '', plaats: '',
  kvk: '', btw: '', iban: '', gRekening: '', trade: 'Anders',
};

/** Blank opdrachtgever (client) */
export const BLANK_OG = {
  naam: '', adres: '', postcode: '', plaats: '',
  kvk: '', btw: '',
};

/** Blank project / invoice metadata */
export const BLANK_PROJECT = {
  projectNaam: '', contractNummer: '', factuurnummer: '',
  factuurdatum: new Date().toISOString().split('T')[0],
  betaaltermijn: 30,
};

/** Blank invoice line */
export const BLANK_LINE = {
  omschrijving: '', type: 'arbeid', uren: '', tarief: '', bedrag: '',
};
