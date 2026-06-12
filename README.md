# BouwFactuur

Compliant invoicing tool for Dutch construction companies. Handles BTW verlegd (VAT reverse charge), G-rekening splits, Wet Ketenaansprakelijkheid documentation, and trade-specific deposit percentages.

## Features

- **BTW verlegd** — automatic VAT reverse charge notation per art. 12 lid 5 Wet OB 1968
- **G-rekening splitsing** — labor/material separation with trade-specific percentages (source: Bouwend Nederland)
- **Wka-vermelding** — mandatory chain liability documentation on every invoice
- **PDF export** — clean A4 print layout via browser print-to-PDF
- **VIES validation** — real-time BTW number verification against the official EC VIES API, with auto-fill of company name/address
- **KvK integration** — look up companies by KvK-nummer via the KvK Zoeken API, auto-fills name/address fields (free test environment included)
- **DICO/NLCIUS XML export** — generate UBL 2.1 NLCIUS-compliant invoice XML with construction-specific fields (G-rekening, btw verlegd, Wka), compatible with Peppol and DICO service providers
- **Peppol e-invoicing** — look up recipients in the Peppol Directory and send invoices directly via a Peppol Access Point (Storecove, eConnect, or custom provider)
- **Authentication** — account required (Supabase Auth: email/password and Google); visitors see a public landing page with a detailed explanation at `#/uitleg`
- **Subscriptions (freemium)** — 2 invoices free (lifetime, enforced server-side), then BouwFactuur Pro via Stripe Checkout (iDEAL/card); customer portal for managing/canceling
- **Persistent storage** — company profiles, clients, and invoice history saved per user. With D1 enabled, data is stored in the cloud and follows your login across devices; without it, the app falls back to per-user localStorage.
- **Auto-numbering** — sequential invoice numbers that persist across sessions
- **Compliance check** — pre-export checklist against Belastingdienst factuurvereisten and Wka requirements (incl. IBAN mod-97 validation and mandatory client BTW-nr when verlegd)
- **BTW tarieven** — 21% / 9% (renovation labor, homes >2 yrs) / 0% selectable when verleggingsregeling does not apply
- **Invoice status** — open/betaald tracking per invoice with outstanding-amount summary in the history view
- **Backup & restore** — export all data (profile, clients, invoices, numbering) to JSON and restore it, as protection against browser storage loss

## Quick Start

```bash
npm install
npm run dev
```

This starts the app with **Cloudflare Pages Functions** (VIES, KvK, Peppol proxies) via `wrangler pages dev`. If you only need the frontend without API proxies, use `npm run dev:vite` instead.

