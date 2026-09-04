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
  dateFrom?: string,
  dateTo?: string,
) {
  const rows: HistoryRow[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    let query = client
      .from('transactions')
      .select('transaction_date,type,amount,category')
      .eq('owner_id', ownerId);
    if (dateFrom) query = query.gte('transaction_date', dateFrom);
    if (dateTo) query = query.lte('transaction_date', dateTo);
    const { data, error } = await query
      .order('transaction_date', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as HistoryRow[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export async function GET(request: Request) {
  try {
    const client = await createDashboardClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const dateFrom = params.get('date_from')?.trim() || undefined;
    const dateTo = params.get('date_to')?.trim() || undefined;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (
      (dateFrom && !datePattern.test(dateFrom)) ||
      (dateTo && !datePattern.test(dateTo))
    )
      return NextResponse.json(
        { error: 'Las fechas deben usar el formato YYYY-MM-DD.' },
        { status: 400 },
      );
    if (dateFrom && dateTo && dateFrom > dateTo)
      return NextResponse.json(
        { error: 'La fecha inicial no puede ser posterior a la fecha final.' },
        { status: 400 },
      );

    const rows = await allTransactions(client, auth.user.id, dateFrom, dateTo);
    const months = new Set<string>();
    const categories = {
      income: new Set<string>(),
      expensive: new Set<string>(),
      saving: new Set<string>(),
    };
    const monthly = {
      income: new Map<string, Record<string, number>>(),
      expensive: new Map<string, Record<string, number>>(),
      saving: new Map<string, Record<string, number>>(),
    };

    rows.forEach((row) => {
      const month = row.transaction_date.slice(0, 7);
      months.add(month);
      categories[row.type].add(row.category);
      const bucket = monthly[row.type].get(month) ?? {};
      bucket[row.category] = (bucket[row.category] ?? 0) + Number(row.amount);
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
      saving: {
        categories: [...categories.saving].sort(collator.compare),
        series: series('saving'),
      },
      row_count: rows.length,
      date_range: { from: dateFrom ?? null, to: dateTo ?? null },
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
