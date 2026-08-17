# Phase 0 Research: Personal Finance Platform

All Technical Context decisions below were made during planning (no items were left as
`NEEDS CLARIFICATION`); each is recorded here with rationale and alternatives considered,
per constitution Principle IV (prefer the option with fewer moving parts) and Principle II
(privacy/security by default).

## R1. Single-language stack: TypeScript / Next.js

**Decision**: TypeScript throughout — migration script, dashboard, Q&A backend — inside one
Next.js (App Router) application.

**Rationale**: Supabase's first-class client is `@supabase/supabase-js`, and Next.js has the
most direct Supabase integration path (official Supabase + Next.js quickstart, built-in API
routes for the Q&A backend, server components for dashboard data fetching without a separate
API hop). One language and one deployable minimizes moving parts for a single-user app
(constitution Principle IV) and keeps the migration script, dashboard, and Q&A tool
functions able to share the same typed Supabase query layer (`lib/supabase/queries.ts`),
which also directly serves Principle I's traceability requirement — one code path, one place
to audit.

**Alternatives considered**:
- *Python migration script + separate JS/TS web app*: rejected — two languages, two
  dependency trees, and the query logic (which must be shared between the dashboard and the
  Q&A tools per Principle V) would need to be duplicated or bridged.
- *Split frontend (React/Vite) + backend (Express/FastAPI) services*: rejected — adds a
  second deployable and a network hop between two single-user-scoped services with no
  concrete requirement driving it (spec explicitly frames this as a personal, single-user
  tool).

## R2. Q&A grounding mechanism: narrow tools, not raw SQL

**Decision**: Three parameterized Supabase query functions exposed to Claude as tools
(`query_transactions`, `query_snapshots`, `aggregate_transactions`) via the Claude API Tool
Runner (`claude-opus-5`, adaptive thinking, `effort: "medium"` to start). No `run_sql`-style
tool is ever exposed to the model.

**Rationale**: Constitution Principle V requires every numeric Q&A answer to be traceable to
underlying records and forbids fabricated figures; Principle II forbids a query surface that
could read outside the intended scope. A closed set of parameterized functions makes both
guarantees structural rather than prompt-dependent: the model cannot construct a query that
reads unintended data (there is no free-text SQL channel), and every tool call's inputs and
row count are recorded as evidence for the returned answer. This was worked out in detail in
the earlier `claude-api` skill consultation (see conversation history) before this plan;
summarized here for the artifact trail.

**Alternatives considered**:
- *Raw SQL tool (model writes `SELECT ...`)*: rejected — no injection surface is safer than a
  sanitized one, and an open-ended SQL tool makes "traceable to real rows" a prompting
  convention instead of a structural guarantee.
- *Vector/embedding search over transaction descriptions*: rejected as unnecessary for this
  scale (~2,700 rows) — plain filtered/aggregated SQL queries against structured columns
  (date, category, kind, institution) fully cover the "complex queries" requirement (spec
  FR-005) without adding an embedding pipeline.
- *Managed Agents (CMA) for the Q&A surface*: rejected — this is a single-turn, stateless
  question/answer interaction, not a long-running or stateful agentic session; Tool Runner
  (Claude API + tool use) is the simplest tier that fits (per the claude-api skill's
  "Which Surface Should I Use?" guidance).

**Update (2026-08-09, see R7)**: the *shape* of the three tools decided here is unchanged,
but the *delivery mechanism* originally described (an in-app Claude API Tool Runner) was
superseded — the tools are now exposed via an MCP connector and GPT Actions instead of a
bespoke in-app chat loop. Read this entry for why the tools are narrow and SQL-free; read
R7 for how they are now delivered.

## R3. Migration idempotency

**Decision**: Upsert on the source's natural unique key (`item_id` for snapshots,
`transaction_id` for transactions) — re-running the migration against the same source files
never creates duplicates (spec FR-004, SC-007).

**Rationale**: Both source CSVs already carry UUID-like unique identifiers per row; using
them as the Postgres primary key makes upsert the natural idempotency mechanism with no
separate dedup logic needed.

**Alternatives considered**: Content-hash-based dedup — rejected as unnecessary complexity
given the source files already provide stable unique IDs.

## R4. Row-level data-quality handling

**Decision**: The migration script validates each row (date parses, amount parses as a
number, required fields present) before upsert; malformed rows are collected into a report
printed at the end of the run and are not inserted, rather than being silently dropped or
silently "fixed" (spec FR-003; constitution Principle I).

