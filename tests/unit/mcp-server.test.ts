import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/mcp/route';

const originalApiKey = process.env.MCP_ACTIONS_API_KEY;

function mcpRequest(body: unknown, token = 'test-mcp-key') {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.MCP_ACTIONS_API_KEY = 'test-mcp-key';
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.MCP_ACTIONS_API_KEY;
  else process.env.MCP_ACTIONS_API_KEY = originalApiKey;
});

describe('finance MCP server', () => {
  it('advertises tool capabilities and confirmation instructions during initialization', async () => {
    const response = await POST(
      mcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.serverInfo.name).toBe('pfm-supabase-qa');
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.instructions).toContain('propose_transaction_change');
    expect(body.result.instructions).toContain('confirm_transaction_change');
    expect(body.result.instructions).toContain('ask for one confirmation covering the entire batch');
    expect(body.result.instructions).toContain('Never split a batch into individual proposals or confirmations');
  });

  it('lists six typed tools and marks confirmation as destructive', async () => {
    const response = await POST(mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
    const body = await response.json();
    const tools = body.result.tools as Array<Record<string, any>>;

    expect(response.status).toBe(200);
    expect(tools).toHaveLength(6);
    expect(tools.every((tool) => tool.inputSchema?.type === 'object')).toBe(true);
    expect(tools.find((tool) => tool.name === 'aggregate_transactions')?.inputSchema.required).toContain(
      'group_by',
    );
    expect(tools.find((tool) => tool.name === 'propose_transaction_batch')?.inputSchema.properties.transactions).toMatchObject({
      minItems: 2,
      maxItems: 20,
    });
    expect(tools.find((tool) => tool.name === 'propose_transaction_batch')?.description).toContain(
      'one explicit confirmation covering the entire batch',
    );
    expect(tools.find((tool) => tool.name === 'confirm_transaction_change')?.description).toContain(
      'this one call applies every row atomically',
    );
    expect(tools.find((tool) => tool.name === 'confirm_transaction_change')?.annotations.destructiveHint).toBe(
      true,
    );
  });

  it('rejects requests without the configured bearer token', async () => {
    const response = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
