# Quickstart: Validate Personal Finance Platform End-to-End

Run these steps after implementation to prove the feature works, mapped to the spec's
acceptance scenarios and success criteria. Full schema/contract details live in
[data-model.md](data-model.md) and [contracts/](contracts/).

## Prerequisites

**Revised 2026-08-09 (research.md R7)**: Q&A no longer needs an Anthropic API key — it's
delivered via a ChatGPT Custom GPT (mandatory) and/or an optional Claude.ai custom
connector instead. It does need a public HTTPS deployment (steps 6/6b below can't be
validated against `localhost`).

- A Supabase project (URL + anon key + service role key)
- A ChatGPT Plus/Team/Enterprise account, for the mandatory Custom GPT — and/or a Claude
  Pro/Max (or Team) account, for the optional custom connector, if you're also validating
  that surface
- `balance-sheet.csv` and `pfm-gio.csv` present at the repo root (never committed — see
  root `.gitignore`)
- The app deployed to a public HTTPS host (Vercel by default — see plan.md Target Platform)
- `.env.local` (local dev) / host env vars (deployed) populated with
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (migration-only, per research.md R8 — never used by any runtime route),
  `SUPABASE_OWNER_EMAIL` and `SUPABASE_OWNER_PASSWORD` (server-only credentials used by
  `/api/mcp` and `/api/actions/*` to create a fresh RLS-bound session; a static
  `SUPABASE_OWNER_REFRESH_TOKEN` is retained only as a legacy fallback because Supabase
  rotates refresh tokens by default),
  `MCP_ACTIONS_API_KEY` (a long random string, e.g. `openssl rand -hex 32`) — none of these
  committed; Gio's Supabase Auth user id is passed directly to the migration script via its
  `--owner-id` flag (step 2 below), not a separate env var (simplified post-`/speckit-analyze`,
  finding U1)
- One Supabase Auth user created for Gio (the single owner), with public self-signup
  **disabled** in the Supabase project's Auth settings (Authentication → Providers → Email
  → "Allow new users to sign up" = off) — otherwise the app's `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  would let a stranger create their own account and reach the dashboard's login screen
  (FR-012; added post-`/speckit-analyze`, finding U2)
- At least one row in `exchange_rates` (added 2026-08-09, R8) if `balance-sheet.csv`
  contains a non-COP currency and you want to validate the converted net-worth figure in
  step 5

## 1. Apply the schema

```bash
supabase db push   # applies supabase/migrations/*.sql — see contracts/database-schema.md
```

**Expected**: `snapshots`, `transactions`, `qa_queries`, `pending_transaction_changes`,
`transaction_mutations`, `exchange_rates`, `system_state` tables exist (the last four added
2026-08-09, research.md R8), each with RLS enabled and an "owner full access" policy.

## 2. Run the migration (User Story 1, Scenario 1 & 2)

```bash
npm run migrate -- --owner-id <gio-user-id>
```

**Expected**:
- Console report shows rows read from each CSV, rows inserted/updated, and any rows flagged
  as data-quality issues (FR-003) — zero rows silently dropped.
- Row counts in `snapshots` and `transactions` match the source CSVs' row counts (minus any
  explicitly reported bad rows) — validates SC-001.
- **Re-run the same command.** Row counts in Supabase MUST NOT change — validates FR-004 /
  SC-007 (idempotency).

## 3. Spot-check data fidelity (SC-001)

Pick 3–5 rows at random from each source CSV and confirm the same `amount`, `date`,
`category`, and `currency`/`type` appear unchanged in Supabase (via `supabase db` SQL editor
or the Supabase dashboard table view).

## 4. Run a complex query directly (User Story 1, Scenario 3)

Using the Supabase SQL editor (or `lib/supabase/queries.ts` in a scratch script), run an
aggregate query spanning both entity types, e.g. total asset value by category as of the
most recent snapshot date. Confirm the result matches manual inspection of
`balance-sheet.csv`.

## 5. Start the app and check the dashboard (User Story 2)

```bash
npm run dev
```

Open `/dashboard`:
- **Expected**: net worth, asset/liability breakdown, income vs. expense, and spending by
  category all render within 3 seconds (SC-003) and match the values spot-checked in step 3.
- Change the date range picker to a period with no data. **Expected**: an explicit empty
  state, not a blank or misleading zero-value chart (FR-011).
