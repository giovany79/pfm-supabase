# Tasks: Personal Finance Platform

**Input**: Design documents from `/specs/001-personal-finance-platform/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: A lean set of unit/e2e tests is included — `plan.md`/`research.md` R6 already
committed to Vitest + Playwright as part of the tech stack, so the corresponding minimal
test tasks are included here rather than treated as optional scaffolding.

**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md's P1/P2/P3
priorities) so each can be implemented, tested, and delivered independently.

**Revised 2026-08-09 (research.md R7)**: User Story 3's tasks were rewritten. Q&A is now
delivered via a mandatory ChatGPT Custom GPT (Actions) and an optional/best-effort Claude.ai
custom connector (MCP) instead of an in-app Claude API Tool Runner — see research.md R7, the
constitution's "Q&A delivery surface" constraint, and contracts/mcp-server.md /
contracts/gpt-actions.md.

**Revised again 2026-08-09 (research.md R8, constitution v1.2.0)**: this full regeneration
closes every critical/high finding from a Codex `/speckit-analyze` pass that the prior
version of this file left open, after a `/speckit-clarify` session resolved the underlying
spec ambiguities and `/speckit-constitution` amended the constitution to allow confirmed
conversational mutations:

- **C1 / U1** (no tasks existed for FR-015–FR-023 conversational CRUD): Phase 5 now includes
  the full `propose_transaction_change` → `confirm_transaction_change` implementation and
  test tasks (T031–T033, T038–T040, T043–T044, T050).
- **I1** (service-role key could serve runtime requests, contradicting the plan's own "RLS
  is never bypassed" claim): Phase 2 now splits the Supabase client into a migration-only
  service-role client (T008) and an RLS-scoped session client used by every runtime path
  (T009); T057 adds an explicit isolation test.
- **CA3** (mutation audit logging had no redaction policy): T036 adds a dedicated,
  schema-constrained mutation logger that never receives or persists financial field values,
  separate from the transient `pending_transaction_changes` state (T039 uses both correctly).
- **I2** (no re-import policy after a conversational mutation): T016 adds the migration-lock
  check FR-023 requires; T017 wires it into the migration CLI.
- **I3** (no net-worth currency-conversion design): T021/T025/T026/T028 add the manual
  exchange-rate table and COP conversion logic.
- **C2/C3/A1/A2** (SC-001/SC-004/SC-005/SC-006 were unverified or unverifiable): T054–T056
  replace spot-checking and an ad hoc checklist with deterministic reconciliation, a p95
  latency test, and a versioned Q&A evaluation corpus.
- **U2** (Claude.ai treated as equally mandatory to ChatGPT): T048 is now explicitly labeled
  optional; nothing else in this file depends on it.
- The former T036 ("confirm no code path issues an INSERT/UPDATE/DELETE") is **removed** —
  it directly contradicted the now-permitted, confirmed mutation flow. T052 replaces it with
  security checks appropriate to a system that does mutate data, deliberately and audibly.

This also preserves two fixes an earlier `/speckit-analyze` pass had already made to this
phase: the stated (not silently contradicted) dependency of US3 on US2's currency-safe
aggregation helpers, and the currency-mixing guard embedded in each Q&A tool's description.

**Revised 2026-08-17**: implementation status was synchronized and Phase 7 was added for
the delivered dashboard extensions: movement CRUD/filtering/ordering and complete monthly
history by category. Deployment, e2e, reconciliation, latency, and Q&A-corpus work remains
unchecked and is not implied complete by this revision.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, per the Project Structure in [plan.md](plan.md)

## Path Conventions

Single Next.js (TypeScript) application at the repository root — see plan.md's Project
Structure for the full tree (`app/`, `lib/`, `scripts/`, `supabase/`, `tests/`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create the Next.js App Router project skeleton (`app/`, `lib/`, `scripts/`, `supabase/migrations/`, `tests/unit/`, `tests/e2e/`, `tests/fixtures/`) per plan.md's Project Structure
- [X] T002 Initialize the TypeScript/Next.js 15 project with dependencies: `next`, `react`, `typescript`, `@supabase/supabase-js`, `@modelcontextprotocol/sdk`, `tailwindcss`, `recharts`, `csv-parse` in `package.json`
- [X] T003 [P] Configure ESLint + Prettier for the project
- [X] T004 [P] Configure Vitest (unit tests) and Playwright (e2e tests) per research.md R6
- [X] T005 [P] Create `.env.local.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (migration-only), `SUPABASE_OWNER_REFRESH_TOKEN` (MCP/Actions session client — research.md R8 §8.2), `MCP_ACTIONS_API_KEY` (no real values, per constitution Principle II) — no `GIO_OWNER_ID` env var: `scripts/migrate.ts` takes Gio's user id via its `--owner-id` CLI flag instead, and every runtime path now derives identity from a real session (dashboard login or `SUPABASE_OWNER_REFRESH_TOKEN`), so no separate env var for it is needed (removed post-`/speckit-analyze`, finding U1)
- [X] T006 Verify the root `.gitignore` excludes `.env.local`, `balance-sheet.csv`, `pfm-gio.csv`, and build output

