# Contract: MCP Server (Claude.ai, Claude Code, and Codex clients)

**Added 2026-08-09 (research.md R7)**. A single Streamable HTTP MCP endpoint exposing the
tools defined in [qa-tools.md](qa-tools.md) — three read tools plus the three mutation-flow
tools (`propose_transaction_change`, `propose_transaction_batch`,
`confirm_transaction_change`).
Configured once in claude.ai under Settings → Connectors as a custom connector pointing at
this URL. **This surface is optional/best-effort** (spec Assumptions, 2026-08-09) — ChatGPT
(gpt-actions.md) is the mandatory surface; nothing in this file gates a success criterion.
The same endpoint can also be consumed from Codex and Claude Code as project-scoped agent
tooling. Their checked-in configuration references `MCP_ACTIONS_API_KEY` from the process
environment and never embeds its value.

## Endpoint

```
POST https://<deployed-host>/api/mcp
```

Implements the MCP Streamable HTTP transport (JSON-RPC 2.0 over a single HTTP endpoint,
per the MCP spec). No SSE-only or stdio transport is used — Streamable HTTP is required for
claude.ai's remote-connector support.

## Authentication

Every request MUST carry:

```
Authorization: Bearer <MCP_ACTIONS_API_KEY>
```

Configured once in claude.ai's connector setup ("Custom Header" / bearer token field, per
whatever claude.ai's connector UI exposes at setup time). A missing or invalid token returns
`401` before any MCP method is processed. `MCP_ACTIONS_API_KEY` is generated once (a long
random string, e.g. `openssl rand -hex 32`), stored as a Next.js env var, never committed
(constitution Principle II).

## MCP methods implemented

| Method | Behavior |
|---|---|
| `initialize` | Standard MCP handshake; server declares `tools` capability and server-wide grounding/confirmation instructions (no `resources` or `prompts`) |
| `tools/list` | Returns all six tool definitions from qa-tools.md (three read, two proposal tools, and one confirmation tool), translated to MCP's `Tool` shape (`name`, `description`, `inputSchema`) |
| `tools/call` | Dispatches to `lib/mcp/tools.ts`'s handler for the named tool, validates input against the schema, calls `lib/supabase/queries.ts` via `lib/supabase/session-client.ts` (never the service-role client — research.md R8), logs the call — reads to `qa_queries` with `channel: 'mcp'`, `confirm_transaction_change` calls to `transaction_mutations` with `channel: 'mcp'` (redacted schema, no field values) — and returns the result as MCP `content` (a single `text` block containing the JSON result — Claude reads structured data from tool results routinely) |

## Server info

```json
{ "name": "pfm-supabase-qa", "version": "1.2.1" }
```

## Agent client configuration

- **Codex**: `.codex/config.toml` uses Streamable HTTP, reads the bearer token from the
  `MCP_ACTIONS_API_KEY` environment variable, auto-allows reads, and prompts for writes.
- **Claude Code**: `.mcp.json` uses `type: "http"` and expands
  `Authorization: Bearer ${MCP_ACTIONS_API_KEY}` at runtime. Project MCP approval remains a
  deliberate one-time manual action in a trusted workspace.
- Both clients connect to `https://pfm-supabase.vercel.app/api/mcp` and receive the same six
  tool definitions and confirmation workflow.

## Example `tools/call` request/response

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "aggregate_transactions",
    "arguments": { "group_by": "category", "date_from": "2026-07-01", "date_to": "2026-07-31", "type": "expensive" }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "{\"groups\":[{\"category\":\"health\",\"amount\":100500,\"count\":1}],\"row_count\":1}" }
    ]
  }
}
```

## Error handling

- Invalid/missing bearer token → HTTP `401`, no JSON-RPC body needed.
- Unknown tool name → JSON-RPC error `-32601` ("Method not found" equivalent for tools).
- Input fails schema validation → JSON-RPC error `-32602` ("Invalid params"), with the
  validation message — never partially execute a malformed call.
- Downstream Supabase error → JSON-RPC error `-32000` (server error), generic message only
  (constitution Principle II: never leak financial data or connection details in an error
  message sent back over this channel).
