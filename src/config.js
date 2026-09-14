/**
 * BouwFactuur Feature Flags
 *
 * Toggle features on/off here. This is the single place to
 * enable or disable functionality across the app.
 */

export const features = {
  /**
   * Peppol e-invoicing panel on the invoice preview step.
   *   'auto'  → shown as soon as B2BROUTER_API_KEY is configured on the server
   *             (sandbox key: panel shows a test-environment notice)
   *   true    → always shown (dev), false → never shown
   */
  peppol: 'auto',

  /** Show the DICO/NLCIUS XML export button */
  xmlExport: true,

  /** Show VIES BTW validation buttons */
  viesValidation: true,

  /** Show KvK lookup buttons */
  kvkLookup: true,
};
