import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { confirmTransactionChange, executeReadTool, proposeTransactionBatch, proposeTransactionChange } from '@/lib/mcp/tools';
import { createOwnerSessionClient } from '@/lib/supabase/session-client';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const transactionType = z.enum(['income', 'expensive']);

const queryTransactionsSchema = {
  date_from: date.optional().describe('Inclusive start date (YYYY-MM-DD).'),
  date_to: date.optional().describe('Inclusive end date (YYYY-MM-DD).'),
  category: z.string().min(1).optional().describe('Exact category match.'),
  type: transactionType.optional().describe('Filter to income or expense transactions.'),
  limit: z.number().int().min(1).max(500).default(100).optional(),
};

const querySnapshotsSchema = {
  as_of_date: date.optional().describe('Most recent snapshot for each item as of this date.'),
  kind: z.enum(['asset', 'liability']).optional(),
  category: z.string().min(1).optional().describe('Exact category match.'),
  institution: z.string().min(1).optional().describe('Exact institution match.'),
};

const aggregateTransactionsSchema = {
  group_by: z.enum(['category', 'month']),
  date_from: date.optional(),
  date_to: date.optional(),
  type: transactionType.optional(),
};

const proposeTransactionChangeSchema = {
  operation: z.enum(['create', 'edit', 'delete']),
  target_transaction_id: z.string().uuid().optional(),
  date: date.optional(),
  description: z.string().min(1).optional(),
  amount: z.number().nonnegative().optional(),
  category: z.string().min(1).optional(),
  type_income_expense: transactionType.optional(),
};

const transactionDraftSchema = z.object({
  date,
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  category: z.string().min(1),
  type_income_expense: transactionType,
});

const proposeTransactionBatchSchema = {
  transactions: z.array(transactionDraftSchema).min(2).max(20),
};

const confirmTransactionChangeSchema = {
  pending_change_id: z.string().uuid(),
};

const resultContent = (result: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result) }],
});

export const MCP_SERVER_INSTRUCTIONS =
  'Use these tools only for Gio personal-finance data. Ground every numeric answer in a read tool result from the current turn; never guess when row_count is 0. Never mix snapshot currencies. For edits and deletes, identify exactly one transaction with query_transactions first. Mutations require two steps: use propose_transaction_change for one movement or call propose_transaction_batch exactly once with all 2 to 20 new movements. For a batch, show every movement and the total, ask for one confirmation covering the entire batch, and then call confirm_transaction_change exactly once with the batch pending_change_id only after Gio explicitly confirms that exact batch in the next message. Never split a batch into individual proposals or confirmations. Financial changes are permanent and must never be inferred.';

export function createFinanceMcpServer() {
  const server = new McpServer(
    { name: 'pfm-supabase-qa', version: '1.2.1' },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    'query_transactions',
    {
      title: 'Consultar movimientos',
      description:
        'Retrieve income and expense transactions matching typed filters. Base answers only on returned rows and state plainly when row_count is 0.',
      inputSchema: queryTransactionsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const client = await createOwnerSessionClient();
      return resultContent(await executeReadTool(client, 'mcp', 'query_transactions', input));
    },
  );

  server.registerTool(
    'query_snapshots',
    {
      title: 'Consultar patrimonio',
      description:
        'Retrieve asset and liability snapshots. Never sum or compare values in different currencies without explicitly explaining the currencies involved.',
      inputSchema: querySnapshotsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const client = await createOwnerSessionClient();
      return resultContent(await executeReadTool(client, 'mcp', 'query_snapshots', input));
    },
  );

  server.registerTool(
    'aggregate_transactions',
    {
      title: 'Agregar movimientos',
      description:
        'Compute grounded transaction sums and counts grouped by category or month. State plainly when no groups are returned; never estimate.',
      inputSchema: aggregateTransactionsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => {
      const client = await createOwnerSessionClient();
      return resultContent(await executeReadTool(client, 'mcp', 'aggregate_transactions', input));
    },
  );

  server.registerTool(
    'propose_transaction_change',
    {
      title: 'Proponer cambio de movimiento',
      description:
        'Step 1 of 2 for create, edit, or permanent delete. This creates only a five-minute pending proposal. Show the returned summary verbatim and wait for explicit confirmation.',
      inputSchema: proposeTransactionChangeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const client = await createOwnerSessionClient();
      return resultContent(await proposeTransactionChange(client, input));
    },
  );

  server.registerTool(
    'propose_transaction_batch',
    {
      title: 'Proponer lote de movimientos',
      description:
        'Step 1 of 2 for atomically creating 2 to 20 transactions. Call this once with the complete batch. Show every transaction and the total, then ask for one explicit confirmation covering the entire batch. Never propose or confirm its rows individually.',
      inputSchema: proposeTransactionBatchSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const client = await createOwnerSessionClient();
      return resultContent(await proposeTransactionBatch(client, input));
    },
  );

  server.registerTool(
    'confirm_transaction_change',
    {
      title: 'Confirmar cambio de movimiento',
      description:
        'Step 2 of 2. Call exactly once with the pending_change_id after Gio explicitly confirms the exact proposal in his immediately following message. For a batch, this one call applies every row atomically; never call it separately for individual rows.',
      inputSchema: confirmTransactionChangeSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ pending_change_id }) => {
      const client = await createOwnerSessionClient();
      return resultContent(await confirmTransactionChange(client, 'mcp', pending_change_id));
    },
  );

  return server;
}
