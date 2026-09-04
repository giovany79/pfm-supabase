import type { Snapshot, SnapshotKind } from '@/lib/types';

export type SnapshotHistorySource = Pick<
  Snapshot,
  | 'item_id'
  | 'snapshot_date'
  | 'name'
  | 'kind'
  | 'category'
  | 'amount'
  | 'currency'
  | 'institution'
> & { created_at?: string };

export type SnapshotHistoryPoint = {
  date: string;
  assets: number;
  liabilities: number;
  net: number;
};

export type SnapshotItemHistory = {
  key: string;
  name: string;
  kind: SnapshotKind;
  category: string;
  currency: string;
  institution: string | null;
  series: Array<{ date: string; amount: number }>;
};

const normalized = (value: string | null) =>
  (value ?? '').trim().toLocaleLowerCase('es');

export function snapshotIdentity(row: SnapshotHistorySource) {
  return [
    row.kind,
    normalized(row.name),
    normalized(row.category),
    normalized(row.institution),
    row.currency.trim().toUpperCase(),
  ].join('|');
}

export function buildSnapshotHistory(rows: SnapshotHistorySource[]) {
  const ordered = [...rows].sort((left, right) =>
    left.snapshot_date.localeCompare(right.snapshot_date) ||
    (left.created_at ?? '').localeCompare(right.created_at ?? ''),
  );
  const currencies = [...new Set(ordered.map((row) => row.currency.toUpperCase()))].sort();
  const general: Record<string, SnapshotHistoryPoint[]> = {};
  const items = new Map<string, SnapshotItemHistory>();

  for (const currency of currencies) {
    const currencyRows = ordered.filter(
      (row) => row.currency.toUpperCase() === currency,
    );
    const dates = [...new Set(currencyRows.map((row) => row.snapshot_date))];
    const current = new Map<string, SnapshotHistorySource>();

    general[currency] = dates.map((date) => {
      currencyRows
        .filter((row) => row.snapshot_date === date)
        .forEach((row) => current.set(snapshotIdentity(row), row));

      let assets = 0;
      let liabilities = 0;
      current.forEach((row) => {
        if (row.kind === 'asset') assets += Number(row.amount);
        else liabilities += Number(row.amount);
      });

      return { date, assets, liabilities, net: assets - liabilities };
    });
  }

  ordered.forEach((row) => {
    const key = snapshotIdentity(row);
    const item = items.get(key) ?? {
      key,
      name: row.name,
      kind: row.kind,
      category: row.category,
      currency: row.currency.toUpperCase(),
      institution: row.institution,
      series: [],
    };
    const point = item.series.find((entry) => entry.date === row.snapshot_date);
    if (point) point.amount = Number(row.amount);
    else item.series.push({ date: row.snapshot_date, amount: Number(row.amount) });
    items.set(key, item);
  });

  const collator = new Intl.Collator('es', { sensitivity: 'base' });
  return {
    currencies,
    general,
    items: [...items.values()].sort(
      (left, right) =>
        left.kind.localeCompare(right.kind) || collator.compare(left.name, right.name),
    ),
    row_count: rows.length,
  };
}
