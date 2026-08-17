import { describe, expect, it } from 'vitest';
import { upsertTransactions } from '@/lib/migration/upsert';

describe('upsertTransactions', () => {
  it('uses the transaction natural key for idempotency', async () => {
    let conflict = '';
    const client = { from: () => ({ upsert: (_rows: unknown, options: { onConflict: string }) => { conflict = options.onConflict; return Promise.resolve({ error: null }); } }) } as any;
    await upsertTransactions(client, [{ transaction_id: 'id', owner_id: 'owner', description: 'x', type: 'income', amount: 1, category: 'work', transaction_date: '2026-01-01' }]);
    expect(conflict).toBe('transaction_id');
  });
});
