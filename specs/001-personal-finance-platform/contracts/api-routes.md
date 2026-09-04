# Contract: Next.js API Routes

**Revised 2026-08-09 (research.md R7)**: the original `POST /api/qa` route (an in-app Claude
API Tool Runner loop) is **superseded** — no in-app Q&A chat endpoint exists anymore. Q&A is
now delivered via the MCP server ([mcp-server.md](mcp-server.md), `/api/mcp`) and GPT
Actions ([gpt-actions.md](gpt-actions.md), `/api/actions/*`). This file covers the
session-authenticated APIs consumed by the dashboard. They use Gio's browser session and
RLS; none uses `SUPABASE_SERVICE_ROLE_KEY`.

## `GET /api/dashboard-metrics`

Aggregated metrics for the dashboard (FR-009, FR-010), computed via the same
`lib/supabase/queries.ts` functions the Q&A tools use — one code path for all reads
(constitution Principle I traceability, and avoids two implementations disagreeing).

**Query params**: `date_from`, `date_to` (both optional; omitted = all-time).

**Response `200`**:
```json
{
  "net_worth": {
    "by_currency": { "USD": { "total_assets": 3639.58, "total_liabilities": 0 }, "COP": { "total_assets": 8500000, "total_liabilities": 2000000 } },
    "converted_cop": { "total_assets": 22206932.0, "total_liabilities": 2000000, "net": 20206932.0 },
    "rates_used": [{ "currency": "USD", "rate_to_cop": 4100.5, "effective_date": "2026-08-01" }],
    "unconverted_currencies": []
  },
  "assets_by_category": [{ "category": "crypto", "amount": 3639.58, "currency": "USD" }],
  "liabilities_by_category": [],
  "income_vs_expense": { "income": 5000000, "expense": 3200000 },
  "income_by_category": [{ "category": "salary", "amount": 5000000 }],
  "spending_by_category": [{ "category": "health", "amount": 100500 }],
  "date_range": { "from": "2026-07-01", "to": "2026-07-31" },
  "has_data": true
}
```

`has_data: false` (with all numeric fields empty/zeroed) signals the explicit empty state
required by FR-011 — the dashboard MUST render this as "no data for this range," not a
misleading zero-value chart.

