# Contract: GPT Actions (ChatGPT Custom GPT — mandatory surface)

**Added 2026-08-09 (research.md R7)**. The tools from [qa-tools.md](qa-tools.md), exposed as
plain REST endpoints with an OpenAPI 3.1 schema, for use as "Actions" on a Custom GPT built
in ChatGPT. **This is the mandatory Q&A/mutation delivery surface** (spec Assumptions,
2026-08-09) — SC-004/SC-005/SC-006 are measured against this surface; the Claude.ai MCP
connector (mcp-server.md) is optional/best-effort.

## Endpoints

| Method | Path | Tool |
|---|---|---|
| `POST` | `/api/actions/query-transactions` | `query_transactions` |
| `POST` | `/api/actions/query-snapshots` | `query_snapshots` |
| `POST` | `/api/actions/aggregate-transactions` | `aggregate_transactions` |
| `POST` | `/api/actions/propose-transaction-change` | `propose_transaction_change` — added 2026-08-09 (R8) |
| `POST` | `/api/actions/propose-transaction-batch` | `propose_transaction_batch` — proposes 2–20 atomic creates |
| `POST` | `/api/actions/confirm-transaction-change` | `confirm_transaction_change` — added 2026-08-09 (R8) |
| `POST` | `/api/actions/propose-snapshot-change` | `propose_snapshot_change` — proposes one asset/liability create or edit |
| `POST` | `/api/actions/confirm-snapshot-change` | `confirm_snapshot_change` — applies the explicitly confirmed proposal |
| `GET` | `/api/actions/openapi.json` | Serves the OpenAPI schema below (public, no auth — it contains no financial data, only the API shape) |

Each `POST` endpoint's request body is exactly the tool's `input_schema` from qa-tools.md;
each response body is exactly the tool's result shape. Same validation, same "empty result,
not an error" behavior for the read endpoints; the five mutation-flow endpoints follow
qa-tools.md's propose/confirm response shapes exactly. Read calls log to `qa_queries` with
`channel: 'action'`; confirmation calls log to `transaction_mutations` or
`snapshot_mutations` with `channel: 'action'` (redacted schemas) — see qa-tools.md's Grounding
Contract, which applies identically here.

## Authentication

Every `POST /api/actions/*` request MUST carry:

```
Authorization: Bearer <MCP_ACTIONS_API_KEY>
```

Configured once when adding the Action in the GPT Builder ("Authentication" → "API Key" →
"Bearer" — ChatGPT stores it and attaches it to every Action call automatically). Same env
var, same secret as the MCP server — one credential to rotate, not two (Principle IV).

## OpenAPI schema (served at `/api/actions/openapi.json`)

```json
{
  "openapi": "3.1.0",
  "info": { "title": "PFM Supabase Q&A Actions", "version": "1.3.1" },
  "servers": [{ "url": "https://<deployed-host>/api/actions" }],
  "paths": {
    "/query-transactions": {
      "post": {
        "operationId": "queryTransactions",
        "summary": "Retrieve income/expense transactions matching filters. Base your answer only on the returned rows; if row_count is 0, say there is no matching data.",
        "requestBody": {
          "required": false,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QueryTransactionsInput" } } }
        },
        "responses": { "200": { "description": "Matching rows and count", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QueryTransactionsResult" } } } } }
      }
    },
    "/query-snapshots": {
      "post": {
        "operationId": "querySnapshots",
        "summary": "Retrieve asset/liability snapshots matching filters. Snapshots can span multiple currencies — never sum across currencies without saying so.",
        "requestBody": {
          "required": false,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QuerySnapshotsInput" } } }
        },
        "responses": { "200": { "description": "Matching rows and count", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/QuerySnapshotsResult" } } } } }
      }
    },
    "/aggregate-transactions": {
      "post": {
        "operationId": "aggregateTransactions",
        "summary": "Sum/count transactions grouped by category or month. Base your answer only on the returned groups; if empty, say there is no matching data.",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AggregateTransactionsInput" } } }
        },
        "responses": { "200": { "description": "Grouped sums/counts", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/AggregateTransactionsResult" } } } } }
      }
    },
    "/propose-transaction-change": {
      "post": {
        "operationId": "proposeTransactionChange",
        "summary": "Step 1 of 2 for create/edit/delete of a transaction. Never call without first showing Gio the target transaction (for edit/delete) or the full proposed fields (for create). Returns a pending_change_id and summary to show Gio verbatim before asking for confirmation. Does not modify data.",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProposeTransactionChangeInput" } } }
        },
        "responses": { "200": { "description": "Pending change created, or a validation error listing missing/invalid fields", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProposeTransactionChangeResult" } } } } }
      }
    },
    "/propose-transaction-batch": {
      "post": {
        "operationId": "proposeTransactionBatch",
        "summary": "Step 1 of 2 for atomically creating 2–20 complete transactions. Returns the exact interpreted batch, total, pending_change_id, and summary; it does not modify transactions.",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProposeTransactionBatchInput" } } }
        },
        "responses": { "200": { "description": "Pending batch proposal", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProposeTransactionBatchResult" } } } } }
      }
    },
    "/confirm-transaction-change": {
      "post": {
        "operationId": "confirmTransactionChange",
        "summary": "Step 2 of 2. Call ONLY in direct response to Gio's explicit confirmation of the exact summary propose-transaction-change returned, in his immediate next message. Applies the change if the pending_change_id is still valid; otherwise returns a failure reason (e.g. expired) and nothing is modified.",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ConfirmTransactionChangeInput" } } }
        },
        "responses": { "200": { "description": "Outcome of the confirmed mutation", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ConfirmTransactionChangeResult" } } } } }
      }
    },
    "/propose-snapshot-change": {
      "post": {
        "operationId": "proposeSnapshotChange",
        "summary": "Step 1 of 2 for creating or editing one asset or liability. For edits, resolve exactly one item_id with querySnapshots first. Net worth is calculated and cannot be edited directly."
      }
    },
    "/confirm-snapshot-change": {
      "post": {
        "operationId": "confirmSnapshotChange",
        "summary": "Step 2 of 2. Apply the pending asset/liability proposal only after Gio explicitly confirms its exact fields."
      }
    }
  },
  "components": {
    "schemas": {
      "QueryTransactionsInput": { "$ref": "qa-tools.md#query_transactions.input_schema (copied verbatim, JSON Schema is OpenAPI-schema-compatible)" },
      "QuerySnapshotsInput": { "$ref": "qa-tools.md#query_snapshots.input_schema (copied verbatim)" },
      "AggregateTransactionsInput": { "$ref": "qa-tools.md#aggregate_transactions.input_schema (copied verbatim)" },
      "ProposeTransactionChangeInput": { "$ref": "qa-tools.md#propose_transaction_change.input_schema (copied verbatim) — added 2026-08-09 (R8)" },
      "ProposeTransactionBatchInput": { "$ref": "qa-tools.md#propose_transaction_batch.input_schema (copied verbatim)" },
      "ConfirmTransactionChangeInput": { "$ref": "qa-tools.md#confirm_transaction_change.input_schema (copied verbatim) — added 2026-08-09 (R8)" },
      "ProposeSnapshotChangeInput": { "$ref": "qa-tools.md#propose_snapshot_change.input_schema (copied verbatim)" },
      "ConfirmSnapshotChangeInput": { "$ref": "qa-tools.md#confirm_snapshot_change.input_schema (copied verbatim)" }
    }
  }
}
```

