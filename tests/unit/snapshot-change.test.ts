import { describe, expect, it } from 'vitest';
import { confirmSnapshotChange, confirmTransactionChange, proposeSnapshotChange } from '@/lib/mcp/tools';

const change = {
  operation: 'create',
  snapshot_date: '2026-09-03',
  name: 'Cuenta de ahorros',
  kind: 'asset',
  category: 'saving',
  amount: 1500000,
  currency: 'COP',
  institution: 'Bancolombia',
  notes: null,
};

describe('snapshot proposal and confirmation', () => {
  it('stores a five-minute proposal without writing a snapshot', async () => {
    let pending: Record<string, unknown> | undefined;
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }) },
      from: (table: string) => {
        if (table !== 'pending_transaction_changes') throw new Error('must not write snapshots');
        return { insert: (row: Record<string, unknown>) => {
          pending = row;
          return { select: () => ({ single: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111', expires_at: row.expires_at }, error: null }) }) };
        } };
      },
    } as any;

    const result = await proposeSnapshotChange(client, change);
    expect(result).toMatchObject({ pending_change_id: '11111111-1111-4111-8111-111111111111', snapshot: { currency: 'COP' } });
    expect(pending?.proposed_fields).toMatchObject({ entity: 'snapshot', operation: 'create' });
  });

  it('applies the complete asset after one explicit confirmation call', async () => {
    let insertedSnapshot: Record<string, unknown> | undefined;
    let auditRow: Record<string, unknown> | undefined;
    const pendingQuery = {
      eq() { return this; },
      maybeSingle: async () => ({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          proposed_fields: { entity: 'snapshot', ...change },
        },
        error: null,
      }),
    };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }) },
      from: (table: string) => {
        if (table === 'pending_transaction_changes') return {
          select: () => pendingQuery,
          delete: () => ({ eq: async () => ({ error: null }) }),
        };
        if (table === 'snapshots') return {
          insert: (row: Record<string, unknown>) => {
            insertedSnapshot = row;
            return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
          },
        };
        if (table === 'system_state') return { upsert: async () => ({ error: null }) };
        if (table === 'snapshot_mutations') return { insert: async (row: Record<string, unknown>) => { auditRow = row; return { error: null }; } };
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await confirmSnapshotChange(client, 'action', '11111111-1111-4111-8111-111111111111');
    expect(result).toMatchObject({ outcome: 'success', operation: 'create' });
    expect(insertedSnapshot).toMatchObject({ owner_id: 'owner-id', name: 'Cuenta de ahorros', kind: 'asset' });
    expect(auditRow).toMatchObject({ operation: 'create', outcome: 'success' });
  });

  it('cannot apply a snapshot proposal through the transaction confirmation tool', async () => {
    const pendingQuery = {
      eq() { return this; },
      maybeSingle: async () => ({
        data: {
          id: '11111111-1111-4111-8111-111111111111',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          proposed_fields: { entity: 'snapshot', ...change },
        },
        error: null,
      }),
    };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }) },
      from: (table: string) => {
        if (table === 'pending_transaction_changes') return { select: () => pendingQuery };
        throw new Error(`unexpected write to ${table}`);
      },
    } as any;

    await expect(confirmTransactionChange(client, 'action', '11111111-1111-4111-8111-111111111111'))
      .resolves.toEqual({ outcome: 'failure', reason: 'not_found' });
  });
});
