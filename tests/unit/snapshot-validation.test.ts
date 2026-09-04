import { describe, expect, it } from 'vitest';
import { parseProposedSnapshotChange, parseSnapshotFields } from '@/lib/snapshot-validation';

const valid = {
  snapshot_date: '2026-09-03',
  name: 'Cuenta de ahorros',
  kind: 'asset',
  category: 'saving',
  amount: 1500000,
  currency: 'cop',
  institution: 'Bancolombia',
  notes: '',
};

describe('snapshot validation', () => {
  it('normalizes complete asset and liability fields', () => {
    expect(parseSnapshotFields(valid)).toMatchObject({ currency: 'COP', institution: 'Bancolombia', notes: null });
  });

  it('requires a target item for edits and rejects direct net-worth fields', () => {
    expect(() => parseProposedSnapshotChange({ ...valid, operation: 'edit' })).toThrow('target_item_id');
    expect(() => parseProposedSnapshotChange({ ...valid, operation: 'create', net_worth: 10 })).toThrow('no permitidos');
    expect(() => parseSnapshotFields({ ...valid, net_worth: 10 })).toThrow('no permitidos');
  });
});