Open [http://localhost:8788](http://localhost:8788) (wrangler) or [http://localhost:5173](http://localhost:5173) (vite-only).

## Enable D1 cloud storage

By default, data lives in localStorage. To store it in Cloudflare D1 (synced across devices, tied to your Cloudflare Access login):

```bash
# 1. Create the database (once)
npx wrangler d1 create bouwfactuur

# 2. Copy the printed database_id into wrangler.toml
#    (uncomment the [[d1_databases]] block)

# 3. Apply the schema to the production database
npx wrangler d1 execute bouwfactuur --remote --file=./schema.sql

# 4. For local dev with wrangler pages dev:
npx wrangler d1 execute bouwfactuur --local --file=./schema.sql

# 5. Commit & push — deployment picks up the binding
```

How it behaves:

- **Logged in + D1 bound** → reads/writes go to D1 via `/api/storage`. A green cloud icon (☁) appears next to your email in the header.
- **First load with an empty D1 store** → existing localStorage data is migrated up automatically (one-time), with a confirmation toast.
- **No D1 binding / not authenticated / API error** → transparent fallback to localStorage, identical to pre-D1 behaviour.
- Every cloud write is mirrored to localStorage as an offline backup; on load, cloud data wins whenever it exists.

## Authentication (Supabase)

Login (email/password and Google) runs on [Supabase Auth](https://supabase.com/auth) and is required to use the app: all data lives in Cloudflare D1, tied to the user's account. Non-logged-in visitors get a landing page with register/login and a link to the explanation page (`#/uitleg`).

Setup:

```text
1. Create a free Supabase project (supabase.com → New project)

2. Google login:
   - Google Cloud Console → APIs & Services → Credentials →
     Create OAuth client ID (Web application)
   - Authorized redirect URI: https://<project-ref>.supabase.co/auth/v1/callback
   - Supabase → Authentication → Sign In / Providers → Google →
     paste Client ID + Secret, enable

3. Supabase → Authentication → URL Configuration:
   - Site URL: https://bouwfactuur.pages.dev
   - Additional redirect URLs: http://localhost:5173, http://localhost:8788

4. Client env: copy .env.example to .env, fill in
   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
   (Project Settings → API)

5. Server env: uncomment [vars] SUPABASE_URL in wrangler.toml
   (same URL as step 4)

6. npm run deploy
```

How it works: the browser holds a Supabase session and sends its JWT as a Bearer token to `/api/storage/*`; the Pages Functions middleware cryptographically verifies it against the project's JWKS endpoint (or `SUPABASE_JWT_SECRET` for legacy HS256 projects) and scopes all D1 rows to the verified user ID. There is no localStorage backend: data created by pre-account versions of the app is migrated to D1 once on first login and then removed from the browser.

## Deploy to Cloudflare Pages

### Option A: CLI deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name bouwfactuur
```

### Option B: Git integration (recommended)

1. Push to GitHub:
   ```bash
   git init && git add -A && git commit -m "initial"
   gh repo create bouwfactuur --private --push
   ```

2. In Cloudflare Dashboard → Pages → Create a project → Connect to Git

3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `18` (or higher)

4. Deploy. Your app will be live at `bouwfactuur.pages.dev`.

### Custom domain

In Cloudflare Pages → your project → Custom domains → add `factuur.mosselcloud.nl` (or whatever you choose). Cloudflare handles SSL automatically.

## Project Structure

```
src/
├── main.jsx          # Entry point
├── index.css         # Global styles + print CSS
├── App.jsx           # Main editor (4-step wizard)
├── InvoicePDF.jsx    # Print-ready A4 invoice view
├── InvoiceHistory.jsx# Saved invoice list
├── ViesButton.jsx    # VIES validation button component
├── vies.js           # VIES API client + format validation
├── KvkButton.jsx     # KvK lookup button component
├── kvk.js            # KvK API client
├── invoiceXml.js     # DICO/NLCIUS UBL 2.1 XML generator
├── peppol.js         # Peppol directory lookup + send client
├── PeppolPanel.jsx   # Peppol lookup + send UI panel
├── storage.js        # Storage abstraction (localStorage)
├── constants.js      # Trade percentages, blank templates
├── utils.js          # Formatting, calculations
├── styles.js         # Shared inline style objects
└── Icons.jsx         # SVG icon components

functions/
├── _middleware.js # Extracts user identity from Cloudflare Access JWT
└── api/
    ├── auth/
    │   └── me.js     # Returns current user identity
    ├── vies.js       # Cloudflare Pages Function — VIES proxy
    ├── kvk.js        # Cloudflare Pages Function — KvK proxy
    └── peppol/
        ├── lookup.js # Peppol Directory lookup proxy
        └── send.js   # Peppol Access Point send proxy
```

## Storage Layer

Currently uses `localStorage` via the abstraction in `src/storage.js`. Every method is `async` so you can swap to a backend without changing any component code.

### Upgrading to Supabase

1. `npm install @supabase/supabase-js`
2. Replace the implementations in `storage.js`:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export async function storageGet(key, fallback) {
  const { data, error } = await supabase
    .from('kv_store')
    .select('value')
    .eq('key', key)
    .single()
  if (error || !data) return fallback
  return JSON.parse(data.value)
}

export async function storageSet(key, value) {
  await supabase
    .from('kv_store')
    .upsert({ key, value: JSON.stringify(value) })
}
```

3. Add auth with `supabase.auth` for multi-user support.

### Upgrading to Cloudflare D1

If you prefer staying fully in the Cloudflare ecosystem, use D1 (serverless SQLite) with a Worker function:

1. Create a D1 database: `npx wrangler d1 create bouwfactuur-db`
2. Add a `/functions/api/storage.js` Pages Function
3. Point `storage.js` to fetch from your API

## KvK API

The app uses the KvK Zoeken API to look up companies by KvK number. It works out of the box with the **free test environment** (limited to fictitious data like "Test BV Donald").

To use real company data, you need a KvK API subscription:

1. Apply at [developers.kvk.nl](https://developers.kvk.nl/apply-for-apis)
2. Get your API key from the KvK Developer Portal
3. In Cloudflare Pages → Settings → Environment variables, add: `KVK_API_KEY` = your key
4. Redeploy — the proxy function will automatically use the production endpoint

## Authentication (Cloudflare Access)

The app supports Cloudflare Access for authentication. When enabled, users log in via email OTP (one-time PIN) — no passwords needed. Each user's data (profile, clients, invoices) is automatically isolated.

### Setup (5 minutes)

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Access → Applications
2. Click **Add an application** → **Self-hosted**
3. Configure:
   - **Application name:** BouwFactuur
   - **Session duration:** 24 hours (or your preference)
   - **Application domain:** `bouwfactuur.pages.dev` (or your custom domain)
4. Add a policy:
   - **Policy name:** Allow users
   - **Action:** Allow
   - **Include rule:** Emails ending in `@yourdomain.com` (or specific email addresses)
5. For the identity provider, **One-time PIN** works out of the box (no IdP setup needed)
6. Save — authentication is now active

### How it works

- Cloudflare Access handles the entire login flow (login page, email OTP, session management)
- The app's `functions/_middleware.js` extracts the user email from the `Cf-Access-Jwt-Assertion` header
- The frontend calls `/api/auth/me` on load to get the current user's identity
- Storage keys are scoped per user — each user gets their own profile, clients, and invoice history
- The user's email appears in the header with a logout link
- Logout URL: `/cdn-cgi/access/logout` (handled by Cloudflare)

### Free tier

Cloudflare Access is free for up to 50 users, which is plenty for an early-stage micro-SaaS.

## Peppol e-Invoicing

The app includes a **Peppol Directory lookup** (free, no setup needed) to check if a recipient can receive invoices via the Peppol network. This uses the public directory at `directory.peppol.eu`.

To actually **send** invoices via Peppol, you need a subscription with a Peppol Access Point provider. Recommended NL providers:

- **[Storecove](https://www.storecove.com)** — NL-based, free 30-day sandbox, REST API
- **[eConnect](https://econnect.eu)** — construction-sector focused, DICO integration

### Setup

1. Sign up with your chosen provider and get an API key
2. In Cloudflare Pages → Settings → Environment variables, add:
   - `PEPPOL_API_KEY` — your API key
   - `PEPPOL_PROVIDER` — `storecove` or `econnect` (default: storecove)
   - `PEPPOL_SENDER_ID` — your legal entity ID from the provider
3. Redeploy — the "Verzend via Peppol" button will become active

For Dutch companies, the Peppol participant ID uses scheme `0106` (KvK number).

## Roadmap

- [x] VIES API integration for BTW number validation
- [x] KvK API for auto-filling company details (test env; set `KVK_API_KEY` env var for production)
- [x] Improved color palette for readability
- [x] Light mode UI
- [x] DICO/NLCIUS UBL 2.1 XML export
- [x] Peppol e-invoicing support (directory lookup + send via Access Point)
- [x] Authentication via Cloudflare Access (email OTP, per-user data isolation)
- [ ] Server-side PDF generation (Cloudflare Worker + Puppeteer)
- [ ] Cloudflare D1 for server-side storage
- [ ] Landing page for bouwbedrijven

## License

Private — not yet open source.

## Subscriptions (Stripe)

Freemium model: every account can create 2 invoices for free (lifetime counter in the `accounts` table, enforced in `PUT /api/storage/invoices` — a 402 response triggers the paywall). A Stripe subscription removes the limit. Enforcement only activates when `STRIPE_SECRET_KEY` is configured, so the app works unlimited-free until billing is set up.

Setup:

```text
1. Create a Stripe account; in the dashboard create a Product
   "BouwFactuur Pro" with a recurring monthly Price (EUR)
2. Payment methods: enable iDEAL, Cards and SEPA Direct Debit
   (iDEAL first payment → SEPA for renewals)
3. Developers → Webhooks → Add endpoint:
   https://bouwfactuur.pages.dev/api/billing/webhook
   Events: checkout.session.completed,
           customer.subscription.updated,
           customer.subscription.deleted
4. Settings → Billing → Customer portal: activate (default config)
5. Config:
   - wrangler.toml [vars]: STRIPE_PRICE_ID = "price_..." (commit)
   - npx wrangler pages secret put STRIPE_SECRET_KEY --project-name bouwfactuur
   - npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name bouwfactuur
6. Test with Stripe test mode keys first (test iDEAL always succeeds)
```

Endpoints: `GET /api/account` (plan, usage, price), `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/billing/webhook` (signature-verified). Webhook authenticity is checked with an HMAC over the raw body; subscription state lands in `accounts.subscription_status` / `current_period_end`.