**Rationale**: Constitution Principle I explicitly requires data-quality issues to be
surfaced, not silently resolved. A post-run report is the simplest mechanism that satisfies
this for a one-off, human-run CLI script (no need for a persistent quarantine table at this
scale).

**Alternatives considered**: A `migration_issues` database table — deferred; not needed
unless/until migrations become recurring rather than one-off (spec Assumptions: this feature
covers migrating existing historical data, not ongoing ingestion).

## R5. Authentication

**Decision**: Supabase Auth, single owner account, enforced via Row Level Security policies
scoping every table to that one `user_id`.

**Rationale**: Constitution Principle II requires restricting access to Gio as sole
authorized user; Supabase Auth + RLS is the built-in, zero-additional-infrastructure way to
get this on the chosen stack (Principle IV — fewest moving parts).

**Alternatives considered**: A custom auth layer or shared API key — rejected as unnecessary
complexity; Supabase Auth already provides session-based login suited to a single-user app.

## R6. Testing approach

**Decision**: Vitest for unit tests (CSV parsing/validation, upsert idempotency, Q&A tool
input validation) plus a small Playwright e2e suite (dashboard loads and shows non-empty
metrics; a Q&A question returns an answer with a traceable tool-call record).

**Rationale**: Matches the Next.js/TypeScript stack with no additional tooling; e2e coverage
is kept minimal (a handful of smoke tests) rather than a large suite, consistent with
Principle IV for a single-user tool.

**Alternatives considered**: Jest — Vitest chosen instead for faster local runs and native
ESM/TS support with less configuration in a Next.js project.

**Update (2026-08-09, post-`/speckit-analyze` revision)**: the original scope above was too
thin to actually verify SC-001, SC-004, SC-005/SC-006, and the RLS/service-role separation
added in R8 — `/speckit-analyze` flagged all four as untested (findings C2, C3, A1/A2, I1).
Four testing decisions close those gaps, to be turned into concrete `tasks.md` entries by
the next `/speckit-tasks` run:
- **SC-001 (data fidelity)**: replace spot-checking with a deterministic reconciliation
  script that compares every migrated row's every field against its source CSV row
  (matched by `item_id`/`transaction_id`) and asserts zero discrepancies, rather than a
  human sampling 3–5 rows. Spot-checking remains as a *manual* quickstart step for a human
  sanity check, but the automated pass/fail test is full reconciliation.
- **SC-004 (10s Q&A latency)**: a Playwright/HTTP timing test that calls each MCP/Actions
  tool endpoint directly (bypassing the calling chat product, which this system doesn't
  control the latency of) and asserts p95 response time ≤ 10s across N repeated calls —
  this measures *this system's* contribution to the budget, not ChatGPT/Claude.ai's own
  model-latency, which is out of this system's control.
- **SC-005/SC-006 (Q&A accuracy / zero fabrication)**: the versioned Q&A Evaluation Corpus
  defined in spec.md (≥20 questions, expected answers, ±1% tolerance) becomes a checked-in
  fixture (e.g. `tests/fixtures/qa-corpus.json`) plus a documented manual grading procedure
  against the mandatory ChatGPT surface (no API exists to script chat-product conversations
  end-to-end, so this stays a documented manual pass, not a CI test — same conclusion as the
  original T038, now grounded in a concrete, versioned corpus instead of an ad hoc one).
- **I1 (RLS/service-role isolation)**: a unit test asserts `lib/supabase/service-role-client.ts`
  is imported by `scripts/migrate.ts` and nowhere else in the repo (a simple static-import
  grep/AST check is sufficient at this scale — no need for a runtime sandbox); an e2e test
  attempts a cross-boundary read (calling `/api/dashboard-metrics`, `/api/mcp`, and
  `/api/actions/*` without a valid session/bearer token) and asserts zero rows/`401`, proving
  no runtime path can read data outside RLS.

## R8. CRUD confirmation flow, RLS/service-role separation, currency conversion, migration lock

**Decision** *(added 2026-08-09, post-`/speckit-clarify` + constitution v1.2.0 revision)*:
this entry records five related design decisions made to close the critical/high findings
from a Codex `/speckit-analyze` pass (CA1, CA2, CA3, I1, I2, I3, U1, U2) after the
2026-08-09 `/speckit-clarify` session resolved the underlying ambiguities in spec.md and
`/speckit-constitution` amended the constitution to v1.2.0.

### 8.1 Mutation confirmation: two-step propose/confirm, not a stateful chat session