The `$ref` placeholders above are documentation shorthand — the actual `openapi.json`
served by `GET /api/actions/openapi.json` MUST inline the real JSON Schema objects from
qa-tools.md (OpenAPI 3.1 uses JSON Schema directly, so no translation is needed beyond
copy-paste), plus the corresponding `*Result` schemas (`{rows, row_count}` /
`{groups, row_count}`).

<a id="custom-gpt-configuration"></a>

## Custom GPT configuration (manual, one-time, done in the ChatGPT UI — not code)

1. Create a new GPT in ChatGPT → Configure → Actions → "Import from URL" →
   `https://<deployed-host>/api/actions/openapi.json?v=1.3.1`.
2. Authentication → API Key → Bearer → paste `MCP_ACTIONS_API_KEY`.
3. GPT **Instructions** field (the closest equivalent to the original in-app system
   prompt): *"You answer questions about Gio's personal finances; you can create, edit, or
   permanently delete transactions and create or edit assets and liabilities, using the provided Actions only. Never state a number,
   trend, or category you did not just retrieve via an Action this turn. If an Action
   returns row_count: 0, say plainly that you don't have matching data — never estimate.
   Snapshots may use different currencies (see each row's `currency` field); never sum or
   compare amounts across currencies without saying so. Decline any question outside
   personal finance and say you only answer questions about the migrated financial data.
   For any create, edit, or delete request: first resolve the exact target transaction via
   queryTransactions if editing/deleting (if more than one matches, list them by ID and ask
   Gio to pick one); call proposeTransactionChange and show Gio the returned summary
   verbatim; only call confirmTransactionChange if Gio's very next message is a clear
   confirmation of that exact summary — if he says anything else, asks a question, or time
   has passed, do not call confirmTransactionChange, and instead restate the proposal or ask
   again. If confirmTransactionChange returns outcome: failure with reason: expired, tell
   Gio the confirmation window passed and restate the proposed change before asking again.
   For a new transaction, always collect date, description, amount, category, and type
   (income or expense) before calling proposeTransactionChange — ask for anything missing,
   never infer or default it. For 2 to 20 new transactions, collect all five fields for
   every row, call proposeTransactionBatch exactly once with the complete batch, show every
   returned transaction and the batch total, and ask one question confirming the entire
   batch. Only if Gio's immediately following message explicitly confirms that exact batch,
   call confirmTransactionChange exactly once with its pending_change_id; that single call
   applies every row atomically. Never split a batch into individual proposals or
   confirmations, and never silently omit an invalid row. For an asset or liability edit,
   first call querySnapshots and identify exactly one item_id; if several rows could match,
   show them and ask Gio to choose. Collect snapshot_date, name, kind, category, amount,
   currency, institution, and notes, then call proposeSnapshotChange and show the exact
   returned proposal. Only if Gio's immediately following message explicitly confirms it,
   call confirmSnapshotChange with that pending_change_id. Never send a snapshot proposal
   to confirmTransactionChange or a transaction proposal to confirmSnapshotChange. Net
   worth is assets minus liabilities: calculate or query it, but never edit it directly."* — added
   2026-08-09 (R8) for the mutation flow; the read-only
   portion is the ChatGPT-side equivalent of the original Tool Runner's grounding system
   prompt (research.md R2/R7) and of the Claude.ai side's per-tool-description grounding
   (qa-tools.md).

Steps 1–3 are a one-time manual setup in ChatGPT's UI, not something `tasks.md` implements
in code — but the *result* (which OpenAPI URL, which instructions text) is worth keeping in
this repo as documentation so the GPT can be recreated if lost.
