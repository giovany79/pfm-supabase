# Implementation Plan: Personal Finance Platform

**Branch**: `001-personal-finance-platform` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-personal-finance-platform/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Migrate Gio's personal finance history (`balance-sheet.csv` asset/liability snapshots,
`pfm-gio.csv` income/expense transactions) into Supabase (Postgres) as the single source
of truth, then build three capabilities on top of it: (1) complex querying directly against
the centralized data, (2) a web dashboard with key financial metrics and charts, and (3) a
natural-language Q&A **and mutation** assistant that answers questions and applies
Gio-confirmed create/edit/delete changes to transactions by calling narrow, parameterized
tools — never raw SQL — so every numeric answer is traceable to real rows, every mutation is
explicitly confirmed and audited, and the assistant can say "I don't know" instead of
guessing. Technical approach: a single Next.js (TypeScript) application backed by Supabase,
with a one-off idempotent migration script and dashboard pages reading directly from
Supabase.

**Revised 2026-08-09 (research.md R7)**: the Q&A capability is delivered through two chat
products Gio already has access to — a **ChatGPT Custom GPT (Actions)**, the mandatory
surface, and an optional/best-effort **Claude.ai custom connector (MCP)** — instead of a
bespoke in-app chat UI backed by a separately billed Anthropic API call. The same query
tools are exposed through both, sharing one implementation and one Supabase-scoped
data-access layer.

**Revised 2026-08-09 (research.md R8, constitution v1.2.0)**: the same conversational
surface also handles create/edit/permanent-delete of transactions (spec FR-015–FR-023),
resolved during a `/speckit-clarify` session that required amending the constitution's
prior read-only guarantee for this surface. Every mutation is a two-step,
explicitly-confirmed operation (`propose_transaction_change` → `confirm_transaction_change`)
gated on a short-lived pending-change record, never applied speculatively. This plan is
also revised to close two `/speckit-analyze` findings from that session: runtime data
access no longer uses the Supabase **service-role** key (that key is now confined to the
one-off migration script) — every dashboard, MCP, and Actions request instead runs through
an RLS-scoped session client, so no runtime path can bypass Row Level Security — and
mutation attempts are audited with a minimal, non-sensitive schema that never persists
financial field values in plaintext (constitution v1.2.0, "Mutation confirmation & audit
logging"). See research.md R8 for the full rationale.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ (single language across migration
script, dashboard, and Q&A backend — see research.md R1)

**Primary Dependencies**: Next.js 15 (App Router), `@supabase/supabase-js`,
`@modelcontextprotocol/sdk` (MCP server for the Claude.ai connector — see research.md R7),
Tailwind CSS, a lightweight charting library (Recharts) for the dashboard, `csv-parse` for
migration parsing. No Anthropic or OpenAI SDK is used — the Q&A feature calls neither
provider's API directly; it is invoked *by* claude.ai/ChatGPT via MCP/Actions, not the other
way around.

**Storage**: Supabase (managed Postgres) — system of record for all migrated financial
data; Supabase Auth for single-user login; Row Level Security scoping every table to the
authenticated owner. **Revised 2026-08-09 (research.md R8)**: the service-role key is used
**only** by the one-off migration CLI (`scripts/migrate.ts`); every runtime code path is
RLS-scoped via a real `auth.uid()`-bearing session, never service-role — the dashboard keeps
its own interactive Supabase Auth browser login (research.md R5, unchanged), while
`/api/mcp` and `/api/actions/*` (which have no browser session) use a refresh-token-exchange
session client instead (research.md R8 §8.2) — see that section for why these are two
distinct mechanisms, not one, per a `/speckit-analyze` correction (finding CA1).

**Testing**: Vitest for unit tests (CSV parsing, migration idempotency, tool-input
validation), Playwright for a small number of end-to-end smoke tests (dashboard loads,
Q&A returns a grounded answer) — see research.md R6

**Target Platform**: Web application (desktop/mobile browser) for the dashboard; local dev
via `next dev`. **Revised 2026-08-09 (research.md R7)**: unlike the dashboard, the MCP
server and GPT Actions endpoints require a live, publicly reachable HTTPS URL — `localhost`
is not reachable from claude.ai or chatgpt.com, so hosting can no longer be deferred for
this feature. Default: **Vercel** (zero-config for this stack, free tier is sufficient for
single-user traffic); self-hosting remains an option if preferred later.

