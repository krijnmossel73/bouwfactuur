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
- **Persistent storage** — company profiles, clients, and invoice history saved across sessions
- **Auto-numbering** — sequential invoice numbers that persist across sessions

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

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
├── storage.js        # Storage abstraction (localStorage)
├── constants.js      # Trade percentages, blank templates
├── utils.js          # Formatting, calculations
├── styles.js         # Shared inline style objects
└── Icons.jsx         # SVG icon components

functions/
└── api/
    ├── vies.js       # Cloudflare Pages Function — VIES proxy
    └── kvk.js        # Cloudflare Pages Function — KvK proxy
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

## Roadmap

- [x] VIES API integration for BTW number validation
- [x] KvK API for auto-filling company details (test env; set `KVK_API_KEY` env var for production)
- [x] Improved color palette for readability
- [x] Light mode UI
- [x] DICO/NLCIUS UBL 2.1 XML export
- [ ] Peppol e-invoicing support (direct submission via Peppol Access Point)
- [ ] Server-side PDF generation (Cloudflare Worker + Puppeteer)
- [ ] Authentication (Supabase Auth or Cloudflare Access)
- [ ] Landing page for bouwbedrijven

## License

Private — not yet open source.