**Checkpoint**: Project scaffold exists and installs cleanly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Write the Supabase schema migration (`snapshots`, `transactions`, `qa_queries`, `pending_transaction_changes`, `transaction_mutations`, `exchange_rates`, `system_state` tables, indexes, RLS policies) exactly per contracts/database-schema.md in `supabase/migrations/0001_init.sql`
- [X] T008 [P] Implement the Supabase **service-role** client factory in `lib/supabase/service-role-client.ts` — per research.md R8 §8.2, this file MUST be imported only by `scripts/migrate.ts`; no file under `app/` may import it (verified later by T057)
- [X] T009 [P] Implement the Supabase **session-scoped** client factory in `lib/supabase/session-client.ts` — exchanges `SUPABASE_OWNER_REFRESH_TOKEN` for a fresh Supabase Auth access token bound to Gio's `user_id` so every runtime query runs with `auth.uid() = owner_id` and RLS applies structurally (research.md R8 §8.2); used **only** by `/api/mcp` and every `/api/actions/*` route (no browser session exists for those callers) — **not** by the dashboard, see T010 (scope narrowed post-`/speckit-analyze`, finding CA1)
- [X] T010 [P] Implement the Supabase-Auth-gated root layout in `app/layout.tsx` — a real interactive login (email/password or magic link) using `@supabase/ssr`'s cookie-based browser session helpers, independent of `session-client.ts` (T009); this is the actual FR-012 access gate for the dashboard, since RLS keys off *this* session's own `auth.uid()`; the login UI itself exposes no sign-up form (login-only). **Also disable public self-signup in the Supabase project's Auth settings** (Authentication → Providers → Email → "Allow new users to sign up" = off) so the `NEXT_PUBLIC_SUPABASE_ANON_KEY`-backed signup API can't be called directly by a stranger to create an account and reach the login screen (manual one-time project config, not app code — closes analysis finding U2; document it in T053's README so it isn't lost if the project is ever recreated)
- [X] T011 [P] Implement a logging helper that never writes financial field values in plaintext (constitution Principle II) in `lib/logger.ts`

**Checkpoint**: Schema is applied, both Supabase clients exist with their access boundaries
established, auth gate exists, and a safe logging helper is available — user story
implementation can now begin.

---

## Phase 3: User Story 1 - Centralize and query personal finance data (Priority: P1) 🎯 MVP

**Goal**: Migrate both source CSVs into Supabase with full fidelity and idempotency, and make
the centralized data queryable (filter + aggregate) without opening the spreadsheets.

**Independent Test**: Run the migration twice against the same CSVs and confirm row counts
never change on the second run (idempotency); spot-check values against the source files;
run a cross-entity aggregate query and confirm it matches manual inspection — see
quickstart.md steps 1–4.

### Tests for User Story 1