**Project Type**: Single web application (Next.js merges frontend + backend API routes —
see Project Structure below for why this isn't the template's "web application" split
option)

**Performance Goals**: Dashboard metrics render within 3s of page load (spec SC-003);
Q&A answers (or explicit "cannot answer") returned within 10s (spec SC-004); complex
queries/dashboard views usable without opening the original spreadsheets in under 1 minute
(spec SC-002)

**Constraints**: No raw/dynamic SQL ever reachable from the LLM — only narrow, parameterized
query/mutation functions (constitution Principle II, V); every read tool call is logged to
`qa_queries` (tool name, filter input, row count) as the audit trail, since the calling chat
product composes the final answer outside this system's boundary (constitution Principle V,
"Q&A delivery surface" — revised 2026-08-09, research.md R7) — the traceability guarantee
this system can make is scoped to *what each tool call returns* (source record IDs plus the
computed aggregate), not the literal text the calling model composes (spec FR-007, revised
2026-08-09); migration MUST be idempotent and MUST NOT silently drop or reinterpret
malformed source rows (constitution Principle I); financial data MUST NOT be logged in
plaintext or sent to any external service beyond the scoped tool-call payloads Claude.ai/
ChatGPT already receive as the calling product (constitution Principle II); every MCP and
Actions request MUST be authenticated with the single-owner bearer token
(`MCP_ACTIONS_API_KEY`) before reaching the data layer (constitution "Q&A delivery
surface"); **added 2026-08-09 (research.md R8, constitution v1.2.0)**: any create/edit/
delete of a transaction MUST be a two-step propose-then-confirm operation gated on Gio's
explicit, freshly-stated confirmation, and every mutation attempt (success or failure) MUST
be logged to `transaction_mutations` with the constitution's minimal schema (tool name,
operation, affected transaction ID, timestamp, actor, outcome) — this log MUST NEVER contain
the transaction's financial field values (amount, description, category, institution) in
plaintext, per constitution Principle II and the "Mutation confirmation & audit logging"
rule; runtime data access (dashboard, MCP, Actions) MUST use an RLS-scoped session client,
never the service-role key, which is confined to the migration CLI (constitution Principle
II, closing analysis finding I1); after the first confirmed mutation, re-running the full
`pfm-gio.csv` migration MUST be blocked/warned rather than silently re-applied (spec
FR-023); net worth MUST convert multi-currency snapshots to COP using a Gio-maintained
exchange-rate table, never an external FX API call (spec FR-009, FR-022); ChatGPT is the
mandatory Q&A/mutation delivery surface — Claude.ai is optional/best-effort and does not
gate any success criterion (spec Assumptions, 2026-08-09)

**Scale/Scope**: Single user (Gio); current source data is small (~2,700 transaction rows,
~14 snapshot rows as of migration time) — no scale/performance engineering beyond basic
indexing is warranted (constitution Principle IV)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Data Integrity & Fidelity | Migration is idempotent (upsert on natural key: `item_id` / `transaction_id`), preserves all source columns, and reports (not silently drops) malformed rows; re-running the `pfm-gio.csv` migration after a confirmed mutation is blocked/warned (`system_state.pfm_gio_migration_locked`, spec FR-023) instead of silently re-applying and undoing an edit/delete | ✅ PASS |
| II. Privacy & Security | Supabase RLS scopes **every** runtime path — dashboard, `/api/mcp`, `/api/actions/*` — to the single authenticated owner via a session-bound client; the **service-role key is confined to the migration CLI only** and never used to serve a runtime request (revised 2026-08-09, research.md R8 — closes analysis finding I1); MCP/Actions requests are additionally gated by a single-owner bearer token before reaching the data layer; secrets (Supabase keys, `MCP_ACTIONS_API_KEY`) via env vars only, never committed; mutation audit logs (`transaction_mutations`) never persist financial field values in plaintext (constitution v1.2.0 "Mutation confirmation & audit logging" — closes finding CA3) | ✅ PASS |
| III. Spec-Driven Development | This plan follows `/speckit-specify` → `/speckit-clarify` → `/speckit-constitution` (v1.2.0) → `/speckit-plan`; the 2026-08-09 clarify session resolved every ambiguity Codex's `/speckit-analyze` flagged before this revision; the R7/R8 revisions are documented in research.md/constitution rather than made silently | ✅ PASS |
| IV. Simplicity (Single-User Scope) | One Next.js app; Q&A/mutations reuse two chat products Gio already pays for instead of adding a bespoke API-billed integration; ChatGPT is the only mandatory surface, Claude.ai is optional; bearer-token auth instead of OAuth; mutation confirmation is a simple TTL'd pending-change row, not a workflow engine — fewest moving parts that still satisfy FR-016's confirmation/expiry requirement | ✅ PASS |
| V. Anti-Hallucination in Financial Q&A | Read tools remain three narrow, parameterized functions (never raw SQL) whose results carry source record IDs for traceability (spec FR-007, revised); each tool's own description carries the grounding instruction; **mutations are now explicitly permitted** (constitution v1.2.0) but only as a two-step, Gio-confirmed, audited operation through the same narrow tool surface — never automatic, never free-form SQL; every read and mutation call is logged (read: `qa_queries`; mutation: `transaction_mutations`, redacted per Principle II) | ✅ PASS (read-traceability scope narrowing still documented — see research.md R7; mutation allowance is new in v1.2.0 and fully gated per the rules above) |

