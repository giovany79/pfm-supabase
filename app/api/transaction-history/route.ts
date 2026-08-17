import { NextResponse } from 'next/server';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import type { TransactionType } from '@/lib/types';

type HistoryRow = {
  transaction_date: string;
  type: TransactionType;
  amount: number;
  category: string;
};

async function allTransactions(
  client: Awaited<ReturnType<typeof createDashboardClient>>,
  ownerId: string,
) {
  const rows: HistoryRow[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('transactions')
      .select('transaction_date,type,amount,category')
      .eq('owner_id', ownerId)
      .order('transaction_date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as HistoryRow[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export async function GET() {
  try {
    const client = await createDashboardClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rows = await allTransactions(client, auth.user.id);
    const months = new Set<string>();
    const categories = {
      income: new Set<string>(),
      expensive: new Set<string>(),
    };
    const monthly = {
      income: new Map<string, Record<string, number>>(),
      expensive: new Map<string, Record<string, number>>(),
    };

    rows.forEach((row) => {
      const month = row.transaction_date.slice(0, 7);
      months.add(month);
      categories[row.type].add(row.category);
      const bucket = monthly[row.type].get(month) ?? {};
      bucket[row.category] =
        (bucket[row.category] ?? 0) + Number(row.amount);
      monthly[row.type].set(month, bucket);
    });

    const orderedMonths = [...months].sort();
    const series = (type: TransactionType) =>
      orderedMonths.map((month) => ({
        month,
        values: monthly[type].get(month) ?? {},
      }));
    const collator = new Intl.Collator('es', { sensitivity: 'base' });

    return NextResponse.json({
      months: orderedMonths,
      income: {
        categories: [...categories.income].sort(collator.compare),
        series: series('income'),
      },
      expense: {
        categories: [...categories.expensive].sort(collator.compare),
        series: series('expensive'),
      },
      row_count: rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible construir el histórico.',
      },
      { status: 400 },
    );
  }
}
