# BouwFactuur

Compliant invoicing tool for Dutch construction companies. Handles BTW verlegd (VAT reverse charge), G-rekening splits, Wet Ketenaansprakelijkheid documentation, and trade-specific deposit percentages.

## Features

- **BTW verlegd** — automatic VAT reverse charge notation per art. 12 lid 5 Wet OB 1968
- **G-rekening splitsing** — labor/material separation with trade-specific percentages (source: Bouwend Nederland)
- **Wka-vermelding** — mandatory chain liability documentation on every invoice
- **PDF export** — clean A4 print layout via browser print-to-PDF
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
├── storage.js        # Storage abstraction (localStorage)
├── constants.js      # Trade percentages, blank templates
├── utils.js          # Formatting, calculations
├── styles.js         # Shared inline style objects
└── Icons.jsx         # SVG icon components
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

## Roadmap

- [ ] VIES API integration for BTW number validation
- [ ] KvK API for auto-filling company details
- [ ] DICO SALES005 XML export
- [ ] Peppol e-invoicing support
- [ ] Server-side PDF generation (Cloudflare Worker + Puppeteer)
- [ ] Authentication (Supabase Auth or Cloudflare Access)
- [ ] Landing page for bouwbedrijven

## License

Private — not yet open source.