No violations. Complexity Tracking table is not needed for this feature — the added
tables/tools (pending-change TTL row, mutation audit log, exchange-rate table, migration
lock flag) are each single-purpose and directly required by a spec FR, not incidental
complexity.

## Project Structure

### Documentation (this feature)

```text
specs/001-personal-finance-platform/
├── plan.md              # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── database-schema.md
│   ├── qa-tools.md        # tool definitions (read + mutation) — transport-agnostic, shared by mcp-server.md and gpt-actions.md; mutation tools added 2026-08-09 (R8)
│   ├── mcp-server.md       # added 2026-08-09 (R7) — Claude.ai custom connector
│   ├── gpt-actions.md      # added 2026-08-09 (R7) — ChatGPT Custom GPT
│   └── api-routes.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Next.js's App Router merges frontend and backend into one project — the template's
"Option 2: Web application" split (separate `backend/` + `frontend/` trees) doesn't match
how this framework is structured, and introducing that split would add a second deployable
and a network hop between two single-user-scoped services for no benefit (constitution
Principle IV). This is "Option 1: Single project" adapted to Next.js App Router
conventions:

```text
app/                        # Next.js App Router
├── dashboard/
│   ├── page.tsx              # Dashboard UI (net worth incl. COP conversion, income/expense, category breakdown)
│   ├── dashboard-nav.tsx     # shared tabs: summary, movements, history, and rates
│   ├── movements/
│   │   └── page.tsx          # transaction CRUD, filters, current-month range, sorting
│   ├── history/
│   │   └── page.tsx          # all-time monthly income/expense charts by category
│   └── settings/
│       └── page.tsx          # Gio's manual exchange-rate editor (FR-022)
├── api/
│   ├── mcp/
│   │   └── route.ts           # POST — MCP Streamable HTTP server (Claude.ai connector, optional surface) — added 2026-08-09 (R7)
│   ├── actions/
│   │   ├── query-transactions/route.ts             # POST — GPT Action — added 2026-08-09 (R7)
│   │   ├── query-snapshots/route.ts                # POST — GPT Action — added 2026-08-09 (R7)
│   │   ├── aggregate-transactions/route.ts         # POST — GPT Action — added 2026-08-09 (R7)
│   │   ├── propose-transaction-change/route.ts     # POST — GPT Action — added 2026-08-09 (R8) — FR-015/016/021
│   │   ├── confirm-transaction-change/route.ts     # POST — GPT Action — added 2026-08-09 (R8) — FR-016/017
│   │   └── openapi.json/route.ts                   # GET — serves the OpenAPI schema — added 2026-08-09 (R7/R8)
│   ├── dashboard-metrics/
│   │   └── route.ts           # GET — aggregated metrics for the dashboard, by date range, incl. converted net worth
│   ├── exchange-rates/
│   │   └── route.ts           # GET/POST — Gio's manual rate table (FR-022), dashboard-only, not a Q&A tool
│   ├── transactions/
│   │   ├── route.ts           # GET/POST — filtered detail and creation
│   │   └── [id]/route.ts      # PATCH/DELETE — owner-scoped update and permanent deletion
│   └── transaction-history/
│       └── route.ts           # GET — paginated all-time monthly/category aggregation
└── layout.tsx                 # Auth-gated root layout (single-owner login via Supabase Auth)

