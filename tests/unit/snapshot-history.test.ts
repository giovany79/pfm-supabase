import { describe, expect, it } from 'vitest';
import { buildSnapshotHistory, type SnapshotHistorySource } from '@/lib/snapshot-history';

const row = (
  values: Partial<SnapshotHistorySource> & Pick<SnapshotHistorySource, 'item_id' | 'snapshot_date' | 'name' | 'kind' | 'amount'>,
): SnapshotHistorySource => ({
  category: 'saving',
  currency: 'COP',
  institution: null,
  ...values,
});

describe('snapshot history', () => {
  it('carries the latest item valuation into later general totals', () => {
    const result = buildSnapshotHistory([
      row({ item_id: '1', snapshot_date: '2026-01-01', name: 'Cuenta', kind: 'asset', amount: 100 }),
      row({ item_id: '2', snapshot_date: '2026-01-01', name: 'Crédito', kind: 'liability', amount: 40, category: 'loan' }),
      row({ item_id: '3', snapshot_date: '2026-02-01', name: 'Cuenta', kind: 'asset', amount: 130 }),
    ]);

    expect(result.general.COP).toEqual([
      { date: '2026-01-01', assets: 100, liabilities: 40, net: 60 },
      { date: '2026-02-01', assets: 130, liabilities: 40, net: 90 },
    ]);
  });

  it('keeps currencies separate and groups valuations for each item', () => {
    const result = buildSnapshotHistory([
      row({ item_id: '1', snapshot_date: '2026-01-01', name: 'Cuenta', kind: 'asset', amount: 100 }),
      row({ item_id: '2', snapshot_date: '2026-02-01', name: 'Cuenta', kind: 'asset', amount: 125 }),
      row({ item_id: '3', snapshot_date: '2026-02-01', name: 'Broker', kind: 'asset', amount: 25, currency: 'USD', category: 'investments' }),
    ]);

    expect(result.currencies).toEqual(['COP', 'USD']);
    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => item.name === 'Cuenta')?.series).toEqual([
      { date: '2026-01-01', amount: 100 },
      { date: '2026-02-01', amount: 125 },
    ]);
  });
});