**Decision**: Add two new tools/Actions — `propose_transaction_change` and
`confirm_transaction_change` — instead of a single "do it now" mutation tool.
`propose_transaction_change` validates the requested operation (create/edit/delete),
requires all FR-021 fields for `create` and a `target_transaction_id` (resolved by the
calling model via a prior `query_transactions` call, per spec FR-016) for edit/delete, and
inserts a `pending_transaction_changes` row with a 5-minute `expires_at`, returning its ID
and a human-readable summary for the model to show Gio. `confirm_transaction_change` takes
only that pending-change ID, checks it exists, is unexpired, and unconsumed, applies the
operation, **deletes the pending-change row** (revised post-`/speckit-analyze`, finding
CA2 — see §8.3 below for why deletion, not a `consumed_at` flag, is the design), and
returns the outcome + affected `transaction_id` (FR-017).

**Rationale**: MCP/Actions calls are stateless HTTP requests with no built-in notion of
"this is Gio's very next message" — the two-step design with a short server-side TTL is the
simplest mechanism (Principle IV) that still structurally prevents an unconfirmed or stale
"yes" from mutating data (FR-016), without building a general workflow/session engine. Each
tool's description instructs the calling model never to call `confirm_transaction_change`
without first showing Gio the exact proposed change and receiving his explicit confirmation
in his next message — an expired pending-change record makes a late or automatic confirm
attempt fail closed rather than silently succeed.

**Alternatives considered**:
- *Single mutate-immediately tool relying on prompt instructions for confirmation*: rejected
  — confirmation would be a prompting convention, not a structural guarantee, the same
  category of risk R2 already rejected for read-side grounding.
- *Long-lived or session-scoped confirmation (no expiry)*: rejected — spec explicitly
  requires the confirmation to expire if Gio doesn't respond in his immediate next message;
  an unbounded TTL couldn't satisfy that.

### 8.2 Runtime data access: RLS-scoped session client, service-role confined to migration

**Decision**: `lib/supabase/service-role-client.ts` is imported only by
`scripts/migrate.ts`. Every other runtime path is RLS-scoped, but via **two distinct
mechanisms** depending on whether a browser session is available — collapsing these into
one description was flagged as a real access-control ambiguity by `/speckit-analyze`
(finding CA1) and is spelled out precisely here:

- **Dashboard (`app/dashboard/**`, `app/layout.tsx`)**: uses a normal **interactive Supabase
  Auth browser session** — Gio logs in once (email/password or magic link) via the standard
  `@supabase/ssr` cookie-based session helpers, exactly as research.md R5 originally
  decided. `auth.uid()` comes from *that visitor's own* session cookie. This is the real
  FR-012 access gate for the dashboard: someone without Gio's login cannot get a session,
  so RLS returns nothing for them. This mechanism needs no refresh token and is unrelated to
  the bullet below.