- [X] T012 [P] [US1] Unit test: CSV row parsing + validation rules (date/amount parse, required fields, `kind`/`type` enum) in `tests/unit/parse-csv.test.ts`
- [X] T013 [P] [US1] Unit test: upsert idempotency (running twice on identical input produces no duplicate rows) in `tests/unit/upsert.test.ts`

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement CSV parsing + row-level validation (data-model.md validation rules; malformed rows collected, never silently dropped — FR-003) in `lib/migration/parse-csv.ts`
- [X] T015 [P] [US1] Implement idempotent Supabase upsert (upsert on `item_id` / `transaction_id`, FR-004; uses `service-role-client.ts` — T008) in `lib/migration/upsert.ts`
- [X] T016 [P] [US1] Implement the migration-lock helper (`checkLocked()`/`setLocked()` against `system_state.pfm_gio_migration_locked`) per data-model.md and research.md R8 §8.5 in `lib/migration/migration-lock.ts` — `setLocked()` is called by User Story 3's `confirm_transaction_change` (T039); `checkLocked()` is used here by T017
- [X] T017 [US1] Implement the migration CLI entry point (parse → validate → for `pfm-gio.csv`, refuse to proceed if `checkLocked()` is true unless `--force` is passed → upsert → print data-quality report, FR-023) in `scripts/migrate.ts` (depends on T014, T015, T016)
- [X] T018 [P] [US1] Implement the single choke-point query layer — filtered `query_transactions`/`query_snapshots` and grouped `aggregate_transactions` functions per contracts/qa-tools.md's parameter shapes, scoped by `owner_id`, using `session-client.ts` (T009) — in `lib/supabase/queries.ts`
- [X] T019 [US1] Run the migration against `balance-sheet.csv` and `pfm-gio.csv` and validate against quickstart.md steps 1–4 (row counts, idempotent re-run, spot-check fidelity, cross-entity query) (depends on T017, T018)

**Checkpoint**: User Story 1 is fully functional and independently testable — data is
centralized, idempotent, queryable, and protected against a careless post-mutation re-import
even before User Story 3 exists to trigger the lock.

---

## Phase 4: User Story 2 - Visualize finances on a dashboard (Priority: P2)

**Goal**: A dashboard showing net worth (including a COP-converted total when snapshots span
multiple currencies), asset/liability breakdown, income vs. expenses, and spending by
category, with a date-range filter and an explicit empty state.

**Independent Test**: Load the dashboard and confirm every metric matches the data spot-checked
in User Story 1; change the date range to a period with no data and confirm an explicit
empty state renders; edit the exchange-rate table and confirm the converted net worth
updates accordingly — see quickstart.md step 5.

### Tests for User Story 2

- [X] T020 [P] [US2] Contract test: `GET /api/dashboard-metrics` response shape, including `net_worth.converted_cop`/`rates_used`/`unconverted_currencies`, and the `has_data: false` empty-state case per contracts/api-routes.md in `tests/unit/dashboard-metrics.test.ts`

### Implementation for User Story 2

- [X] T021 [P] [US2] Implement currency-safe net-worth, income/expense aggregation, and COP conversion helpers (never silently sum mixed currencies — FR-014; convert using the latest applicable `exchange_rates` row per currency — FR-009/FR-022; exclude and flag any currency with no configured rate) in `lib/supabase/queries.ts` (extends T018)
- [X] T022 [US2] Implement `GET /api/dashboard-metrics` per contracts/api-routes.md in `app/api/dashboard-metrics/route.ts` (depends on T021)
- [X] T023 [US2] Implement the dashboard UI — net worth (by-currency + COP-converted total with rate/date shown), asset/liability breakdown, income vs. expense chart, spending-by-category chart — in `app/dashboard/page.tsx` (depends on T022)
- [X] T024 [US2] Add the date-range picker and the explicit empty-state rendering (FR-011) to `app/dashboard/page.tsx` (depends on T023)
- [X] T025 [P] [US2] Implement `GET`/`POST /api/exchange-rates` (FR-022) per contracts/api-routes.md in `app/api/exchange-rates/route.ts`
- [X] T026 [US2] Implement the exchange-rate editor UI in `app/dashboard/settings/page.tsx` (depends on T025)
- [ ] T027 [P] [US2] E2e smoke test: dashboard loads within 3s and shows non-empty metrics (SC-003) in `tests/e2e/dashboard.spec.ts`
- [ ] T028 [P] [US2] Unit test: net-worth conversion excludes and flags a currency with no configured `exchange_rates` row instead of guessing (FR-009); also confirm `POST /api/exchange-rates` for a `(currency, effective_date)` pair that already exists updates that row's `rate_to_cop` in place rather than creating a duplicate, so rate selection is never ambiguous (closes analysis finding A1) in `tests/unit/net-worth-conversion.test.ts`

