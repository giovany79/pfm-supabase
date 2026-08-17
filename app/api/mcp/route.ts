import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { assertBearer } from '@/lib/mcp/auth';
import { createFinanceMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';

async function handleMcpRequest(request: Request) {
  try {
    assertBearer(request);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createFinanceMcpServer();
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;
