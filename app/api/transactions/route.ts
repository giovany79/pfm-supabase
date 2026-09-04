import { NextResponse } from 'next/server';
import { parseTransactionInput } from './_validation';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import { createTransaction, queryTransactions } from '@/lib/supabase/queries';
import type { TransactionType } from '@/lib/types';

async function authenticatedClient() {
  const client = await createDashboardClient();
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  return { client, ownerId: data.user.id };
}

async function allTransactionCategories(
  client: Awaited<ReturnType<typeof createDashboardClient>>,
  ownerId: string,
) {
  const categories = new Set<string>();
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('transactions')
      .select('category')
      .eq('owner_id', ownerId)
      .order('category')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    (data ?? []).forEach((row) => categories.add(row.category));
    if (!data || data.length < pageSize) break;
  }

  return [...categories].sort((left, right) =>
    left.localeCompare(right, 'es', { sensitivity: 'base' }),
  );
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const rawType = params.get('type');
    const type =
      rawType === 'income' || rawType === 'expensive' || rawType === 'saving'
        ? (rawType as TransactionType)
        : undefined;
    const category = params.get('category')?.trim() || undefined;
    const result = await queryTransactions(auth.client, {
      type,
      category,
      date_from: params.get('date_from') || undefined,
      date_to: params.get('date_to') || undefined,
      limit: 500,
    });
    const categories = await allTransactionCategories(
      auth.client,
      auth.ownerId,
    );

    return NextResponse.json({ ...result, categories });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible consultar los movimientos.',
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient();
    if (!auth)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const fields = parseTransactionInput(await request.json());
    const transaction = await createTransaction(auth.client, fields);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible crear el movimiento.',
      },
      { status: 400 },
    );
  }
}
