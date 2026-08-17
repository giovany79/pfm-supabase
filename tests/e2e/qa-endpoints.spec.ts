import { expect, test } from '@playwright/test';

const baseUrl = process.env.PFM_E2E_BASE_URL ?? 'https://pfm-supabase.vercel.app';
const apiKey = process.env.MCP_ACTIONS_API_KEY;
const authorization: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
const mcpHeaders = { ...authorization, Accept: 'application/json, text/event-stream' };

test.describe('deployed MCP and Actions endpoints', () => {
  test.skip(!apiKey, 'MCP_ACTIONS_API_KEY is required for the authenticated endpoint checks');

  test('rejects unauthenticated MCP and Action requests', async ({ request }) => {
    const mcp = await request.post(`${baseUrl}/api/mcp`, {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    const action = await request.post(`${baseUrl}/api/actions/query-transactions`, { data: {} });

    expect(mcp.status()).toBe(401);
    expect(action.status()).toBe(401);
  });

  test('initializes and exposes six typed MCP tools', async ({ request }) => {
    const initialized = await request.post(`${baseUrl}/api/mcp`, {
      headers: mcpHeaders,
      data: {
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'pfm-e2e', version: '1.0.0' },
        },
      },
    });
    expect(initialized.ok()).toBe(true);
    const initializeBody = await initialized.json();
    expect(initializeBody.result.capabilities.tools).toBeDefined();

    const listed = await request.post(`${baseUrl}/api/mcp`, {
      headers: mcpHeaders,
      data: { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} },
    });
    expect(listed.ok()).toBe(true);
    const listBody = await listed.json();
    expect(listBody.result.tools).toHaveLength(6);
    expect(listBody.result.tools.every((tool: { inputSchema?: { type?: string } }) => tool.inputSchema?.type === 'object')).toBe(true);
  });

  test('returns grounded results from MCP and every read Action', async ({ request }) => {
    const mcp = await request.post(`${baseUrl}/api/mcp`, {
      headers: mcpHeaders,
      data: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'query_transactions', arguments: { limit: 1 } },
      },
    });
    expect(mcp.ok()).toBe(true);
    const mcpBody = await mcp.json();
    const mcpResult = JSON.parse(mcpBody.result.content[0].text);
    expect(typeof mcpResult.row_count).toBe('number');

    const actionCases = [
      ['query-transactions', { limit: 1 }],
      ['query-snapshots', {}],
      ['aggregate-transactions', { group_by: 'category', type: 'expensive' }],
    ] as const;

    for (const [path, data] of actionCases) {
      const response = await request.post(`${baseUrl}/api/actions/${path}`, {
        headers: authorization,
        data,
      });
      expect(response.ok()).toBe(true);
      const result = await response.json();
      expect(typeof result.row_count).toBe('number');
    }
  });
});
