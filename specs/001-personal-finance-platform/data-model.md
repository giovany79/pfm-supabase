# Phase 1 Data Model: Personal Finance Platform

Derived from the spec's Key Entities section, mapped to the Supabase (Postgres) schema.
Column-to-source mapping is explicit per constitution Principle I ("column semantics MUST
be mapped explicitly and documented — not inferred silently by migration code").

## Entity: `snapshots` (Financial Snapshot)

A point-in-time record of a single asset or liability. Source: `balance-sheet.csv`.

| Column | Type | Source column | Notes |
|---|---|---|---|
| `item_id` | `uuid` (PK) | `item_id` | Natural key from source; used for idempotent upsert |
| `snapshot_date` | `date` | `snapshot_date` | |
| `name` | `text` | `name` | e.g. "Cryptos en Wenia" |
| `kind` | `text` | `kind` | `asset` \| `liability` (validated against this enum at insert) |
| `category` | `text` | `category` | e.g. `crypto` — free text, not a closed enum (source data may add categories) |
| `amount` | `numeric(14,2)` | `amount` | Preserved at source precision — never rounded |
| `currency` | `text` | `currency` | ISO-ish currency code as recorded in source (e.g. `USD`) — never converted at storage time (constitution: preserve original currency) |
| `institution` | `text` | `institution` | Nullable |
| `notes` | `text` | `notes` | Nullable |
| `owner_id` | `uuid` (FK → `auth.users`) | *(set by migration script, not source)* | RLS scope column |
| `created_at` | `timestamptz` | *(set by DB default)* | Migration insert time, not `snapshot_date` |

**Validation rules** (enforced by migration script before upsert, FR-003):
- `snapshot_date` must parse as a valid date
- `amount` must parse as a number
- `kind` must be one of `asset` / `liability`
- `item_id`, `name`, `category`, `currency` must be non-empty

**Indexes**: `(owner_id, snapshot_date)`, `(owner_id, category)`, `(owner_id, kind)` — support
the date-range and category/kind filtering required by FR-005 and the dashboard.

## Entity: `transactions` (Transaction)

A single income or expense event. Source: `pfm-gio.csv`.

| Column | Type | Source column | Notes |
|---|---|---|---|
| `transaction_id` | `uuid` (PK) | `transaction_id` | Natural key from source; used for idempotent upsert |
| `description` | `text` | `Description` | |
| `type` | `text` | `Income/expensive` | `income` \| `expensive` as literally recorded in source (constitution: column semantics mapped explicitly, not silently reinterpreted — see Assumptions in spec.md re: the source's literal category values) |
| `amount` | `numeric(14,2)` | `Amount` | Preserved at source precision |
| `category` | `text` | `Category` | Free text, e.g. `health` |
| `transaction_date` | `date` | `Date` | Renamed from source `Date` to avoid the reserved word `date` as a bare column name |
| `owner_id` | `uuid` (FK → `auth.users`) | *(set by migration script, not source)* | RLS scope column |
| `created_at` | `timestamptz` | *(set by DB default)* | Migration insert time |

**Validation rules** (FR-003):
- `transaction_date` must parse as a valid date
- `amount` must parse as a number
- `type` must be one of `income` / `expensive` (the source's literal values — not
  normalized to `income`/`expense`, to avoid silently reinterpreting the source per
  constitution Principle I; the application layer labels these for display)
- `transaction_id`, `description`, `category` must be non-empty

**Indexes**: `(owner_id, transaction_date)`, `(owner_id, category)`, `(owner_id, type)`.

**Note — no currency column**: per spec Assumptions, transaction amounts are assumed to be
in a single consistent currency as recorded in the source file (no explicit currency field
exists in `pfm-gio.csv`). This is documented, not inferred silently.

**Note — mutable, hard-delete (added 2026-08-09, research.md R8, spec FR-015–FR-018,
FR-023)**: any row in this table, including one originally migrated from `pfm-gio.csv`, MAY
be updated or permanently `DELETE`d as the result of a confirmed
`confirm_transaction_change` call (see the Transaction Change Command entities below). Per
FR-018, the system does not retain a soft-delete flag, prior-version row, or any other
recoverable copy — an edit overwrites the row in place and a delete removes it outright.
`system_state.pfm_gio_migration_locked` (below) is what keeps a later migration re-run from
undoing that, not a backup of the row itself.

## Entity: `qa_queries` (Tool-Call Audit Log — for traceability)

**Revised 2026-08-09 (research.md R7)**: Q&A is now delivered via a Claude.ai custom
connector (MCP) and a ChatGPT Custom GPT (Actions) — see research.md R7 — rather than an
in-app chat loop this system fully controls. This system therefore never sees the
original question or the final answer text (those stay inside claude.ai/chatgpt.com); it
only sees each individual tool invocation. `qa_queries` is repurposed accordingly: it is
the audit trail of *what data was accessed*, not a transcript of Q&A exchanges. This still
satisfies constitution Principle V's traceability requirement at the tool-call level (every
number the calling model could have used is logged with its row count), though — per the
constitution's "Q&A delivery surface" constraint — this system cannot verify end-to-end that
a specific answer text matches its supporting calls, since the answer is composed outside
this system's boundary.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Generated |
| `owner_id` | `uuid` (FK → `auth.users`) | RLS scope column — always Gio, since only his bearer token can call these tools |
| `channel` | `text` | `mcp` \| `action` — which surface made the call (`check (channel in ('mcp', 'action'))`) |
| `tool_name` | `text` | `query_transactions` \| `query_snapshots` \| `aggregate_transactions` |
| `input` | `jsonb` | The exact parameters the calling model passed |
| `row_count` | `integer` | Rows (or aggregate groups) returned — `0` signals a no-match case the calling model was instructed to report as "cannot answer" |
| `created_at` | `timestamptz` | Default `now()` |

**Indexes**: `(owner_id, created_at desc)` — lets Gio review recent tool activity from
either surface if he ever wants to audit what was accessed.

**Note**: the `question`/`answer` text fields from the original design are dropped — there
is no reliable value to populate them with once the chat loop lives outside this system. If
an in-app Q&A UI is ever added back (research.md R7's "Alternatives considered"), a
`question`/`answer` pair can be reintroduced for that channel specifically.

## Entity: `pending_transaction_changes` (Transaction Change Command — proposed, unconfirmed)

**Added 2026-08-09 (research.md R8, spec FR-016)**. A short-lived, transient record of an
interpreted create/edit/delete request awaiting Gio's confirmation. **This is application
state, not an audit log** — it necessarily holds real proposed field values (amount,
description, category) so `confirm_transaction_change` can apply them, and is deleted
immediately once consumed or expired. The permanent, redacted audit trail is
`transaction_mutations` below.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Returned to the calling model as the confirmation handle |
| `owner_id` | `uuid` (FK → `auth.users`) | RLS scope column — always Gio |
| `operation` | `text` | `create` \| `edit` \| `delete` (`check` constraint) |
| `target_transaction_id` | `uuid` (nullable, **not** a foreign key — fixed post-`/speckit-analyze`, finding CA2) | Required for `edit`/`delete` (resolved from a prior `query_transactions` call, FR-016); null for `create`. Deliberately unconstrained by a FK: a permanent `DELETE` of the referenced transaction (FR-018) must never be blocked by, or block, this row |
| `proposed_fields` | `jsonb` | The interpreted field values (date, description, amount, category, type) for `create`, or the changed subset for `edit`; unused for `delete` |
| `created_at` | `timestamptz` | Default `now()` |
| `expires_at` | `timestamptz` | `created_at` + 5 minutes — the server-side proxy for "Gio's immediate next message" (FR-016); `confirm_transaction_change` rejects any call after this |

**No `consumed_at` column** (removed 2026-08-09 post-`/speckit-analyze`, finding CA2): a
prior draft tracked consumption with a `consumed_at` flag while leaving the row — with its
real `proposed_fields` financial values — in place indefinitely. No task ever deleted those
rows, which risked exactly the plaintext financial-data retention constitution Principle II
prohibits. The design is simpler and safer without that column: `confirm_transaction_change`
**deletes the row** as part of the same operation that applies (or fails to apply) the
change — see `research.md` R8 §8.1/§8.3. A second confirm attempt on the same
`pending_change_id`, or an attempt past `expires_at` (deleted at that point too), both
resolve to "not found" — there is no separate "already consumed" state to track, and nothing
with real financial values is ever left behind for a cleanup job to find.

**Indexes**: `(owner_id, id)` for the confirm lookup. Rows never accumulate: every row is
either deleted by the `confirm_transaction_change` call that consumes it, or deleted by the
next call (propose or confirm) from the same owner that finds it past `expires_at`.

## Entity: `transaction_mutations` (Mutation Audit Log — permanent, redacted)

**Added 2026-08-09 (research.md R8, constitution v1.2.0 "Mutation confirmation & audit
logging", closes analysis finding CA3)**. The permanent record of every mutation attempt.
Deliberately excludes any financial field value — this is what satisfies constitution
Principle II's "no plaintext financial data in logs" for the mutation surface, the same way
`qa_queries.input` (filters only, e.g. a date range) satisfies it for reads.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Generated |
| `owner_id` | `uuid` (FK → `auth.users`) | RLS scope column |
| `channel` | `text` | `mcp` \| `action` — which surface initiated the mutation |
| `tool_name` | `text` | `confirm_transaction_change` (the only tool that actually mutates data — `propose_transaction_change` calls are not separately audited here since they change nothing) |
| `operation` | `text` | `create` \| `edit` \| `delete` (`check` constraint) |
| `transaction_id` | `uuid` (nullable, **not** a foreign key — fixed post-`/speckit-analyze`, finding CA2) | The affected transaction's ID; null only if the confirm call failed before a row could be identified (e.g. expired pending-change). Deliberately unconstrained: logging a permanent `delete` audit row for a transaction that no longer exists must never fail a FK check, and a `DELETE` on `transactions` must never be blocked by an existing audit reference to it |
| `actor` | `text` | Always `'gio'` for this single-owner system — present for schema clarity/future-proofing, not because it varies |
| `outcome` | `text` | `success` \| `failure` (`check` constraint) |
| `created_at` | `timestamptz` | Default `now()` |

**Indexes**: `(owner_id, created_at desc)` — lets Gio review recent mutations, mirroring
`qa_queries`'s audit-review index.

**What is deliberately absent**: `amount`, `description`, `category`, or any other real
financial value. If Gio needs to see what a past edit/delete changed, the only place to look
is `transactions` itself (for the current state) — per FR-018 there is no recoverable prior
value, by design.

## Entity: `exchange_rates` (Exchange Rate)

**Added 2026-08-09 (research.md R8, spec FR-009/FR-022)**. Gio-maintained conversion rates
to COP, the net-worth base currency. Edited from `/dashboard/settings`, never fetched from
an external FX API.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Generated |
| `owner_id` | `uuid` (FK → `auth.users`) | RLS scope column |
| `currency` | `text` | Source currency code, e.g. `USD` — matches `snapshots.currency` values |
| `rate_to_cop` | `numeric(18,6)` | 1 unit of `currency` = this many COP |
| `effective_date` | `date` | The date this rate applies from |
| `updated_at` | `timestamptz` | Default `now()`, refreshed on every edit |

**Selection rule**: net-worth conversion uses, per currency present in `snapshots`, the row
with the greatest `effective_date` not in the future. A `unique (owner_id, currency,
effective_date)` constraint (fixed post-`/speckit-analyze`, finding A1) guarantees this is
never ambiguous — two rates for the same currency can never share an `effective_date`, so
there is no tie to break; a `POST` for an existing `(currency, effective_date)` pair updates
that row's `rate_to_cop`/`updated_at` instead of creating a duplicate (see
`contracts/api-routes.md`). A `snapshots.currency` value with no matching row here is
excluded from the converted total and flagged explicitly in the dashboard response
(`GET /api/dashboard-metrics`, `net_worth.unconverted_currencies`) rather than guessed.

**Indexes**: `(owner_id, currency, effective_date desc)` (the unique constraint above
already provides this index).

## Entity: `system_state` (Migration Lock)

**Added 2026-08-09 (research.md R8, spec FR-023, closes analysis finding I2)**. A
single-row-per-owner flag preventing `pfm-gio.csv` from being fully re-migrated after a
conversational mutation has been confirmed against previously-imported data, which could
otherwise silently resurrect an edited/deleted transaction via the existing upsert-on-
natural-key idempotency (research.md R3).

| Column | Type | Notes |
|---|---|---|
| `owner_id` | `uuid` (PK, FK → `auth.users`) | One row per owner (i.e., one row, ever, for this system) |
| `pfm_gio_migration_locked` | `boolean` | Default `false`; set `true` by `confirm_transaction_change` on its first successful mutation |
| `locked_at` | `timestamptz` (nullable) | When the lock was set |

`scripts/migrate.ts` reads this before processing `pfm-gio.csv` and refuses to proceed
(printing an explanatory message) unless invoked with an explicit `--force` override —
see research.md R8 §8.5.

## Relationships

- `snapshots.owner_id` and `transactions.owner_id` both reference `auth.users(id)` — the
  single owner. No relationship exists *between* `snapshots` and `transactions` (they are
  independent entities per the spec); any cross-entity view (e.g. "net worth over time
  alongside spending") is computed at the query/aggregation layer, not via a foreign key.
- `qa_queries` has no foreign key to `snapshots`/`transactions` — the `input` JSONB column
  records *which* filters were used, not a hard reference, since a call may match zero, one,
  or many rows across either table.
- `pending_transaction_changes.target_transaction_id` and
  `transaction_mutations.transaction_id` both **hold** a `transactions.transaction_id`
  value for `edit`/`delete` operations, but neither is declared as a foreign key (fixed
  post-`/speckit-analyze`, finding CA2) — a real FK here would either block a permanent
  `DELETE` of the target row (FR-018) or block writing the audit row for that same delete,
  depending on write order. Both columns are historical/lookup values only.
- `exchange_rates.owner_id` and `system_state.owner_id` both reference `auth.users(id)`,
  same single-owner pattern as every other table.

## Row Level Security

Every table (`snapshots`, `transactions`, `qa_queries`, `pending_transaction_changes`,
`transaction_mutations`, `exchange_rates`, `system_state`) has RLS enabled with a single
policy: `owner_id = auth.uid()` for `SELECT`/`INSERT`/`UPDATE`/`DELETE`. No table is publicly
readable (constitution Principle II).

**Revised 2026-08-09 (research.md R8, closes analysis finding I1)** — client usage is no
longer ambiguous:
- **`scripts/migrate.ts` (migration CLI) is the only caller of the service-role key**
  (`lib/supabase/service-role-client.ts`). It bypasses RLS deliberately, to set `owner_id` on
  insert before any user session exists — this is the sole, intentional exception, confined
  to a one-off, human-run script that never serves an HTTP request.
- **Every runtime path is RLS-scoped via a real `auth.uid()`-bearing session — via two
  distinct mechanisms** (spelled out separately per a later `/speckit-analyze` correction,
  finding CA1, since collapsing them into one caused a real access-control ambiguity):
  the **dashboard** uses its own interactive Supabase Auth browser login session (Gio's own
  cookie, research.md R5); **`/api/mcp` and `/api/actions/*`** — which have no browser
  session — use `lib/supabase/session-client.ts`, a refresh-token exchange that still
  produces a genuine `auth.uid()`-bearing session (research.md R8 §8.2). RLS is therefore
  the actual enforcement mechanism for every runtime query and mutation, not a second check
  that happens to agree with an application-level filter. See `contracts/database-schema.md`
  for the exact policy SQL and `research.md` R8 for the full rationale.
