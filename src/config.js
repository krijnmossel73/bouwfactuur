/**
 * BouwFactuur Feature Flags
 *
 * Toggle features on/off here. This is the single place to
 * enable or disable functionality across the app.
 */

export const features = {
  /** Show the Peppol e-invoicing panel on the invoice preview step */
  peppol: false,

  /** Show the DICO/NLCIUS XML export button */
  xmlExport: true,

  /** Show VIES BTW validation buttons */
  viesValidation: true,

  /** Show KvK lookup buttons */
  kvkLookup: true,
};
