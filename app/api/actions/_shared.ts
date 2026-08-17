import { NextResponse } from 'next/server';
import { assertBearer } from '@/lib/mcp/auth';
import { createOwnerSessionClient } from '@/lib/supabase/session-client';
import { confirmTransactionChange, executeReadTool, proposeTransactionBatch, proposeTransactionChange } from '@/lib/mcp/tools';

export async function action(request: Request, name: string) {
  try { assertBearer(request); const client = await createOwnerSessionClient(); const input = request.method === 'GET' ? {} : await request.json(); let result: unknown;
    if (name === 'propose_transaction_change') result = await proposeTransactionChange(client, input);
    else if (name === 'propose_transaction_batch') result = await proposeTransactionBatch(client, input);
    else if (name === 'confirm_transaction_change') result = await confirmTransactionChange(client, 'action', String(input.pending_change_id ?? ''));
    else result = await executeReadTool(client, 'action', name, input);
    return NextResponse.json(result);
  } catch (error) { if (error instanceof Response) return new NextResponse(error.body, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status: 400 }); }
}