**Checkpoint**: User Stories 1 and 2 both work independently, including manual FX-rate
maintenance and its effect on the converted net-worth figure.

---

## Phase 5: User Story 3 - Ask natural-language questions and manage transactions conversationally (Priority: P3)

**Goal**: Grounded natural-language answers about Gio's finances, plus confirmed
create/edit/permanent-delete of transactions, asked and issued directly from a mandatory
ChatGPT Custom GPT and/or an optional Claude.ai custom connector — not an in-app chat UI
(research.md R7) — with every read call and mutation attempt traceable via an audit log,
since neither surface hands this system the question or the final answer text.

**Independent Test**: Ask a question with a known answer from the mandatory ChatGPT surface
and confirm the figure matches the source data and a corresponding `qa_queries` row was
logged; ask a question with no matching data and confirm an explicit "cannot answer"
response; create a transaction, confirm it, and verify it appears in `transactions` with a
logged `transaction_mutations` row containing no financial values; let a proposed change
expire unconfirmed and verify nothing was modified — see quickstart.md steps 6 and 6c.

**Note on dependencies**: unlike US1/US2, this phase is **not** independent of User Story
2 — the tool handlers (T037) reuse US2's currency-safe aggregation helpers (T021) so that a
Q&A answer about snapshots never silently sums mixed currencies (FR-014), the same guarantee
the dashboard already has. This is a deliberate, documented dependency (see the note at the
top of this file), not an oversight.

### Tests for User Story 3

- [X] T029 [P] [US3] Unit test: each read Q&A tool handler validates its input against the schemas in contracts/qa-tools.md and rejects free-text/SQL-shaped input, in `tests/unit/qa-tools.test.ts`
- [X] T030 [P] [US3] Unit test: the bearer-token auth check accepts only the configured `MCP_ACTIONS_API_KEY` and rejects everything else (missing header, wrong token) in `tests/unit/mcp-auth.test.ts`
- [X] T031 [P] [US3] Unit test: `propose_transaction_change` requires all five fields (date, description, amount, category, type) for `operation: "create"` and returns a validation error listing exactly what's missing without creating a pending change (FR-021), in `tests/unit/propose-transaction-change.test.ts`
- [ ] T032 [P] [US3] Unit test: `confirm_transaction_change` rejects an expired (>5 min old) pending change (deleting it, returning `reason: "expired"`) and an unknown/already-confirmed `pending_change_id` (returning `reason: "not_found"`, since a consumed row no longer exists), applying no mutation in any of those cases (FR-016); also confirm that after a successful `confirm_transaction_change` call, its `pending_transaction_changes` row is gone from the table (closes analysis finding CA2), in `tests/unit/confirm-transaction-change.test.ts`
- [X] T033 [P] [US3] Unit test: `propose_transaction_change` requires a single `target_transaction_id` for `edit`/`delete` and has no mechanism to accept more than one candidate, forcing the calling model to disambiguate via a prior `query_transactions` call first (FR-016), in `tests/unit/transaction-target-selection.test.ts`

### Implementation for User Story 3