**Note on currency mixing and net worth conversion** (revised 2026-08-09, research.md R8,
spec FR-009/FR-014/FR-022): `net_worth.by_currency` never mixes currencies — one bucket per
currency present in `snapshots`, matching FR-014's "no combining without stating so."
`net_worth.converted_cop` is the COP-converted total the dashboard displays as "current net
worth" (FR-009), computed using the latest applicable row per currency from `exchange_rates`
(`rates_used` lists exactly which rate/date was applied, per FR-009's "display the rate(s)
and effective date(s)" requirement). Any currency present in `snapshots` with no configured
rate is listed in `unconverted_currencies` and excluded from `converted_cop` — the UI MUST
show it flagged explicitly, never silently omitted or guessed.

## `GET /api/exchange-rates` / `POST /api/exchange-rates`

**Added 2026-08-09 (research.md R8, spec FR-022)**. Dashboard-only (session-authenticated,
not a Q&A/Actions tool — see plan.md Project Structure for why). Backs the
`/dashboard/settings` rate editor.

- `GET`: returns every currency's most recent rate row: `[{ "currency": "USD", "rate_to_cop": 4100.5, "effective_date": "2026-08-01", "updated_at": "..." }, ...]`.
- `POST`: body `{ "currency": "USD", "rate_to_cop": 4100.5, "effective_date": "2026-08-01" }` — **upserts** on `(owner_id, currency, effective_date)` (fixed post-`/speckit-analyze`, finding A1): inserts a new `exchange_rates` row for a new `(currency, effective_date)` pair, preserving history across different dates; posting the same `(currency, effective_date)` pair again updates that row's `rate_to_cop`/`updated_at` in place instead of creating a duplicate — this is what makes "the most recent applicable rate" unambiguous, since two rows can never tie on `effective_date` for the same currency. Net-worth conversion always picks the latest `effective_date` per currency, see data-model.md.

## `GET /api/snapshots` / `POST /api/snapshots` / `PATCH /api/snapshots/:id`

Browser-session-authenticated API for `/dashboard/net-worth` (FR-029).

- `GET`: accepts optional `kind`, `category`, and `institution`; returns the latest row for
  each `item_id`, plus complete `categories` and `currencies` catalogs.
- `POST`: creates one asset or liability. Required fields are `snapshot_date`, `name`,
  `kind`, `category`, `amount`, and `currency`; `institution` and `notes` are nullable.
- `PATCH /:id`: replaces the editable fields of the owner-scoped snapshot while preserving
  its `item_id`.

The endpoint never accepts a `net_worth` value. Net worth is always recomputed from current
assets minus current liabilities, separated by currency and converted only through the
configured exchange-rate table. A successful create or edit sets the migration lock so a
later CSV import cannot silently overwrite dashboard-maintained values.

## `GET /api/snapshot-history`

Browser-session-authenticated API for the historical charts in `/dashboard/net-worth`.
It reads the complete owner-scoped snapshot history and returns:

- `general`: per-currency time series with assets, liabilities, and derived net worth;
- `items`: a time series for each asset or liability identity, grouped by kind, normalized
  name, category, institution, and currency;
- `currencies` and `row_count` for selectors and empty states.

General totals carry forward the most recent known valuation of each identity at every
recorded date. Currencies remain separate and are never summed implicitly.

## `GET /api/transactions`

Returns the transaction detail used by `/dashboard/movements`.

**Query params** (all optional): `type` (`income` or the persisted legacy value
`expensive`), `category`, `date_from`, and `date_to`. Dates are inclusive and use
`YYYY-MM-DD`.

Rows are ordered by `transaction_date` descending and then `created_at` descending. The
response contains up to 500 matching detail rows and a complete unique category catalog;
the catalog is read in pages so Supabase's per-request limit does not truncate it.

```json
{
  "rows": [{
    "transaction_id": "uuid",
    "description": "Pago de nómina",
    "type": "income",
    "amount": 5000000,
    "category": "salary",
    "transaction_date": "2026-08-15"
  }],
  "row_count": 1,
  "categories": ["administration", "salary"]
}
```

The UI defaults to the current month (`date_from` = first day, `date_to` = today). This is
a UI default; omitted API dates still mean all-time.

## `POST /api/transactions`

Creates one transaction owned by the authenticated user and returns it with `201`.

```json
{
  "description": "Pago de nómina",
  "type": "income",
  "amount": 5000000,
  "category": "salary",
  "transaction_date": "2026-08-15"
}
```

Description, category, positive amount, valid type, and ISO date are required.

## `PATCH /api/transactions/:id` / `DELETE /api/transactions/:id`

- `PATCH` validates the full transaction payload and returns the updated row.
- `DELETE` permanently removes the transaction and returns its `transaction_id`. The UI
  asks for confirmation before calling it.

Both operations are scoped to `auth.uid()` through RLS.

## `GET /api/transaction-history`

Reads all transactions in pages of 500 and aggregates values by calendar month, type, and
category for `/dashboard/history`. Unlike the detail route, it processes the full history.

```json
{
  "months": ["2025-01", "2025-02"],
  "income": {
    "categories": ["salary"],
    "series": [{ "month": "2025-01", "values": { "salary": 5000000 } }]
  },
  "expense": {
    "categories": ["food", "health"],
    "series": [{ "month": "2025-01", "values": { "food": 450000, "health": 100500 } }]
  },
  "row_count": 2702
}
```

The UI presents the eight categories with the highest historical value as stacked bars.
Selecting a category renders its monthly trend as a line chart.

## Common responses

- `401`: missing or invalid dashboard session.
- `400`: validation, query, or Supabase error; body `{ "error": "..." }`.