- **`/api/mcp` and `/api/actions/*` only**: these requests arrive from agent clients
  with no browser and no session cookie — only a static bearer token
  (`MCP_ACTIONS_API_KEY`). `lib/supabase/session-client.ts` solves *this* problem: a
  server-only owner credentials create a fresh Supabase session bound to Gio's real user, so
  the subsequent query still runs with `auth.uid()` = Gio and RLS applies. This supersedes
  the original static-refresh-token mechanism: Supabase rotates refresh tokens by default,
  so a value stored immutably in Vercel eventually becomes invalid. The refresh-token path
  remains only as a compatibility fallback.
  The bearer-token check remains the *caller* authentication layer (proves the request came
  from Gio's ChatGPT/Claude.ai) for this surface only; `session-client.ts` is the
  *data-access* layer behind it, used **only after** that bearer check passes.

`session-client.ts` is therefore scoped to `/api/mcp` and `/api/actions/*` — **not** the
dashboard, which keeps its own interactive login session untouched by this revision.

**Rationale**: The prior design's ambiguity (data-model.md said the query layer "runs with
the authenticated user's session **or**, if using the service role..., explicitly filters by
owner_id") let a service-role, RLS-bypassing path serve runtime requests, which
`/speckit-analyze` correctly flagged (finding I1) as contradicting the plan's own "nothing
evades RLS" claim — an application-code filtering bug would have had no database-level
backstop. A session-bound client makes RLS the actual enforcement mechanism, not just a
second check that happens to agree with the first.

**Alternatives considered**:
- *OAuth per external caller*: rejected — unnecessary complexity for a single owner
  (Principle IV); the refresh-token-based session client gets the same RLS guarantee without
  a multi-user OAuth flow.
- *Keep service-role for runtime, add a code-review rule to always filter by owner_id*:
  rejected — this is exactly the pattern that produced finding I1; a missed filter in one
  query function would silently return another (nonexistent, but structurally possible)
  owner's data with no RLS backstop.

### 8.3 Mutation audit logging: minimal, redacted schema

**Decision**: `transaction_mutations` (not `qa_queries`) logs every mutation attempt:
`tool_name`, `operation`, `transaction_id`, `timestamp`, `actor`, `outcome` — no `input`
JSONB column, ever. `pending_transaction_changes.proposed_fields` (the real field values
needed to apply the change) is transient application state, not a log: it is read once by
`confirm_transaction_change` and **the row is deleted immediately** after being consumed
(success or failure) — there is no `consumed_at` flag that leaves it in place (an earlier
draft of data-model.md/tasks.md had drifted to "mark consumed" instead of "delete," which
`/speckit-analyze` correctly flagged as finding CA2 — fixed by making deletion the literal
task, T039, not just the stated intent here) — or after expiry, never accumulating a
plaintext history of financial values.

**Rationale**: Directly implements constitution v1.2.0's "Mutation confirmation & audit
logging" rule (closes finding CA3) — separating the permanent, non-sensitive audit trail
from the short-lived operational state needed to execute a confirmed change keeps Principle
II's "no plaintext financial data in logs" guarantee intact without losing the ability to
actually perform the mutation.

**Alternatives considered**: A single `transaction_mutations` table with a redacted/partial
`input` column (e.g. only non-financial metadata) — rejected as more complex than two
narrowly-scoped tables (a permanent redacted log + a transient full-detail row) for no
benefit at this scale.

### 8.4 Net worth currency conversion: manual COP rate table

**Decision**: `exchange_rates` (`currency`, `rate_to_cop`, `effective_date`) is a table Gio
edits from a small dashboard settings page (`/dashboard/settings`, backed by
`GET`/`POST /api/exchange-rates`) — never fetched from an external FX API. Net worth
conversion picks, per currency present in `snapshots`, the row with the latest
`effective_date`; a currency with no configured rate is excluded from the converted total
and flagged in the dashboard response rather than guessed (spec FR-009).

**Rationale**: Matches Gio's explicit clarification answer (manual, Gio-updated rate table)
and Principle IV — no new external dependency, no API key to manage, no failure mode from a
third-party FX service being down when the dashboard loads.

**Alternatives considered**: External FX API (e.g. exchangerate.host) — explicitly rejected
by Gio during `/speckit-clarify` in favor of the simpler manual table.

### 8.5 Migration lock after first confirmed mutation

**Decision**: `system_state.pfm_gio_migration_locked` (single boolean row per owner) is set
`true` by `confirm_transaction_change` the first time any transaction mutation succeeds.
`scripts/migrate.ts` checks this flag before processing `pfm-gio.csv` and refuses to
proceed (printing a clear message) unless re-run with an explicit `--force` flag, which
still does not restore or overwrite any row the migration would otherwise upsert over an
edited/deleted one — `--force` exists only as an escape hatch for a deliberate, informed
re-import Gio explicitly requests, not the default path.

**Rationale**: Implements spec FR-023 (closes finding I2) — without this, an innocuous
"let me re-run the migration to double check" after Gio has already edited or deleted an
imported transaction would silently resurrect the old value or the deleted row via the
existing upsert-on-natural-key idempotency (R3), which is exactly the failure mode the spec
clarification ruled out.

**Alternatives considered**: Tombstone table (record deleted/edited source IDs, exclude them
on re-import) — rejected in `/speckit-clarify` as more complex than needed given the "one-
time initial load" framing the spec settled on; the lock is simpler and sufficient.

### 8.6 Claude.ai: optional, not gating

**Decision**: ChatGPT (Custom GPT + Actions) remains the one mandatory delivery surface;
the Claude.ai MCP connector may still be configured (R7) but no success criterion, task, or
acceptance test treats it as required. Tasks/config steps specific to Claude.ai are labeled
optional in the next `/speckit-tasks` run.

**Rationale**: Matches the `/speckit-clarify` decision on finding U2 and the constitution's
pre-existing "MAY be exposed through more than one" framing for this constraint — the prior
plan/tasks language made Claude.ai sound equally required, which overstated spec scope.

**Alternatives considered**: Dropping Claude.ai entirely — rejected; keeping it as a free
"also works" surface costs nothing extra since both surfaces already share one tool
implementation (R7).

## R7. Q&A delivery surface: MCP connector + GPT Actions, not an in-app LLM API call

**Decision** *(added 2026-08-09, post-Phase-1 revision)*: The three Q&A tools defined in R2
are exposed through two channels the owner already pays for, instead of a bespoke in-app
chat UI backed by a separately billed Anthropic API call:

1. **Claude.ai custom connector (MCP over Streamable HTTP)** — Gio adds the deployed MCP
   endpoint as a connector in claude.ai settings and asks questions from Claude.ai directly
   (Pro/Max plan, no extra API billing).
2. **ChatGPT Custom GPT (Actions)** — a Custom GPT configured with an OpenAPI schema
   pointing at the same underlying tool logic, exposed as REST endpoints (ChatGPT
   Plus/Team plan, no extra API billing).

Both channels call through the same `lib/supabase/queries.ts` choke point as before (R2) —
only the transport around the three tools changes. The original design (an in-app
`/qa` page driving the Claude API Tool Runner) is superseded; no such page or Anthropic SDK
call remains in this feature.

**Rationale**: The owner already has a paid ChatGPT and/or Claude.ai subscription; routing
Q&A traffic through an in-app Anthropic API integration would mean paying for the same
capability twice. MCP and OpenAPI Actions are the standard, vendor-supported ways to give
each chat product live tool access without an API key of that provider's own.

**Consequence for traceability (Principle V)**: In the original design, this system fully
controlled the loop — question in, tool calls, answer out — so it could log the question,
the answer, and the supporting tool calls together in one `qa_queries` row (data-model.md).
With MCP/Actions, **the calling chat product (claude.ai or ChatGPT), not this system,
receives the question and composes the final answer** — our backend only ever sees
individual tool invocations. `qa_queries` is therefore repurposed from a "Q&A exchange log"
into a **tool-call audit log** (tool name, input, row count, timestamp) — see the revised
`qa_queries` schema in data-model.md. Grounding is still enforced structurally (the tools
are the only way to reach the data, and each tool's description instructs the calling model
to cite the data and to explicitly decline on zero rows), but this system can no longer
verify, end-to-end, that a specific answer text matches its supporting tool calls, because
the answer itself is composed outside this system's boundary. This is a real, accepted
narrowing of what Principle V's traceability guarantee can be *verified* to cover on these
two surfaces — documented per constitution Governance rather than left implicit.

**New forced decision — public hosting**: unlike the dashboard (which could stay
local-dev-only per the original Target Platform note), an MCP connector and GPT Actions
both require a live, publicly reachable HTTPS endpoint — `localhost` does not work from
claude.ai or chatgpt.com. This feature can no longer defer hosting entirely; **Vercel** is
the default choice (zero-config for this stack, free tier sufficient for single-user
traffic) unless the owner prefers self-hosting.

**New forced decision — caller authentication**: both surfaces need to prove the caller is
Gio (FR-012). A single static bearer token (`MCP_ACTIONS_API_KEY`, env-var only per
Principle II), checked on every MCP and Actions request, is the simplest mechanism that
satisfies this for a one-person system (Principle IV) — full OAuth is unnecessary
complexity here, unlike a multi-user product.

**Alternatives considered**:
- *Keep the original in-app Tool Runner + `/qa` page*: rejected per explicit owner request
  — avoids a second, separately billed LLM integration.
- *MCP only (Claude.ai) or Actions only (ChatGPT), not both*: considered and offered to the
  owner as narrower options; owner chose both for maximum flexibility in where questions
  get asked.
- *OAuth for MCP/Actions auth*: rejected as unnecessary complexity for a single owner
  (Principle IV) — a static bearer token satisfies the same access-control requirement
  (FR-012) with far less implementation surface.

## Outcome

All Technical Context fields are resolved; no `NEEDS CLARIFICATION` markers remain. Ready
for Phase 1 design. **R7 and R8 are post-Phase-1 revisions** applied after Phase 1 design
and Phase 2 tasks had already been generated once — see plan.md, data-model.md, contracts/,
and (on the next `/speckit-tasks` run) tasks.md, all updated to match. R8 specifically
closes the critical/high findings (CA1–CA3, I1–I3, U1, U2) from the 2026-08-09
`/speckit-analyze` pass, following the `/speckit-clarify` session and the constitution v1.2.0
amendment that made conversational CRUD mutations constitutionally permitted in the first
place.
