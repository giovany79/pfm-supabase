import { NextResponse } from 'next/server';
import { parseTransactionInput } from '../_validation';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import { deleteTransaction, updateTransaction } from '@/lib/supabase/queries';

async function clientOrUnauthorized() {
  const client = await createDashboardClient();
  const { data } = await client.auth.getUser();
  return data.user ? client : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const client = await clientOrUnauthorized();
    if (!client)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const fields = parseTransactionInput(await request.json());
    const transaction = await updateTransaction(client, id, {
      ...fields,
      operation: 'edit',
      target_transaction_id: id,
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible actualizar el movimiento.' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const client = await clientOrUnauthorized();
    if (!client)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    return NextResponse.json(await deleteTransaction(client, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible eliminar el movimiento.' },
      { status: 400 },
    );
  }
}