- [X] T034 [P] [US3] Implement the shared bearer-token auth check per contracts/mcp-server.md / contracts/gpt-actions.md in `lib/mcp/auth.ts`
- [X] T035 [P] [US3] Implement the `qa_queries` read-audit logger (`channel`, `tool_name`, `input`, `row_count`) per data-model.md in `lib/mcp/log-query.ts`
- [X] T036 [P] [US3] Implement the `transaction_mutations` audit logger per the redacted schema in data-model.md / constitution v1.2.0 "Mutation confirmation & audit logging" (`channel`, `tool_name`, `operation`, `transaction_id`, `actor`, `outcome` — this function's type signature MUST NOT accept an `amount`/`description`/`category` parameter, so a future caller cannot accidentally log one) in `lib/mcp/log-mutation.ts`
- [X] T037 [US3] Implement the three read tool handlers (`query_transactions`, `query_snapshots`, `aggregate_transactions`) — each with its grounding instruction embedded in the description per contracts/qa-tools.md, including the currency-mixing guard for snapshots, and returning source record IDs for traceability (FR-007) — wired to `lib/supabase/queries.ts` and `lib/mcp/log-query.ts` — in `lib/mcp/tools.ts` (depends on T018, T021, T034, T035)
- [X] T038 [US3] Implement the `propose_transaction_change` handler — validates the operation per contracts/qa-tools.md (FR-021 field requirements for `create`, required `target_transaction_id` for `edit`/`delete`), inserts a `pending_transaction_changes` row with a 5-minute `expires_at`, returns the pending-change ID and a human-readable summary — in `lib/mcp/tools.ts` (depends on T037)
- [X] T039 [US3] Implement the `confirm_transaction_change` handler — loads the `pending_transaction_changes` row; if not found, returns `{outcome: "failure", reason: "not_found"}` (covers both an unknown ID and one already consumed by an earlier call, since consumed rows are deleted, not flagged — post-`/speckit-analyze` fix, finding CA2); if found but past `expires_at`, **deletes the row** and returns `{outcome: "failure", reason: "expired"}`; otherwise applies the create/edit/delete via `lib/supabase/queries.ts`'s mutation functions (T040), **deletes the row** (success or failure of the underlying mutation — never leave `proposed_fields`' real financial values behind), calls `migration-lock.ts`'s `setLocked()` (T016) on first success, logs the attempt via `log-mutation.ts` (T036), and returns the outcome + affected `transaction_id` (FR-017) — in `lib/mcp/tools.ts` (depends on T038, T036, T040, T016)
- [X] T040 [P] [US3] Implement the transaction mutation functions (`createTransaction`, `updateTransaction`, `deleteTransaction` — the latter a real, permanent `DELETE`, never a soft-delete flag, per FR-018) in `lib/supabase/queries.ts` (extends T018/T021)
- [X] T041 [US3] Implement the MCP Streamable HTTP server (`initialize`, `tools/list` returning all five tools, `tools/call`) per contracts/mcp-server.md in `app/api/mcp/route.ts` (depends on T039) — this endpoint serves the **optional** Claude.ai surface
- [X] T042 [US3] Implement the three read GPT Action REST endpoints per contracts/gpt-actions.md in `app/api/actions/query-transactions/route.ts`, `app/api/actions/query-snapshots/route.ts`, `app/api/actions/aggregate-transactions/route.ts` (depends on T037)
- [X] T043 [US3] Implement the `propose-transaction-change` GPT Action endpoint per contracts/gpt-actions.md in `app/api/actions/propose-transaction-change/route.ts` (depends on T038)
- [X] T044 [US3] Implement the `confirm-transaction-change` GPT Action endpoint per contracts/gpt-actions.md in `app/api/actions/confirm-transaction-change/route.ts` (depends on T039)
- [X] T045 [US3] Implement the OpenAPI schema endpoint (`GET /api/actions/openapi.json`, all five operations) per contracts/gpt-actions.md in `app/api/actions/openapi.json/route.ts` (depends on T042, T043, T044)
- [X] T046 [US3] Deploy the app to a public HTTPS host (Vercel by default, per plan.md Target Platform) and configure `MCP_ACTIONS_API_KEY`, `SUPABASE_OWNER_REFRESH_TOKEN`, and the Supabase env vars on the host (depends on T007–T045 — the whole app must build cleanly first) — deployed 2026-08-17 to `https://pfm-supabase.vercel.app`; automatic Git deployments remain a separate account-level connection step
- [ ] T047 [US3] Configure the **mandatory** ChatGPT Custom GPT (contracts/gpt-actions.md, including the confirmation-flow Instructions text) and validate against quickstart.md steps 6a and 6c (depends on T046)
- [ ] T048 [P] [US3] **OPTIONAL** — Configure the Claude.ai custom connector (contracts/mcp-server.md) and validate against quickstart.md step 6b; this surface does not gate story completion or any success criterion (spec Assumptions, U2) (depends on T046)
- [ ] T049 [P] [US3] E2e smoke test: a direct `tools/call` request to `/api/mcp` and a direct request to each read `/api/actions/*` endpoint each return a grounded, logged result, and both reject a missing/invalid bearer token with `401`, in `tests/e2e/qa-endpoints.spec.ts`
- [ ] T050 [P] [US3] E2e test: full `propose_transaction_change` → `confirm_transaction_change` flow for create, edit, and delete; a deliberately expired pending change is rejected with no mutation applied; a `pfm-gio.csv` re-run after a confirmed mutation is refused by `migration-lock.ts` unless `--force` (quickstart.md step 6c); a confirmed **delete** succeeds (the row is actually gone from `transactions`) and its `transaction_mutations` audit row persists afterward with that now-nonexistent `transaction_id` as a plain historical value — confirming the CA2 fix (no FK blocking the delete or the audit write) — in `tests/e2e/mutation-flow.spec.ts`

