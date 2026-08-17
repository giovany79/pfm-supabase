import { NextResponse } from 'next/server';
import { assertBearer } from '@/lib/mcp/auth';
import { createOwnerSessionClient } from '@/lib/supabase/session-client';
import { confirmTransactionChange, executeReadTool, proposeTransactionChange } from '@/lib/mcp/tools';

const tools = ['query_transactions', 'query_snapshots', 'aggregate_transactions', 'propose_transaction_change', 'confirm_transaction_change'];
export async function POST(request: Request) {
  try { assertBearer(request); const body = await request.json(); const client = await createOwnerSessionClient();
    if (body.method === 'initialize') return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2024-11-05', serverInfo: { name: 'pfm-supabase', version: '1.0.0' } } });
    if (body.method === 'tools/list') return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { tools: tools.map((name) => ({ name, description: 'PFM grounded finance tool' })) } });
    if (body.method === 'tools/call') { const name = body.params?.name; const input = body.params?.arguments ?? {}; const result = name === 'propose_transaction_change' ? await proposeTransactionChange(client, input) : name === 'confirm_transaction_change' ? await confirmTransactionChange(client, 'mcp', String(input.pending_change_id ?? '')) : await executeReadTool(client, 'mcp', name, input); return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } }); }
    return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }, { status: 400 });
  } catch (error) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 400 }); }
}
