# Cycle Shop Dashboard

A professional sales management dashboard for a cycle shop. Handles sale entry with auto-calculations, monthly Google Sheets sync, and downloadable sales reports.

## Run & Operate

- `pnpm --filter @workspace/cycle-shop run dev` — run the frontend (port assigned by artifact)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `GOOGLE_SHEETS_SPREADSHEET_ID` — ID of the Google Sheet to sync sales into

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Google Sheets: googleapis package + Replit connector for OAuth
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/sales.ts` — Sales table schema
- `artifacts/api-server/src/routes/sales.ts` — Sales API routes
- `artifacts/api-server/src/lib/calculations.ts` — SP / Final Price / Profit-Loss calculations
- `artifacts/api-server/src/lib/googleSheets.ts` — Google Sheets sync helpers
- `artifacts/cycle-shop/src/` — React frontend

## Calculations

- **Selling Price** = Buying Price × (1 + Profit Margin / 100)
- **Final Price** = Selling Price × (1 − Discount/100) × (1 + GST/100)
- **Profit**: if Final Price ≥ Buying Price → Profit Amount = Final Price − Buying Price; Profit % = (Profit Amount / Buying Price) × 100
- **Loss**: if Final Price < Buying Price → Loss Amount = Buying Price − Final Price; Loss % = (Loss Amount / Buying Price) × 100

## Google Sheets sync

Each new sale auto-syncs to the connected Google Sheet (if `GOOGLE_SHEETS_SPREADSHEET_ID` is set and Google Sheets connector is connected). Monthly sheets are created automatically (e.g. "July 2026"). The "Sync to Sheets" button on the dashboard does a full re-sync of all data.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before checking artifact typechecks (stale declarations cause false TS2305 errors)
- Google Sheets connector credentials are fetched fresh on every request — never cache the OAuth2 client
- Serial numbers (S.No) are scoped per month, not globally
