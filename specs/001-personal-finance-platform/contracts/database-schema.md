# Contract: Database Schema (Supabase / Postgres)

Source of truth for table shape; see [data-model.md](../data-model.md) for entity
rationale and column-to-source mapping.

```sql
-- snapshots: asset/liability point-in-time records (source: balance-sheet.csv)
create table snapshots (
  item_id uuid primary key,
  owner_id uuid not null references auth.users(id),
  snapshot_date date not null,
  name text not null,
  kind text not null check (kind in ('asset', 'liability')),
  category text not null,
  amount numeric(14,2) not null,
  currency text not null,
  institution text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_snapshots_owner_date on snapshots (owner_id, snapshot_date);
create index idx_snapshots_owner_category on snapshots (owner_id, category);
create index idx_snapshots_owner_kind on snapshots (owner_id, kind);

alter table snapshots enable row level security;

create policy "owner full access" on snapshots
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- transactions: income/expense/saving events (source: pfm-gio.csv and application writes)
create table transactions (
  transaction_id uuid primary key,
  owner_id uuid not null references auth.users(id),
  description text not null,
  type text not null check (type in ('income', 'expensive', 'saving')),
  amount numeric(14,2) not null,
  category text not null,
  transaction_date date not null,
  created_at timestamptz not null default now()
);

create index idx_transactions_owner_date on transactions (owner_id, transaction_date);
create index idx_transactions_owner_category on transactions (owner_id, category);
create index idx_transactions_owner_type on transactions (owner_id, type);

alter table transactions enable row level security;

create policy "owner full access" on transactions
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- qa_queries: tool-call audit log (revised 2026-08-09, research.md R7 — Q&A now runs via
-- an MCP connector and GPT Actions, so this system only ever sees individual tool calls,
-- never the original question or the composed answer; see data-model.md for the rationale)
create table qa_queries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  channel text not null check (channel in ('mcp', 'action')),
  tool_name text not null check (tool_name in ('query_transactions', 'query_snapshots', 'aggregate_transactions')),
  input jsonb not null,
  row_count integer not null,
  created_at timestamptz not null default now()
);

create index idx_qa_queries_owner_created on qa_queries (owner_id, created_at desc);

alter table qa_queries enable row level security;

create policy "owner full access" on qa_queries
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- pending_transaction_changes: transient, unconfirmed create/edit/delete requests
-- (added 2026-08-09, research.md R8, spec FR-016) — NOT an audit log; holds real proposed
-- field values only until confirmed or expired. There is no consumed_at flag: the row is
-- deleted outright by the confirm_transaction_change call that consumes it (or by the next
-- call that finds it past expires_at), so it never persists once it's no longer needed
-- (revised post-/speckit-analyze, finding CA2 — a marked-not-deleted design left financial
-- field values in proposed_fields indefinitely with no task to clean them up). See
-- transaction_mutations below for the permanent, redacted record.
-- target_transaction_id is a plain uuid, NOT a foreign key (fixed post-/speckit-analyze,
-- finding CA2): for edit/delete this row references a transactions row that a confirmed
-- delete must be free to remove permanently (FR-018) without a FK blocking either the
-- DELETE (if this row still exists and references it) or, symmetrically, a later insert
-- referencing an id that no longer exists. It is a historical/lookup value only.
create table pending_transaction_changes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  operation text not null check (operation in ('create', 'edit', 'delete')),
  target_transaction_id uuid,
  proposed_fields jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index idx_pending_changes_owner on pending_transaction_changes (owner_id, id);

alter table pending_transaction_changes enable row level security;

create policy "owner full access" on pending_transaction_changes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- transaction_mutations: permanent, redacted mutation audit log (added 2026-08-09,
-- research.md R8, constitution v1.2.0 "Mutation confirmation & audit logging" — closes
-- analysis finding CA3). Deliberately has NO column for amount/description/category/any
-- other financial field value — see data-model.md for the rationale.
-- transaction_id is a plain uuid, NOT a foreign key (fixed post-/speckit-analyze, finding
-- CA2): a real, permanent DELETE of the referenced transactions row (FR-018) must never be
-- blocked by — or block — writing this audit row. Logging before the delete would leave a
-- dangling FK reference that then prevents the DELETE (default RESTRICT behavior); logging
-- after the delete would fail the FK insert instead. Since this column's only purpose is a
-- historical record of which transaction_id was affected, it deliberately carries no
-- referential-integrity constraint.
create table transaction_mutations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  channel text not null check (channel in ('mcp', 'action')),
  tool_name text not null default 'confirm_transaction_change',
  operation text not null check (operation in ('create', 'edit', 'delete')),
  transaction_id uuid,
  actor text not null default 'gio',
  outcome text not null check (outcome in ('success', 'failure')),
  created_at timestamptz not null default now()
);

create index idx_transaction_mutations_owner_created on transaction_mutations (owner_id, created_at desc);

alter table transaction_mutations enable row level security;

create policy "owner full access" on transaction_mutations
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- snapshot_mutations: permanent redacted audit for confirmed asset/liability creates/edits
create table snapshot_mutations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  channel text not null check (channel in ('mcp', 'action')),
  tool_name text not null default 'confirm_snapshot_change',
  operation text not null check (operation in ('create', 'edit')),
  item_id uuid,
  actor text not null default 'gio',
  outcome text not null check (outcome in ('success', 'failure')),
  created_at timestamptz not null default now()
);

create index idx_snapshot_mutations_owner_created
  on snapshot_mutations (owner_id, created_at desc);

alter table snapshot_mutations enable row level security;

create policy "owner full access" on snapshot_mutations
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- exchange_rates: Gio-maintained currency -> COP conversion table (added 2026-08-09,
-- research.md R8, spec FR-009/FR-022) — manual only, never fetched from an external API.
-- unique(owner_id, currency, effective_date) makes the "most recent applicable rate"
-- selection unambiguous by construction (fixed post-/speckit-analyze, finding A1) — two
-- rates for the same currency can never share an effective_date, so there is never a tie
-- to break. A POST for an existing (currency, effective_date) pair upserts rate_to_cop and
-- updated_at instead of creating a duplicate row — see contracts/api-routes.md.
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  currency text not null,
  rate_to_cop numeric(18,6) not null,
  effective_date date not null,
  updated_at timestamptz not null default now(),
  unique (owner_id, currency, effective_date)
);

create index idx_exchange_rates_owner_currency_date on exchange_rates (owner_id, currency, effective_date desc);

alter table exchange_rates enable row level security;

create policy "owner full access" on exchange_rates
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- system_state: single-row-per-owner migration lock (added 2026-08-09, research.md R8,
-- spec FR-023, closes analysis finding I2).
create table system_state (
  owner_id uuid primary key references auth.users(id),
  pfm_gio_migration_locked boolean not null default false,
  locked_at timestamptz
);

alter table system_state enable row level security;

create policy "owner full access" on system_state
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

## Notes

- No table is readable without a matching `owner_id = auth.uid()` policy — there is no
  public or anon-readable table (constitution Principle II).
- `kind` and `type` use `check` constraints rather than a separate lookup table — the
  value sets are small, fixed, and drawn directly from the source CSVs' literal values
  (constitution Principle I: column semantics mapped explicitly, not inferred).
- **Migration only** runs with the Supabase **service role** key (server-side only, never
  exposed to the browser, never imported outside `scripts/migrate.ts`) so it can set
  `owner_id` on insert before any user session exists.
- **Revised 2026-08-09 (research.md R8, closes analysis finding I1; mechanism split
  clarified per finding CA1)** — every runtime path is RLS-scoped, with no service-role
  exception, via **two distinct session mechanisms** (see research.md R8 §8.2 — do not
  conflate these, that conflation was itself a flagged finding):
  - **Dashboard reads/writes** go through the authenticated user's own interactive Supabase
    Auth session (standard browser login, unrelated to the bullet below), so RLS applies
    end-to-end and only Gio's own logged-in browser can see anything (FR-012).
  - **MCP/Actions reads and mutations** are not browser sessions — claude.ai and ChatGPT
    call the Next.js API routes directly with a static bearer token
    (`MCP_ACTIONS_API_KEY`). Those routes verify the bearer token server-side first (this is
    the *caller* authentication layer — proves the request is from Gio's ChatGPT/Claude.ai),
    then perform the actual query/mutation using `lib/supabase/session-client.ts`, which
    exchanges a long-lived owner refresh token (`SUPABASE_OWNER_REFRESH_TOKEN`, env-var only)
    for a fresh Supabase Auth access token bound to Gio's real `user_id` — so
    `auth.uid() = owner_id` and RLS enforces the boundary exactly as it does for the
    dashboard, not via an application-level filter that could be missed. The service-role
    key is never reachable from this code path. This is the deliberately simple option for a
    single-owner system (constitution Principle IV) — minting per-request OAuth tokens for
    external API callers would add complexity with no second user to justify it; reusing
    Gio's own refresh token gets the same RLS guarantee without OAuth.
