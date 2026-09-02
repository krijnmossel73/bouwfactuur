# BouwFactuur

Compliant invoicing for Dutch construction subcontractors. Handles BTW verlegd (VAT reverse charge), G-rekening splits, Wet Ketenaansprakelijkheid (Wka) documentation and trade-specific deposit percentages, with NLCIUS/Peppol e-invoicing.

Live: https://bouwfactuur.pages.dev

## Features

- **BTW verlegd**: automatic reverse-charge notation per art. 12 lid 5 Wet OB 1968; BTW-nummer of the client is enforced when verlegd applies
- **BTW tarieven**: 21% / 9% (renovation labor on homes older than 2 years) / 0% when the verleggingsregeling does not apply
- **G-rekening splitsing**: labor/material separation with trade-specific percentages (source: Bouwend Nederland)
- **Wka-vermelding**: chain-liability details (contract reference, project name, G-rekening) on every invoice
- **Compliance check**: pre-export checklist against Belastingdienst factuurvereisten and Wka requirements, including IBAN mod-97 validation
- **PDF export**: A4 print layout via browser print-to-PDF
- **NLCIUS UBL 2.1 XML export**: EN16931-compliant invoice XML (Peppol BIS 3.0 profile) with construction-specific fields, compatible with Peppol and DICO service providers
- **Peppol**: recipient lookup in the Peppol Directory and sending via a Peppol Access Point (Storecove, eConnect or custom); behind a feature flag
- **VIES validation**: real-time BTW-nummer check against the EC VIES API with auto-fill of name and address
- **KvK lookup**: company lookup by KvK-nummer via the KvK Zoeken API (free test environment out of the box)
- **Accounts**: Supabase Auth (email/password and Google); visitors see a public landing page and an explanation page at `#/uitleg`
- **Cloud storage**: company profile, clients, invoices and invoice numbering stored per user in Cloudflare D1, available across devices
- **Freemium**: 2 invoices free (lifetime, enforced server-side), then BouwFactuur Pro via Stripe Checkout (iDEAL, card, SEPA) with a customer portal for managing the subscription
- **Invoice status**: open/betaald per invoice with an outstanding-amount summary
- **Backup & restore**: export all data to JSON and restore it

## Architecture

```
Browser (React/Vite SPA)
   │  Supabase JWT as Bearer token
   ▼
Cloudflare Pages Functions (/api/*)
   ├─ _middleware.js   verifies the JWT against Supabase JWKS
   ├─ storage/*        per-user KV in D1, freemium gate
   ├─ account, billing/* Stripe checkout, portal, webhook
   └─ vies, kvk, peppol/* authenticated proxies to external APIs
   │
   ├─ Cloudflare D1 (tables: kv, accounts)
   ├─ Supabase Auth
   └─ Stripe
```

All `/api/*` endpoints except the Stripe webhook require a valid Supabase session; the webhook is authenticated by its Stripe signature instead.

## Quick start

```bash
npm install
cp .env.example .env        # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npx wrangler d1 execute bouwfactuur --local --file=./schema.sql
npm run dev
```

`npm run dev` runs Vite behind `wrangler pages dev`, so the Pages Functions, the local D1 database and the API proxies all work at http://localhost:8788. `npm run dev:vite` starts the frontend only (http://localhost:5173) without any `/api/*` routes.

## Configuration

### Client (`.env`, build-time)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key; safe to expose in the bundle |

### Server (Cloudflare Pages)

Non-secret values live in `wrangler.toml` under `[vars]`; secrets are set with `npx wrangler pages secret put <NAME> --project-name bouwfactuur` or in the Pages dashboard.

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | yes | Used to fetch the JWKS for JWT verification |
| `SUPABASE_JWT_SECRET` | no | Legacy HS256 secret; takes precedence over JWKS if set |
| `DB` (D1 binding) | yes | Defined in `wrangler.toml` |
| `STRIPE_PRICE_ID` | for billing | Recurring price ID of "BouwFactuur Pro" |
| `STRIPE_SECRET_KEY` | for billing | Secret. Enabling this also activates the freemium limit |
| `STRIPE_WEBHOOK_SECRET` | for billing | Secret, from the webhook endpoint in Stripe |
| `KVK_API_KEY` | no | Production KvK key; without it the free test environment is used |
| `PEPPOL_API_KEY` | for Peppol | Access Point API key |
| `PEPPOL_PROVIDER` | for Peppol | `storecove` (default), `econnect` or `custom` |
| `PEPPOL_SENDER_ID` | for Peppol | Legal entity ID at the provider |
| `PEPPOL_API_URL` | custom only | Endpoint for a custom provider |

### Feature flags

`src/config.js` toggles UI features: `peppol` (off by default), `xmlExport`, `viesValidation`, `kvkLookup`.

## Setup

### Supabase Auth

1. Create a Supabase project.
2. Authentication → URL Configuration: Site URL `https://bouwfactuur.pages.dev`; additional redirect URLs `http://localhost:5173` and `http://localhost:8788`.
3. For Google login: create an OAuth client ID (Web application) in Google Cloud Console with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then enable the Google provider in Supabase with the client ID and secret.
4. Put the project URL and publishable key in `.env` (client) and the project URL in `wrangler.toml` as `SUPABASE_URL` (server).