**Checkpoint**: All three user stories are independently functional (US3 with the stated
dependency on US2's T021), with ChatGPT fully validated as the mandatory surface and
Claude.ai available as an optional extra.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [ ] T051 Run the full quickstart.md validation (all 9 steps, including 6c)
- [ ] T052 [P] Security review: confirm RLS blocks unauthenticated/cross-user dashboard, `/api/mcp`, and `/api/actions/*` access; confirm every `confirm_transaction_change` call was preceded by a valid, unexpired `propose_transaction_change` (no mutation path bypasses the propose→confirm flow); confirm `transaction_mutations` rows never contain `amount`/`description`/`category`/institution values (schema-level check, not just code review); confirm no secrets or source CSVs are committed — this replaces the prior version's now-inapplicable "never INSERT/UPDATE/DELETE" check, since confirmed mutations are permitted by constitution v1.2.0
- [X] T053 [P] Write the project README (setup, env vars including `SUPABASE_OWNER_REFRESH_TOKEN`, deployment to Vercel, running the migration and its `--force` re-import override, configuring the mandatory ChatGPT Custom GPT and the optional Claude.ai connector, and disabling public self-signup in Supabase Auth settings per T010 — so this one-time manual step isn't lost if the project is ever recreated)
- [ ] T054 [P] Implement a deterministic reconciliation script/test comparing every migrated row's every field against its source CSV row (matched by `item_id`/`transaction_id`) and asserting zero discrepancies (SC-001, replaces spot-checking as the automated pass/fail gate) in `tests/unit/reconciliation.test.ts`
- [ ] T055 [P] Implement a latency test calling each MCP/Actions tool endpoint directly N times and asserting p95 response time ≤ 10s (SC-004, measuring this system's own contribution, not the calling chat product's model latency) in `tests/e2e/latency.spec.ts`
- [ ] T056 [P] Build the versioned Q&A Evaluation Corpus fixture (≥20 questions with expected answers and ±1% numeric tolerance, per spec.md's Q&A Evaluation Corpus entity) in `tests/fixtures/qa-corpus.json`, plus a documented manual grading procedure against the mandatory ChatGPT surface to check ≥95% accuracy with correctly-flagged unanswerable remainder (SC-005/SC-006) — replaces the prior ad hoc ~15–20 question checklist with a versioned, reproducible one
- [X] T057 [P] Implement the RLS/service-role isolation test: a static-import check asserting `lib/supabase/service-role-client.ts` is imported only by `scripts/migrate.ts` and nowhere else in the repo, plus an e2e check that `/api/dashboard-metrics`, `/api/mcp`, and every `/api/actions/*` endpoint return zero rows/`401` without a valid session/bearer token (I1); also assert that visiting `/dashboard` with no login redirects to the login screen rather than rendering data — i.e. the dashboard is never implicitly authenticated via `SUPABASE_OWNER_REFRESH_TOKEN`/`session-client.ts`, only `/api/mcp` and `/api/actions/*` are (closes analysis finding CA1) — in `tests/e2e/rls-isolation.spec.ts`
- [ ] T058 [P] Polish loading/error states on `app/dashboard/page.tsx`, `app/dashboard/settings/page.tsx`, and error responses on `/api/mcp` and `/api/actions/*`

---

## Phase 7: Dashboard transaction management and historical analysis

**Purpose**: Dashboard capabilities added after the original task generation.

- [X] T059 [US2] Replace raw JSON dashboard output with responsive cards, tables, and category charts in `app/dashboard/page.tsx` and `app/styles.css`
- [X] T060 [US2] Implement session-authenticated transaction list/create/update/delete routes in `app/api/transactions/` and the management UI in `app/dashboard/movements/page.tsx`
- [X] T061 [US2] Add type/category/date filters, current-month default range, date-descending default order, and amount sorting to the movements UI
- [X] T062 [US2] Paginate the distinct-category source so every owned category appears beyond Supabase's per-request row limit
- [X] T063 [US2] Implement full-history paginated monthly aggregation in `app/api/transaction-history/route.ts`
- [X] T064 [US2] Implement stacked category histories and focused category line charts in `app/dashboard/history/page.tsx`
- [X] T065 [P] [US2] Add shared dashboard tab navigation and responsive styles for summary, movements, history, and exchange rates
- [X] T066 [P] Update README, API contracts, feature requirements, task status, quickstart validation, and safe Git/env guidance for the delivered dashboard extensions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational; its query helpers (T021) extend the
  query layer US1 builds in T018, so in practice starts after T018 lands
- **User Story 3 (Phase 5)**: Depends on Foundational, on US1's T018, and on **US2's T021**
  (its currency-safe aggregation is reused by the Q&A tool handlers — T037 depends on it
  directly). US3 is therefore not fully independent of US2, unlike US1/US2's relationship to
  each other; see the note at the top of this file for why.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **US1 (P1)**: Independently deliverable after Foundational — this is the MVP.
- **US2 (P2)**: Functionally independent of US3; shares the `lib/supabase/queries.ts` module
  with US1 (additive, not conflicting — T021 adds new functions to the file T018 creates).
- **US3 (P3)**: Depends on US1 (T018) **and** US2 (T021) — see "Note on dependencies" in
  Phase 5. US2 and US3 do not share any UI/route files (`app/dashboard/` vs
  `app/api/mcp/`+`app/api/actions/`), so once T021 lands, US3's remaining implementation
  work can proceed independently of any further US2 work (T022–T028).

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel
- Foundational: T008, T009, T010, T011 in parallel (after T007)
- US1: T012, T013 in parallel; T014, T015, T016, T018 in parallel (T017 depends on
  T014+T015+T016)
- US2: T020 in parallel with T021; T025 in parallel with T021–T024 (different file); T027,
  T028 in parallel with nothing else in their phase (depend on the full chain)
- US3: T029, T030, T031, T032, T033 in parallel; T034, T035, T036 in parallel (all
  prerequisites of T037); T040 in parallel with T034–T036; T048, T049, T050 depend on the
  full chain but can run in parallel with each other once it's complete
- Once T018 (US1) is done, US2's T021 can start; once T021 lands, the rest of US2
  (T022–T028) and the rest of US3 (T037 onward) can proceed in parallel by different people

---

## Parallel Example: User Story 1

```bash
# Tests, launched together:
Task: "Unit test: CSV row parsing + validation in tests/unit/parse-csv.test.ts"
Task: "Unit test: upsert idempotency in tests/unit/upsert.test.ts"

# Implementation, launched together (all touch different files):
Task: "Implement CSV parsing + validation in lib/migration/parse-csv.ts"
Task: "Implement idempotent upsert in lib/migration/upsert.ts"
Task: "Implement the migration-lock helper in lib/migration/migration-lock.ts"
Task: "Implement the query layer in lib/supabase/queries.ts"
```

## Parallel Example: User Story 3 (after T021 lands)

```bash
# Prerequisites, launched together:
Task: "Implement the bearer-token auth check in lib/mcp/auth.ts"
Task: "Implement the qa_queries read-audit logger in lib/mcp/log-query.ts"
Task: "Implement the transaction_mutations audit logger in lib/mcp/log-mutation.ts"
Task: "Implement the transaction mutation functions in lib/supabase/queries.ts"

# Then T037 (read tool handlers) — depends on the above plus T018/T021
# Then T038 → T039 (propose → confirm) — sequential, same file (lib/mcp/tools.ts)
# Then T041 (MCP server, optional surface) and T042–T044 (GPT Actions, mandatory surface)
# — parallel, different files:
Task: "Implement the MCP Streamable HTTP server in app/api/mcp/route.ts"
Task: "Implement the GPT Action REST endpoints in app/api/actions/*/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md steps 1–4 independently
5. At this point Gio can already query centralized data directly (Supabase SQL editor or
   the query layer) without opening the spreadsheets — the smallest viable release per
   spec.md's "Why this priority" for User Story 1

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → **MVP**
3. Add User Story 2 (dashboard + exchange-rate settings) → validate independently
4. Add User Story 3 (Q&A + confirmed CRUD via the mandatory ChatGPT Custom GPT, plus the
   optional Claude.ai connector) → validate independently — note this story's real
   dependency on US2's T021 (see above)
5. Each story adds value without breaking the previous ones — the query layer (`lib/supabase/queries.ts`) is additive across all three

---

## Notes

- [P] tasks touch different files with no unmet dependency
- [Story] labels map every user-story-phase task back to spec.md's US1/US2/US3
- File paths are exact per plan.md's Project Structure — no task should require guessing a
  path
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
- No task in this list introduces a raw-SQL tool for the LLM, lets a mutation apply without
  a fresh confirmation, skips RLS/bearer-token auth, or persists financial values in
  plaintext logs — those are structural constraints from plan.md's Technical Context and
  constitution v1.2.0, not something any individual task re-decides
- The service-role/session-client split (T008/T009) and the propose/confirm mutation flow
  (T038/T039) exist specifically because a prior `/speckit-analyze` pass found the previous
  design could not structurally guarantee RLS isolation or confirmed-only mutations — see
  research.md R8 for the full rationale behind each
- US3's dependency on US2's T021 (see Dependencies section) is stated plainly here rather
  than left as a silent task-list inconsistency — an earlier `/speckit-analyze` pass flagged
  exactly that contradiction (finding I1 in that round) alongside a related coverage gap on
  currency-mixing in Q&A grounding (finding C2 in that round); both remain resolved by this
  revision
- **SC-002** ("get an answer in under 1 minute") has no dedicated task/test — it is
  intentionally subsumed by T027 (SC-003, dashboard ≤3s) and T055 (SC-004, Q&A p95 ≤10s),
  both of which are strictly tighter bounds than SC-002's 1-minute bar, so passing them
  passes SC-002 by construction. Noted explicitly (post-`/speckit-analyze`, finding C1) so
  this isn't a silent coverage gap.
