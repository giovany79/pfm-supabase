# Contract: Q&A Tool Definitions

**Revised 2026-08-09 (research.md R7)**: the three read tools below (`query_transactions`,
`query_snapshots`, `aggregate_transactions`) are the same narrow, parameterized data-access
surface originally designed for an in-app Tool Runner — the *definitions* are unchanged and
remain the single source of truth for tool shape. What changed is *how they're invoked*:
they are no longer called by this system's own Claude API loop. Instead they are realized
as:

**Revised again 2026-08-09 (research.md R8, constitution v1.2.0)**: two mutation tools —
`propose_transaction_change` and `confirm_transaction_change` — are added below, per spec
FR-015–FR-023. They share the same narrow-tool, no-raw-SQL discipline as the read tools;
see research.md R8 §8.1 for the two-step design rationale.

- **MCP tools** exposed by the Streamable HTTP MCP server at `/api/mcp` — consumed by a
  Claude.ai custom connector. See [mcp-server.md](mcp-server.md) for the wire protocol.
- **REST Actions** exposed under `/api/actions/*` with an OpenAPI schema at
  `/api/actions/openapi.json` — consumed by a ChatGPT Custom GPT. See
  [gpt-actions.md](gpt-actions.md) for the OpenAPI mapping.

Both transports call the exact same handler functions in `lib/mcp/tools.ts`, which in turn
call through `lib/supabase/queries.ts` — one implementation, two thin adapters. No raw-SQL
tool exists on either surface (constitution Principle II, V; see research.md R2).

## `query_transactions`

```json
{
  "name": "query_transactions",
  "description": "Retrieve income/expense transactions matching the given filters. Use this to answer questions about specific transactions, spending in a category or date range, or to list matching records. Returns matching rows and the total count. Returns an empty result (not an error) when nothing matches. IMPORTANT: base your answer only on the rows returned here; if row_count is 0, state plainly that there is no matching data rather than guessing.",
  "input_schema": {
    "type": "object",
    "properties": {
      "date_from": { "type": "string", "format": "date", "description": "Inclusive start date (YYYY-MM-DD). Omit for no lower bound." },
      "date_to": { "type": "string", "format": "date", "description": "Inclusive end date (YYYY-MM-DD). Omit for no upper bound." },
      "category": { "type": "string", "description": "Exact category match, e.g. 'health'. Omit for all categories." },
      "type": { "type": "string", "enum": ["income", "expensive"], "description": "Filter to income or expense transactions only. Omit for both." },
      "limit": { "type": "integer", "description": "Max rows to return, default 100, max 500 — use aggregate_transactions instead of a high limit for totals/sums." }
    },
    "additionalProperties": false
  }
}
```

## `query_snapshots`

```json
{
  "name": "query_snapshots",
  "description": "Retrieve asset/liability snapshot records matching the given filters. Use this for questions about specific holdings, accounts, or point-in-time asset/liability values. Returns matching rows and the total count. Returns an empty result (not an error) when nothing matches. IMPORTANT: snapshots can span multiple currencies (see the `currency` field on each row) — never sum or compare amounts across different currencies without saying so explicitly in your answer.",
  "input_schema": {
    "type": "object",
    "properties": {
      "as_of_date": { "type": "string", "format": "date", "description": "Return the most recent snapshot for each item as of this date. Omit to use the latest available snapshots." },
      "kind": { "type": "string", "enum": ["asset", "liability"], "description": "Filter to assets or liabilities only. Omit for both." },
      "category": { "type": "string", "description": "Exact category match, e.g. 'crypto'. Omit for all categories." },
      "institution": { "type": "string", "description": "Exact institution match. Omit for all institutions." }
    },
    "additionalProperties": false
  }
}
```

## `aggregate_transactions`

```json
{
  "name": "aggregate_transactions",
  "description": "Compute sums and counts of transactions grouped by category or by month, optionally filtered. Use this for totals, averages, and trend questions (e.g. 'how much did I spend on X', 'how has spending changed over time') instead of retrieving individual rows and summing them yourself. IMPORTANT: base your answer only on the groups returned here; if the result is empty, state plainly that there is no matching data rather than estimating.",
  "input_schema": {
    "type": "object",
    "properties": {
      "group_by": { "type": "string", "enum": ["category", "month"], "description": "Dimension to aggregate by." },
      "date_from": { "type": "string", "format": "date" },
      "date_to": { "type": "string", "format": "date" },
      "type": { "type": "string", "enum": ["income", "expensive"], "description": "Omit to aggregate both income and expenses together — callers should usually set this explicitly to avoid mixing signs." }
    },
    "required": ["group_by"],
    "additionalProperties": false
  }
}
```

## `propose_transaction_change`