lib/
├── supabase/
│   ├── service-role-client.ts  # renamed/split 2026-08-09 (R8) — service-role client; imported ONLY by scripts/migrate.ts, never by app/**
│   ├── session-client.ts       # added 2026-08-09 (R8), scope narrowed post-/speckit-analyze (finding CA1) — refresh-token-exchange RLS client used ONLY by /api/mcp and /api/actions/* (no browser session available there); see research.md R8 §8.2
│   └── queries.ts              # Parameterized query + mutation functions — shared by dashboard API and Q&A/Actions tools
├── mcp/                        # renamed from lib/claude/ 2026-08-09 (R7) — no longer Claude-SDK-specific
│   ├── tools.ts                  # query_transactions / query_snapshots / aggregate_transactions / propose_transaction_change / confirm_transaction_change handlers — shared by /api/mcp and /api/actions/*
│   ├── auth.ts                   # bearer-token check (MCP_ACTIONS_API_KEY) shared by both surfaces
│   ├── log-query.ts              # writes to qa_queries (channel, tool_name, input, row_count) — read tools only
│   └── log-mutation.ts           # added 2026-08-09 (R8) — writes to transaction_mutations using the constitution's redacted schema; never receives/persists field values
└── migration/
    ├── parse-csv.ts             # CSV parsing + row-level validation
    ├── upsert.ts                 # Idempotent upsert into Supabase
    └── migration-lock.ts         # added 2026-08-09 (R8) — checks/sets system_state.pfm_gio_migration_locked (FR-023)

scripts/
└── migrate.ts                  # CLI entry point: check migration-lock → parse-csv → validate → upsert, prints report; the ONLY caller of service-role-client.ts

supabase/
└── migrations/                 # SQL: table definitions, RLS policies, indexes

tests/
├── unit/                       # parse-csv, upsert idempotency, tool input validation, pending-change expiry, exchange-rate conversion
└── e2e/                        # Playwright: dashboard loads; MCP/Actions endpoints return grounded, logged results; RLS-isolation and service-role-confinement checks
```

**Structure Decision**: Single Next.js (TypeScript) application, deployed to a public host
(Vercel by default — see Target Platform above). `lib/supabase/queries.ts` is the single
choke point for all data access — the dashboard API route, the MCP server, and the GPT
Actions endpoints all call through it, so there is exactly one place that can read or write
financial data, which directly supports Principle I (traceability) and Principle II (no
query surface bypasses RLS). **Revised 2026-08-09 (R7)**: `lib/claude/` (an in-app Tool
Runner) was removed and replaced with `lib/mcp/` (transport-agnostic tool handlers consumed
by both `/api/mcp` and `/api/actions/*`); `app/qa/page.tsx` and `app/api/qa/route.ts` were
removed — there is no in-app Q&A UI, questions are asked from ChatGPT (mandatory) or
Claude.ai (optional) directly. The migration script (`scripts/migrate.ts`) is a one-off CLI,
not a long-running service. Ongoing transaction entry is supported through the authenticated
dashboard CRUD and through confirmed conversational mutations; snapshot import remains a
one-off migration concern.
**Revised 2026-08-09 (R8, constitution v1.2.0)**: `lib/supabase/client.ts` is split into
`service-role-client.ts` (migration-only, imported nowhere under `app/`) and
`session-client.ts` (the refresh-token-exchange RLS client used only by `/api/mcp` and
`/api/actions/*` — the dashboard keeps its own separate, interactive Supabase Auth session,
per research.md R8 §8.2's post-`/speckit-analyze` clarification, finding CA1) so the
service-role/RLS separation is enforced by file boundaries, not just convention — a lint
rule or the T036-equivalent security-review task can grep for any `app/**` import of
`service-role-client.ts` and fail if found. Two new
GPT Actions (`propose-transaction-change`, `confirm-transaction-change`) implement the
CRUD confirmation flow (FR-015–FR-018, FR-021); a small dashboard-only settings page and
`/api/exchange-rates` route let Gio maintain the COP conversion table (FR-022) — this is
deliberately **not** exposed as a Q&A tool, since no FR requires setting exchange rates
conversationally, and adding it there would be unrequired scope (Principle IV).

## Complexity Tracking

*No entries — Constitution Check reported no violations.*
