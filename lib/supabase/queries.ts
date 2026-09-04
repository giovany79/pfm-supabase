import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MutationOperation,
  ProposedChange,
  ProposedSnapshotChange,
  SnapshotFields,
  TransactionDraft,
  Transaction,
  TransactionType,
} from '@/lib/types';

async function owner(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Unauthenticated Supabase session');
  return data.user.id;
}
export type TransactionFilters = {
  date_from?: string;
  date_to?: string;
  category?: string;
  type?: TransactionType;
  limit?: number;
};
export async function queryTransactions(
  client: SupabaseClient,
  filters: TransactionFilters = {},
) {
  const ownerId = await owner(client);
  let query = client
    .from('transactions')
    .select('*')
    .eq('owner_id', ownerId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit ?? 100, 500));
  if (filters.date_from)
    query = query.gte('transaction_date', filters.date_from);
  if (filters.date_to) query = query.lte('transaction_date', filters.date_to);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.type) query = query.eq('type', filters.type);
  const { data, error } = await query;
  if (error) throw error;
  return { rows: data ?? [], row_count: data?.length ?? 0 };
}
export async function querySnapshots(
  client: SupabaseClient,
  filters: {
    as_of_date?: string;
    kind?: 'asset' | 'liability';
    category?: string;
    institution?: string;
  } = {},
) {
  const ownerId = await owner(client);
  let query = client
    .from('snapshots')
    .select('*')
    .eq('owner_id', ownerId)
    .order('snapshot_date', { ascending: false });
  if (filters.as_of_date)
    query = query.lte('snapshot_date', filters.as_of_date);
  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.institution) query = query.eq('institution', filters.institution);
  const { data, error } = await query;
  if (error) throw error;
  const latest = Array.from(
    new Map((data ?? []).map((row) => [row.item_id, row])).values(),
  );
  return { rows: latest, row_count: latest.length };
}
export async function aggregateTransactions(
  client: SupabaseClient,
  filters: {
    group_by: 'category' | 'month';
    date_from?: string;
    date_to?: string;
    type?: TransactionType;
  },
) {
  const result = await queryTransactions(client, { ...filters, limit: 500 });
  const groups = Object.values(
    result.rows.reduce(
      (
        all: Record<string, { group: string; sum: number; count: number }>,
        row: Transaction,
      ) => {
        const group =
          filters.group_by === 'month'
            ? row.transaction_date.slice(0, 7)
            : row.category;
        all[group] ??= { group, sum: 0, count: 0 };
        all[group].sum += Number(row.amount);
        all[group].count += 1;
        return all;
      },
      {},
    ),
  );
  return { groups, row_count: groups.length, trace_filters: filters };
}
export async function dashboardMetrics(
  client: SupabaseClient,
  dateFrom?: string,
  dateTo?: string,
) {
  const snapshots = await querySnapshots(client);
  const transactions = await queryTransactions(client, {
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });
  const ownerId = await owner(client);
  const byCurrency: Record<
    string,
    { total_assets: number; total_liabilities: number }
  > = {};
  for (const row of snapshots.rows) {
    const bucket = (byCurrency[row.currency] ??= {
      total_assets: 0,
      total_liabilities: 0,
    });
    if (row.kind === 'asset') bucket.total_assets += Number(row.amount);
    else bucket.total_liabilities += Number(row.amount);
  }
  const { data: rates, error } = await client
    .from('exchange_rates')
    .select('*')
    .eq('owner_id', ownerId)
    .lte('effective_date', new Date().toISOString().slice(0, 10))
    .order('effective_date', { ascending: false });
  if (error) throw error;
  const latestRates = new Map((rates ?? []).map((r) => [r.currency, r]));
  let totalAssets = 0,
    totalLiabilities = 0;
  const rates_used: unknown[] = [];
  const unconverted_currencies: string[] = [];
  for (const [currency, value] of Object.entries(byCurrency)) {
    const rate =
      currency === 'COP'
        ? { currency: 'COP', rate_to_cop: 1, effective_date: 'native' }
        : latestRates.get(currency);
    if (!rate) {
      unconverted_currencies.push(currency);
      continue;
    }
    totalAssets += value.total_assets * Number(rate.rate_to_cop);
    totalLiabilities += value.total_liabilities * Number(rate.rate_to_cop);
    rates_used.push(rate);
  }
  const expenseRows = transactions.rows.filter(
    (r: Transaction) => r.type === 'expensive',
  );
  const incomeRows = transactions.rows.filter(
    (r: Transaction) => r.type === 'income',
  );
  const totalsByCategory = (rows: Transaction[]) =>
    Object.values(
      rows.reduce(
        (
          all: Record<string, { category: string; amount: number }>,
          row: Transaction,
        ) => {
          all[row.category] ??= { category: row.category, amount: 0 };
          all[row.category].amount += Number(row.amount);
          return all;
        },
        {},
      ),
    );
  const spending = totalsByCategory(expenseRows);
  const incomeByCategory = totalsByCategory(incomeRows);
  const categoryTotals = (kind: 'asset' | 'liability') =>
    snapshots.rows
      .filter((row) => row.kind === kind)
      .map((row) => ({
        category: row.category,
        amount: Number(row.amount),
        currency: row.currency,
      }));
  return {
    net_worth: {
      by_currency: byCurrency,
      converted_cop: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net: totalAssets - totalLiabilities,
      },
      rates_used,
      unconverted_currencies,
    },
    assets_by_category: categoryTotals('asset'),
    liabilities_by_category: categoryTotals('liability'),
    income_vs_expense: {
      income: incomeRows.reduce(
        (n: number, r: Transaction) => n + Number(r.amount),
        0,
      ),
      expense: expenseRows.reduce(
        (n: number, r: Transaction) => n + Number(r.amount),
        0,
      ),
    },
    income_by_category: incomeByCategory,
    spending_by_category: spending,
    date_range: { from: dateFrom ?? null, to: dateTo ?? null },
    has_data: snapshots.row_count > 0 || transactions.row_count > 0,
  };
}
export async function createTransaction(
  client: SupabaseClient,
  fields: ProposedChange,
) {
  const ownerId = await owner(client);
  const row = {
    transaction_id: crypto.randomUUID(),
    owner_id: ownerId,
    description: fields.description!,
    type: fields.type_income_expense!,
    amount: fields.amount!,
    category: fields.category!,
    transaction_date: fields.date!,
  };
  const { data, error } = await client
    .from('transactions')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTransactionsBatch(
  client: SupabaseClient,
  transactions: TransactionDraft[],
) {
  const ownerId = await owner(client);
  const rows = transactions.map((fields) => ({
    transaction_id: crypto.randomUUID(),
    owner_id: ownerId,
    description: fields.description,
    type: fields.type_income_expense,
    amount: fields.amount,
    category: fields.category,
    transaction_date: fields.date,
  }));
  const { data, error } = await client
    .from('transactions')
    .insert(rows)
    .select('transaction_id');
  if (error) throw error;
  return data ?? [];
}
export async function updateTransaction(
  client: SupabaseClient,
  id: string,
  fields: ProposedChange,
) {
  const ownerId = await owner(client);
  const patch: Record<string, unknown> = {};
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.amount !== undefined) patch.amount = fields.amount;
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.date !== undefined) patch.transaction_date = fields.date;
  if (fields.type_income_expense !== undefined)
    patch.type = fields.type_income_expense;
  const { data, error } = await client
    .from('transactions')
    .update(patch)
    .eq('owner_id', ownerId)
    .eq('transaction_id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function deleteTransaction(client: SupabaseClient, id: string) {
  const ownerId = await owner(client);
  const { error } = await client
    .from('transactions')
    .delete()
    .eq('owner_id', ownerId)
    .eq('transaction_id', id);
  if (error) throw error;
  return { transaction_id: id };
}
export async function applyMutation(
  client: SupabaseClient,
  change: ProposedChange,
) {
  if (change.operation === 'create') return createTransaction(client, change);
  if (change.operation === 'edit')
    return updateTransaction(client, change.target_transaction_id!, change);
  return deleteTransaction(client, change.target_transaction_id!);
}
export async function currentOwnerId(client: SupabaseClient) {
  return owner(client);
}

export async function createSnapshot(
  client: SupabaseClient,
  fields: SnapshotFields,
) {
  const ownerId = await owner(client);
  const row = {
    item_id: crypto.randomUUID(),
    owner_id: ownerId,
    ...fields,
  };
  const { data, error } = await client
    .from('snapshots')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSnapshot(
  client: SupabaseClient,
  itemId: string,
  fields: SnapshotFields,
) {
  const ownerId = await owner(client);
  const { data, error } = await client
    .from('snapshots')
    .update(fields)
    .eq('owner_id', ownerId)
    .eq('item_id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function applySnapshotMutation(
  client: SupabaseClient,
  change: ProposedSnapshotChange,
) {
  const fields: SnapshotFields = {
    snapshot_date: change.snapshot_date,
    name: change.name,
    kind: change.kind,
    category: change.category,
    amount: change.amount,
    currency: change.currency,
    institution: change.institution,
    notes: change.notes,
  };
  if (change.operation === 'create') return createSnapshot(client, fields);
  return updateSnapshot(client, change.target_item_id!, fields);
}
