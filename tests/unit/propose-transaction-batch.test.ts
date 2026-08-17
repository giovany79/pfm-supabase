import { describe, expect, it } from 'vitest';
import { confirmTransactionChange, proposeTransactionBatch } from '@/lib/mcp/tools';
import { createTransactionsBatch } from '@/lib/supabase/queries';

const transactions = [
  {
    date: '2026-08-01',
    description: 'Pasajes universidad',
    amount: 114000,
    category: 'education',
    type_income_expense: 'expensive' as const,
  },
  {
    date: '2026-08-01',
    description: 'Algos Universidad',
    amount: 130000,
    category: 'education',
    type_income_expense: 'expensive' as const,
  },
];

describe('proposeTransactionBatch', () => {
  it('requires between 2 and 20 complete transactions before writing', async () => {
    const client = { from: () => { throw new Error('must not write'); } } as any;

    await expect(proposeTransactionBatch(client, { transactions: [transactions[0]] })).rejects.toThrow(
      'between 2 and 20',
    );
    await expect(
      proposeTransactionBatch(client, {
        transactions: [transactions[0], { ...transactions[1], category: '' }],
      }),
    ).rejects.toThrow('missing category at index 1');
  });

  it('stores one expiring proposal with the exact batch and total', async () => {
    let inserted: Record<string, unknown> | undefined;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }),
      },
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: '11111111-1111-4111-8111-111111111111',
                  expires_at: '2026-08-17T12:05:00.000Z',
                },
                error: null,
              }),
            }),
          };
        },
      }),
    } as any;

    const result = await proposeTransactionBatch(client, { transactions });

    expect(result).toMatchObject({ transaction_count: 2, total_amount: 244000 });
    expect(inserted).toMatchObject({
      operation: 'create',
      proposed_fields: { operation: 'batch_create', transactions },
    });
  });
});

describe('createTransactionsBatch', () => {
  it('inserts all rows in one Supabase statement', async () => {
    let insertedRows: Array<Record<string, unknown>> = [];
    let insertCalls = 0;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }),
      },
      from: () => ({
        insert: (rows: Array<Record<string, unknown>>) => {
          insertCalls += 1;
          insertedRows = rows;
          return {
            select: async () => ({
              data: rows.map((row) => ({ transaction_id: row.transaction_id })),
              error: null,
            }),
          };
        },
      }),
    } as any;

    const result = await createTransactionsBatch(client, transactions);

    expect(insertCalls).toBe(1);
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows.every((row) => row.owner_id === 'owner-id')).toBe(true);
    expect(result).toHaveLength(2);
  });
});

describe('confirmTransactionChange batch branch', () => {
  it('applies the pending batch once and returns every created id', async () => {
    const createdIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    let transactionInsertCalls = 0;
    let auditRows = 0;
    const pendingQuery = {
      eq() { return this; },
      maybeSingle: async () => ({
        data: {
          id: '33333333-3333-4333-8333-333333333333',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          proposed_fields: { operation: 'batch_create', transactions },
        },
        error: null,
      }),
    };
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'owner-id' } }, error: null }),
      },
      from: (table: string) => {
        if (table === 'pending_transaction_changes') {
          return {
            select: () => pendingQuery,
            delete: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === 'transactions') {
          return {
            insert: () => {
              transactionInsertCalls += 1;
              return {
                select: async () => ({
                  data: createdIds.map((transaction_id) => ({ transaction_id })),
                  error: null,
                }),
              };
            },
          };
        }
        if (table === 'system_state') {
          return { upsert: async () => ({ error: null }) };
        }
        if (table === 'transaction_mutations') {
          return {
            insert: async () => {
              auditRows += 1;
              return { error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const result = await confirmTransactionChange(
      client,
      'action',
      '33333333-3333-4333-8333-333333333333',
    );

    expect(result).toEqual({
      outcome: 'success',
      operation: 'batch_create',
      transaction_ids: createdIds,
      applied_count: 2,
    });
    expect(transactionInsertCalls).toBe(1);
    expect(auditRows).toBe(2);
  });
});