### Cloudflare D1

```bash
npx wrangler d1 create bouwfactuur                     # once; copy database_id into wrangler.toml
npx wrangler d1 execute bouwfactuur --remote --file=./schema.sql
```

`schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS`) and defines two tables: `kv` (per-user JSON values for `profile`, `clients`, `invoices`, `nextnum`) and `accounts` (lifetime invoice counter and subscription state).

### Stripe

1. Create a product "BouwFactuur Pro" with a recurring monthly EUR price.
2. Enable iDEAL, cards and SEPA Direct Debit as payment methods (iDEAL for the first payment, SEPA for renewals).
3. Add a webhook endpoint `https://bouwfactuur.pages.dev/api/billing/webhook` for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`.
4. Activate the customer portal (Settings → Billing → Customer portal).
5. Set `STRIPE_PRICE_ID` in `wrangler.toml` and the two secrets via `wrangler pages secret put`.
6. Test with test-mode keys first.

Until `STRIPE_SECRET_KEY` is configured the app is unlimited and free; the invoice counter is tracked regardless so history is accurate when billing goes live. `past_due` subscriptions stay entitled so a failed renewal does not lock someone out mid-retry.

### KvK API

The proxy uses the KvK test environment (fictitious data such as "Test BV Donald") until `KVK_API_KEY` is set. Apply for a production key at https://developers.kvk.nl/apply-for-apis.

### Peppol

Peppol Directory lookup works without setup. Sending requires an Access Point subscription: set the `PEPPOL_*` variables above and switch `features.peppol` on in `src/config.js`. Recommended NL providers: Storecove (REST API, free sandbox) and eConnect (construction-focused, DICO). Dutch participants use scheme `0106` (KvK-nummer).

## Deploy

Recommended: connect the GitHub repo in Cloudflare Pages (build command `npm run build`, output directory `dist`, Node 18+). Every push to `main` deploys.

Manual alternative:

```bash
npm run deploy      # vite build + wrangler pages deploy dist
```

Custom domains are added under Pages → Custom domains; Cloudflare provisions TLS.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/storage` | JWT | All stored values for the user |
| GET/PUT/DELETE | `/api/storage/:key` | JWT | Single key (`profile`, `clients`, `invoices`, `nextnum`); PUT on `invoices` returns 402 when the free limit is reached |
| GET | `/api/account` | JWT | Plan, usage and price |
| POST | `/api/billing/checkout` | JWT | Stripe Checkout session URL |
| POST | `/api/billing/portal` | JWT | Stripe customer portal URL |
| POST | `/api/billing/webhook` | Stripe signature | Subscription state updates |
| GET | `/api/vies?country=NL&number=...` | JWT | VIES proxy |
| GET | `/api/kvk?kvkNummer=...` or `?naam=...` | JWT | KvK Zoeken proxy |
| GET | `/api/peppol/lookup?kvk=...` | JWT | Peppol Directory lookup |
| POST | `/api/peppol/send` | JWT | Send UBL XML via the Access Point |

Responses: 401 without a valid session, 503 when a required binding or secret is missing.

## Project structure

```
src/
├── main.jsx             Entry point
├── App.jsx              Main editor (4-step wizard), routing, auth state
├── AuthModal.jsx        Login / register / password reset
├── LandingPage.jsx      Public landing page
├── Uitleg.jsx           Explanation page (#/uitleg)
├── PaywallModal.jsx     Upgrade prompt on 402
├── InvoicePDF.jsx       Print-ready A4 invoice
├── InvoiceHistory.jsx   Saved invoices with status
├── PeppolPanel.jsx      Peppol lookup + send UI
├── ViesButton.jsx / vies.js      VIES validation
├── KvkButton.jsx / kvk.js        KvK lookup
├── peppol.js            Peppol client
├── invoiceXml.js        NLCIUS UBL 2.1 generator
├── validation.js        IBAN check + compliance checklist
├── storage.js           Cloud storage client (+ one-time legacy migration)
├── billing.js           Account / checkout / portal client
├── supabase.js          Supabase client
├── config.js            Feature flags
├── constants.js         Trade percentages, blank templates
├── utils.js             Formatting, totals, rounding
├── styles.js, Icons.jsx, index.css

functions/
├── _middleware.js       Supabase JWT verification → context.data.user
└── api/
    ├── storage/         index.js (GET all), [key].js (GET/PUT/DELETE)
    ├── account.js
    ├── billing/         checkout.js, portal.js, webhook.js
    ├── vies.js, kvk.js
    └── peppol/          lookup.js, send.js

lib/
├── auth.js              requireUser() guard for handlers
├── accounts.js          Freemium entitlement logic
└── stripe.js            Minimal Stripe client + webhook signature check

schema.sql               D1 schema
wrangler.toml            Pages config, D1 binding, non-secret vars
public/_routes.json      Routes only /api/* through Functions
```

## Roadmap

- [ ] Automated tests (Vitest) and CI
- [ ] Invoices as their own D1 table with server-issued numbers
- [ ] Privacy statement, algemene voorwaarden, account deletion
- [ ] Server-side PDF generation
- [ ] Peppol sending enabled by default once an Access Point contract is in place

## License

All rights reserved. Not open source.