- **If `snapshots` spans more than one currency (added 2026-08-09, R8)**: confirm net worth
  shows a COP-converted total, with the exchange rate(s) and their effective date(s)
  displayed alongside it (FR-009). Go to `/dashboard/settings`, add/change a rate for a
  currency present in your snapshots, reload the dashboard, and confirm the converted net
  worth updates accordingly. Remove (or don't configure) a rate for a currency that appears
  in `snapshots` and confirm that currency is excluded from `converted_cop` and listed in
  `unconverted_currencies` rather than silently guessed (see contracts/api-routes.md).

### 5a. Validate income and expense management

Open `/dashboard/movements`:

- Confirm the initial date range is the first day of the current local month through today.
- Confirm rows are initially ordered from newest transaction date to oldest.
- Filter independently and in combination by type, category, `Desde`, and `Hasta`.
- Confirm the category selector includes categories beyond the first 500/1,000 transaction
  rows; the API paginates its category catalog.
- Click `Valor` twice and confirm ordering changes from highest→lowest to lowest→highest.
  Click `Fecha` and confirm date-descending order is restored.
- Create a temporary movement, edit its description/type/amount/category/date, and delete it.
  Confirm each change appears immediately and deletion asks for confirmation.

### 5b. Validate historical charts

Open `/dashboard/history`:

- Confirm the summary reports total historical income, expense, movement count, and months.
- Confirm both income and expense panels show monthly stacked bars for the eight largest
  categories.
- Select a category in each panel and confirm it changes to a monthly line chart.
- Confirm a category with months lacking movements shows zero for those months rather than
  dropping the month from the shared timeline.
- Confirm `/api/transaction-history` processes the complete transaction count rather than
  only the first Supabase response page.

## 6. Ask a grounded question (User Story 3)

**Revised 2026-08-09 (research.md R7)**: there is no in-app `/qa` page — validate from
whichever surface(s) you configured. **6a (ChatGPT) is mandatory**; **6b (Claude.ai) is
optional/best-effort** (spec Assumptions, 2026-08-09) — skip 6b if you haven't configured
that surface, it does not block validation.

**6a. ChatGPT Custom GPT (mandatory)**: follow the repository setup guide in
[README.md](../../README.md#chatgpt-setup). Import
`https://pfm-supabase.vercel.app/api/actions/openapi.json`, configure API Key/Bearer with
the value of `MCP_ACTIONS_API_KEY`, and paste the canonical Instructions from
[gpt-actions.md](contracts/gpt-actions.md#custom-gpt-configuration).
Ask: *"How much did I spend on health in [a month with a known health transaction]?"*

**6b. Claude.ai custom connector (optional)**: follow
[README.md](../../README.md#claude-ai-setup). Add a custom
MCP connector pointing at `https://pfm-supabase.vercel.app/api/mcp` and configure
`Authorization: Bearer <MCP_ACTIONS_API_KEY>`. Start a new chat, enable the connector, and
ask the same question there. See [mcp-server.md](contracts/mcp-server.md) for the protocol
contract.

**6d. Codex or Claude Code agent (optional)**: follow the client-specific setup in
[README.md](../../README.md#claude-code-setup) or
[README.md](../../README.md#codex-setup). Export
`MCP_ACTIONS_API_KEY` before starting the agent from the repository root. Codex reads
`.codex/config.toml`; Claude Code reads `.mcp.json` after you trust the workspace and approve
`pfm-finance`. Run `codex mcp list` or `claude mcp list`, then ask the same known-answer
question. The server must expose six typed tools. Read tools run directly; mutation tools
require the proposal → explicit confirmation flow and client approval.

For a batch create, provide 2–20 complete movements and confirm the agent calls
`proposeTransactionBatch`, displays every interpreted movement plus the total, and waits
for one immediately following explicit confirmation covering the entire batch before
calling `confirmTransactionChange` exactly once with the batch `pending_change_id`. The
result must contain one `transaction_id` per inserted row. The agent must not propose or
confirm movements individually.

For whichever surface(s) you validated:
- **Expected**: an answer whose figure matches the source data, produced by the model
  actually calling one of the read tools (visible in claude.ai's/ChatGPT's own "used a
  tool"/Action-call UI).
- Check the `qa_queries` table in Supabase — a new row exists with `channel: 'mcp'` (or
  `'action'`), the `tool_name` called, the `input` filters used, and the real `row_count` —
  this is the traceability record now that this system doesn't see the question/answer text
  directly (FR-007, as scoped by the constitution's "Q&A delivery surface" constraint).

Ask a question with **no** matching data (e.g. a category that doesn't exist):
- **Expected**: an explicit "I can't answer this" response (FR-008), not a fabricated
  figure — and the logged `qa_queries` row for that call shows `row_count: 0`.

Ask a question outside personal finance (e.g. "what's the capital of France?"):
- **Expected**: the assistant declines and states it only answers questions about the
  migrated financial data (spec.md Edge Cases).

Ask an ambiguous question (e.g. *"how much did I spend?"* with no category/period):
- **Expected**: the answer either asks a clarifying follow-up or states the assumption it
  used (e.g. "showing all-time total across all categories").

## 6c. Create, edit, and delete a transaction via confirmed conversational mutation (User Story 3, added 2026-08-09, research.md R8)

From the mandatory ChatGPT surface (or the optional Claude.ai connector):

1. Ask the GPT to create a transaction but omit a required field (e.g. no category).
   **Expected**: it asks for the missing field and does not call `proposeTransactionChange`
   or create anything (FR-021).
2. Provide all five required fields (date, description, amount, category, income/expense).
   **Expected**: it calls `proposeTransactionChange`, shows you the exact interpreted
   change, and asks for confirmation — nothing is created yet (FR-016). Confirm in your
   immediate next message. **Expected**: `confirmTransactionChange` is called, the new row
   appears in `transactions` with a real `transaction_id`, and the GPT reports success and
   identifies that ID (FR-017). A `transaction_mutations` row exists with
   `operation: 'create'`, `outcome: 'success'`, and no financial field values.
3. Ask it to edit that transaction's amount. **Expected**: it first resolves the target by
   ID (via `query_transactions`, listing candidates if your description is ambiguous — FR-016),
   proposes the change, and waits for confirmation before applying it.
4. Ask it to delete an imported transaction (originally from `pfm-gio.csv`). **Expected**:
   after confirmation, the row is permanently removed from `transactions` — no soft-delete
   flag or recoverable copy exists anywhere (FR-018).
5. **Expiry check**: trigger a `proposeTransactionChange` (e.g. propose another edit), then
   deliberately wait more than 5 minutes (or send an unrelated message) before confirming.
   **Expected**: `confirmTransactionChange` returns `outcome: 'failure', reason: 'expired'`
   and nothing is modified (FR-016).
6. **Reimport lock check** (FR-023): after step 2 or 4 above, re-run
   `npm run migrate -- --owner-id <gio-user-id>` against the original `pfm-gio.csv`.
   **Expected**: the script refuses to proceed with `pfm-gio.csv` (printing an explanatory
   message about `system_state.pfm_gio_migration_locked`) instead of silently re-creating
   the deleted row or overwriting the edit; re-running with `--force` is the only way past
   this, and even then must not be what happens by default.

## 7. Access control (constitution Principle II)

**Dashboard login gate (added/clarified post-`/speckit-analyze`, finding CA1)**: open
`/dashboard` in a private/incognito browser window with no prior login. **Expected**: you
are redirected to a real login screen (email/password or magic link) — the dashboard is
**not** pre-authenticated as Gio via `SUPABASE_OWNER_REFRESH_TOKEN` or any other server-side
mechanism; only `/api/mcp` and `/api/actions/*` use that (see research.md R8 §8.2). Log in
as Gio's Supabase Auth user and confirm the dashboard now loads.

**Signup restriction (added post-`/speckit-analyze`, finding U2)**: attempt to sign up for a
new account (via the Supabase client's sign-up call, e.g. a quick script using
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` — the app's own UI shouldn't
expose a sign-up form at all). **Expected**: the request is rejected, because public
self-signup is disabled in the Supabase project's Auth settings — no one besides the one
account Gio already created can ever reach the login screen with valid credentials.

Confirm `/api/mcp` and every `/api/actions/*` endpoint reject requests with a missing or
wrong `Authorization: Bearer` token with `401` — this is the primary *caller* authentication
boundary for the Q&A/mutation surfaces (research.md R7).

Attempt to query `snapshots` or `transactions` from the Supabase SQL editor **without**
`auth.uid()` set to Gio's user ID (e.g. via the `anon` role directly). **Expected**: zero
rows returned — RLS blocks access.

**Added 2026-08-09 (research.md R8, closes analysis finding I1) — service-role
confinement**: grep the repository for imports of `lib/supabase/service-role-client.ts`.
**Expected**: the only import is in `scripts/migrate.ts` — no file under `app/` (dashboard
pages, API routes) imports it. Then, with a valid bearer token but no Supabase session,
confirm a direct call to `/api/mcp` or `/api/actions/query-transactions` still only returns
Gio's own rows (there is only one owner in this system, but the query path used —
`lib/supabase/session-client.ts` — must be the RLS-scoped one, not service-role; this can be
confirmed by temporarily pointing `SUPABASE_OWNER_REFRESH_TOKEN` at an invalid value and
observing the request fail closed rather than falling back to service-role).

## 8. Currency handling (FR-014)

Confirm the dashboard's net-worth figure does not silently sum USD and COP snapshot amounts
together — `net_worth.by_currency` (see `contracts/api-routes.md`) should show one bucket
per currency present in the underlying snapshots, separate from the COP-converted total
validated in step 5.

## 9. Data fidelity, latency, and Q&A accuracy measurement (added 2026-08-09, research.md R6 revision)

- **SC-001 (100% fidelity)**: run the full field-by-field reconciliation test/script (not
  just the spot check in step 3) and confirm zero discrepancies between every source row and
  its migrated counterpart.
- **SC-004 (10s Q&A latency)**: run the latency test that calls each MCP/Actions tool
  endpoint directly N times and confirm p95 ≤ 10s.
- **SC-005/SC-006 (Q&A accuracy, zero fabrication)**: run through the versioned Q&A
  Evaluation Corpus (`tests/fixtures/qa-corpus.json` or equivalent, ≥20 questions) against
  the mandatory ChatGPT surface and confirm ≥95% match expected answers within ±1%
  tolerance, with the remainder correctly flagged as unanswerable.

---

All checks in steps 1–9 passing constitutes end-to-end validation of User Stories 1–3 and
the data-integrity/security/grounding/mutation-confirmation constraints from the
constitution (v1.2.0).