```json
{
  "name": "propose_transaction_change",
  "description": "Step 1 of 2 for creating, editing, or permanently deleting a transaction. Call this ONLY after you have already shown Gio the specific transaction (via query_transactions, for edit/delete) or the full set of new-transaction fields (for create) and he has asked for the change. This does NOT modify any data — it returns a pending_change_id and a summary you MUST show Gio verbatim, then wait for his explicit confirmation in his very next message before calling confirm_transaction_change. Never call confirm_transaction_change speculatively or without a fresh 'yes' from Gio.",
  "input_schema": {
    "type": "object",
    "properties": {
      "operation": { "type": "string", "enum": ["create", "edit", "delete"] },
      "target_transaction_id": { "type": "string", "format": "uuid", "description": "Required for edit/delete — the exact transaction_id from a prior query_transactions result. Omit for create. If Gio's description matched more than one transaction, you must have already asked him to pick one by ID before calling this." },
      "date": { "type": "string", "format": "date", "description": "Required for create; include for edit only if the date is changing." },
      "description": { "type": "string", "description": "Required for create; include for edit only if changing." },
      "amount": { "type": "number", "description": "Required for create; include for edit only if changing." },
      "category": { "type": "string", "description": "Required for create; include for edit only if changing." },
      "type_income_expense": { "type": "string", "enum": ["income", "expensive"], "description": "Required for create; include for edit only if changing." }
    },
    "required": ["operation"],
    "additionalProperties": false
  }
}
```

**Response**: `{ "pending_change_id": "<uuid>", "expires_at": "<ISO timestamp, ~5 min out>", "summary": "<human-readable description of exactly what will happen>" }` for a valid request, or a `400`-equivalent validation error listing the specific missing/invalid fields (e.g. for `create` with a missing `category` — FR-021) without creating any pending change.

## `confirm_transaction_change`

```json
{
  "name": "confirm_transaction_change",
  "description": "Step 2 of 2. Call this ONLY in direct response to Gio explicitly confirming (e.g. 'yes', 'confirmado') the exact change summary propose_transaction_change just returned, in his immediate next message. If Gio's reply is anything other than a clear confirmation of that specific summary, or if any time has passed and you are unsure, do not call this — ask again or restate the proposal instead.",
  "input_schema": {
    "type": "object",
    "properties": {
      "pending_change_id": { "type": "string", "format": "uuid" }
    },
    "required": ["pending_change_id"],
    "additionalProperties": false
  }
}
```

**Response**: `{ "outcome": "success", "operation": "create" | "edit" | "delete", "transaction_id": "<uuid>", "applied_fields": { ... } }` on success (FR-017 — report the outcome and identify the transaction), or `{ "outcome": "failure", "reason": "expired" | "not_found" }` — a `reason: "expired"` response means the 5-minute confirmation window (FR-016) has passed; `reason: "not_found"` covers both an unknown ID and one already consumed by an earlier confirm call, since a `pending_transaction_changes` row is deleted immediately once it's used or found expired (research.md R8 §8.1/§8.3, revised post-`/speckit-analyze` finding CA2 — no row lingers with its real field values after it stops being needed). Either way, the calling model MUST restate the proposed change (call `proposeTransactionChange` again) and ask Gio to confirm afresh rather than retrying the same `pending_change_id`.

## Grounding contract (applies on every call, on both surfaces)

1. **Every tool description above carries its own grounding instruction** — since this
   system no longer supplies a system prompt around a Tool Runner loop, the instruction has
   to travel with the tool itself. This is the primary lever left to steer the calling
   model on these surfaces (reinforced on the ChatGPT side by the Custom GPT's
   "Instructions" field — see gpt-actions.md).
2. **Empty-result handling**: every tool returns `{ rows: [], row_count: 0 }` (or
   `{ groups: [], row_count: 0 }` for aggregates) rather than throwing, on no match.
3. **No tool may accept a free-text query, filter expression, or SQL fragment** — every
   parameter is a typed, enum- or format-constrained field, identical on the MCP and REST
   Actions transports (JSON Schema and OpenAPI parameter schemas are generated from the
   same source definitions above).
4. **Every read call is logged** to `qa_queries` (`channel`, `tool_name`, `input`,
   `row_count`) — the audit trail of what data was accessed, since (per research.md R7)
   this system does not see the surrounding question or the model's final answer text on
   these surfaces. Every result a read tool returns (rows or aggregate groups) carries the
   source record's identifier(s) (`transaction_id`/`item_id`) so the calling model can cite
   what it grounded its answer in (spec FR-007, revised 2026-08-09) — `aggregate_transactions`
   is the one exception: it returns grouped sums/counts, not per-row IDs, since re-running
   `query_transactions` with the same filters is how a total is traced back to individual
   rows without every aggregate response carrying a potentially large ID array.
5. **Authentication**: every call on both transports MUST include
   `Authorization: Bearer <MCP_ACTIONS_API_KEY>` — requests without a valid token are
   rejected before reaching `lib/supabase/queries.ts` (FR-012, constitution "Q&A delivery
   surface" constraint).
6. **Mutations are never automatic** (added 2026-08-09, research.md R8, constitution
   v1.2.0; reworded post-`/speckit-analyze`, finding CA1): `confirm_transaction_change`
   only ever applies a change that was (a) previously proposed via
   `propose_transaction_change`, (b) shown to Gio verbatim, and (c) confirmed within the
   short, bounded expiry window (a server-side TTL — the system has no way to verify it was
   literally Gio's "next message", so each tool's description separately instructs the
   calling model never to confirm speculatively); an expired or unknown `pending_change_id`
   MUST fail (`reason: "expired"` or `"not_found"` — a consumed row is deleted, not merely
   flagged, so it also surfaces as `"not_found"`) rather than apply anything (FR-016).
   Every `confirm_transaction_change` call — success or failure — is logged to
   `transaction_mutations` with the redacted schema from data-model.md; the financial field
   values themselves are never persisted to that log (constitution Principle II).
