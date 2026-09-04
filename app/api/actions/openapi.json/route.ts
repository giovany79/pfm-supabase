import { NextResponse } from 'next/server';

const requestBody = (schema: string) => ({
  required: true,
  content: {
    'application/json': {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const responses = (schema: string) => ({
  '200': {
    description: 'Successful response',
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${schema}` },
      },
    },
  },
  '400': {
    description: 'Invalid request',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  },
  '401': { description: 'Missing or invalid bearer token' },
});

const authenticated = [{ ApiKeyAuth: [] }];

const openApiSchema = {
  openapi: '3.1.0',
  info: {
    title: 'PFM Supabase Actions',
    version: '1.4.0',
    description:
      'Grounded access to Gio personal-finance transactions, assets, liabilities, and calculated net worth, including two-step confirmed mutation workflows.',
  },
  servers: [{ url: 'https://pfm-supabase.vercel.app/api/actions' }],
  security: authenticated,
  paths: {
    '/query-transactions': {
      post: {
        operationId: 'queryTransactions',
        summary: 'Query income, expense, and saving transactions',
        description:
          'Returns transactions matching typed filters. Base answers only on returned rows and report plainly when row_count is zero.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('QueryTransactionsInput'),
        responses: responses('QueryTransactionsResult'),
      },
    },
    '/query-snapshots': {
      post: {
        operationId: 'querySnapshots',
        summary: 'Query asset and liability snapshots',
        description:
          'Returns financial snapshots matching typed filters. Do not combine values from different currencies without explaining the conversion.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('QuerySnapshotsInput'),
        responses: responses('QuerySnapshotsResult'),
      },
    },
    '/aggregate-transactions': {
      post: {
        operationId: 'aggregateTransactions',
        summary: 'Aggregate transactions by category or month',
        description:
          'Returns grounded sums and counts grouped by category or month. Report plainly when no groups match instead of estimating.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('AggregateTransactionsInput'),
        responses: responses('AggregateTransactionsResult'),
      },
    },
    '/propose-transaction-change': {
      post: {
        operationId: 'proposeTransactionChange',
        summary: 'Propose a transaction change without applying it',
        description:
          'Creates a five-minute proposal for a create, edit, or delete operation. Show the returned summary verbatim and wait for explicit confirmation.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('ProposeTransactionChangeInput'),
        responses: responses('ProposeTransactionChangeResult'),
      },
    },
    '/propose-transaction-batch': {
      post: {
        operationId: 'proposeTransactionBatch',
        summary: 'Propose a batch of transactions without applying it',
        description:
          'Call once with the complete set of 2 to 20 transactions. Creates one five-minute proposal for the entire atomic batch. Show every transaction and the total, then ask for one explicit confirmation covering the whole batch. Never split it into individual proposals or confirmations.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('ProposeTransactionBatchInput'),
        responses: responses('ProposeTransactionBatchResult'),
      },
    },
    '/confirm-transaction-change': {
      post: {
        operationId: 'confirmTransactionChange',
        summary: 'Apply an explicitly confirmed transaction change',
        description:
          'Call exactly once after the user explicitly confirms the exact pending proposal in the immediately following message. If the proposal is a batch, this single call applies every row atomically; never confirm rows individually.',
        security: authenticated,
        'x-openai-isConsequential': true,
        requestBody: requestBody('ConfirmTransactionChangeInput'),
        responses: responses('ConfirmTransactionChangeResult'),
      },
    },
    '/propose-snapshot-change': {
      post: {
        operationId: 'proposeSnapshotChange',
        summary: 'Propose creating or editing an asset or liability',
        description:
          'Creates one five-minute proposal without changing data. For edits, call querySnapshots first and resolve exactly one item_id. Show every proposed field and ask for explicit confirmation. Net worth is calculated from assets minus liabilities and cannot be edited directly.',
        security: authenticated,
        'x-openai-isConsequential': false,
        requestBody: requestBody('ProposeSnapshotChangeInput'),
        responses: responses('ProposeSnapshotChangeResult'),
      },
    },
    '/confirm-snapshot-change': {
      post: {
        operationId: 'confirmSnapshotChange',
        summary: 'Apply an explicitly confirmed asset or liability change',
        description:
          'Applies one pending asset or liability proposal only after the user explicitly confirms its exact summary and fields in the immediately following message. Never use it with a transaction proposal.',
        security: authenticated,
        'x-openai-isConsequential': true,
        requestBody: requestBody('ConfirmSnapshotChangeInput'),
        responses: responses('ConfirmSnapshotChangeResult'),
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API key',
      },
    },
    schemas: {
      QueryTransactionsInput: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Inclusive start date in YYYY-MM-DD format.',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Inclusive end date in YYYY-MM-DD format.',
          },
          category: {
            type: 'string',
            minLength: 1,
            description: 'Exact category match. Omit for all categories.',
          },
          type: {
            type: 'string',
            enum: ['income', 'expensive', 'saving'],
            description: 'Filter to income, expense, or saving transactions.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 500,
            default: 100,
            description: 'Maximum number of rows to return.',
          },
        },
        additionalProperties: false,
      },
      QuerySnapshotsInput: {
        type: 'object',
        properties: {
          as_of_date: {
            type: 'string',
            format: 'date',
            description:
              'Return the most recent item snapshots on or before this date.',
          },
          kind: { type: 'string', enum: ['asset', 'liability'] },
          category: { type: 'string', minLength: 1 },
          institution: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
      AggregateTransactionsInput: {
        type: 'object',
        properties: {
          group_by: { type: 'string', enum: ['category', 'month'] },
          date_from: { type: 'string', format: 'date' },
          date_to: { type: 'string', format: 'date' },
          type: { type: 'string', enum: ['income', 'expensive', 'saving'] },
        },
        required: ['group_by'],
        additionalProperties: false,
      },
      ProposeTransactionChangeInput: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['create', 'edit', 'delete'] },
          target_transaction_id: {
            type: 'string',
            format: 'uuid',
            description: 'Required for edit and delete operations.',
          },
          date: { type: 'string', format: 'date' },
          description: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
          category: { type: 'string', minLength: 1 },
          type_income_expense: {
            type: 'string',
            enum: ['income', 'expensive', 'saving'],
          },
        },
        required: ['operation'],
        additionalProperties: false,
      },
      TransactionDraft: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          description: { type: 'string', minLength: 1 },
          amount: { type: 'number', minimum: 0 },
          category: { type: 'string', minLength: 1 },
          type_income_expense: {
            type: 'string',
            enum: ['income', 'expensive', 'saving'],
          },
        },
        required: [
          'date',
          'description',
          'amount',
          'category',
          'type_income_expense',
        ],
        additionalProperties: false,
      },
      ProposeTransactionBatchInput: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            minItems: 2,
            maxItems: 20,
            items: { $ref: '#/components/schemas/TransactionDraft' },
          },
        },
        required: ['transactions'],
        additionalProperties: false,
      },
      ConfirmTransactionChangeInput: {
        type: 'object',
        properties: {
          pending_change_id: { type: 'string', format: 'uuid' },
        },
        required: ['pending_change_id'],
        additionalProperties: false,
      },
      ProposeSnapshotChangeInput: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['create', 'edit'] },
          target_item_id: {
            type: 'string',
            format: 'uuid',
            description: 'Required for edit operations.',
          },
          snapshot_date: { type: 'string', format: 'date' },
          name: { type: 'string', minLength: 1, maxLength: 160 },
          kind: { type: 'string', enum: ['asset', 'liability'] },
          category: { type: 'string', minLength: 1, maxLength: 100 },
          amount: { type: 'number', minimum: 0 },
          currency: { type: 'string', pattern: '^[A-Za-z]{3,10}$' },
          institution: { type: ['string', 'null'], maxLength: 160 },
          notes: { type: ['string', 'null'], maxLength: 500 },
        },
        required: [
          'operation',
          'snapshot_date',
          'name',
          'kind',
          'category',
          'amount',
          'currency',
        ],
        additionalProperties: false,
      },
      ConfirmSnapshotChangeInput: {
        type: 'object',
        properties: {
          pending_change_id: { type: 'string', format: 'uuid' },
        },
        required: ['pending_change_id'],
        additionalProperties: false,
      },
      Transaction: {
        type: 'object',
        properties: {
          transaction_id: { type: 'string', format: 'uuid' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['income', 'expensive', 'saving'] },
          amount: { type: 'number' },
          category: { type: 'string' },
          transaction_date: { type: 'string', format: 'date' },
        },
        required: [
          'transaction_id',
          'description',
          'type',
          'amount',
          'category',
          'transaction_date',
        ],
        additionalProperties: true,
      },
      Snapshot: {
        type: 'object',
        properties: {
          item_id: { type: 'string' },
          snapshot_date: { type: 'string', format: 'date' },
          name: { type: 'string' },
          kind: { type: 'string', enum: ['asset', 'liability'] },
          category: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          institution: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
        },
        required: [
          'item_id',
          'snapshot_date',
          'name',
          'kind',
          'category',
          'amount',
          'currency',
        ],
        additionalProperties: true,
      },
      QueryTransactionsResult: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' },
          },
          row_count: { type: 'integer', minimum: 0 },
        },
        required: ['rows', 'row_count'],
        additionalProperties: false,
      },
      QuerySnapshotsResult: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            items: { $ref: '#/components/schemas/Snapshot' },
          },
          row_count: { type: 'integer', minimum: 0 },
        },
        required: ['rows', 'row_count'],
        additionalProperties: false,
      },
      AggregateGroup: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          sum: { type: 'number' },
          count: { type: 'integer', minimum: 0 },
        },
        required: ['group', 'sum', 'count'],
        additionalProperties: false,
      },
      AggregateTransactionsResult: {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            items: { $ref: '#/components/schemas/AggregateGroup' },
          },
          row_count: { type: 'integer', minimum: 0 },
          trace_filters: { type: 'object', additionalProperties: true },
        },
        required: ['groups', 'row_count', 'trace_filters'],
        additionalProperties: false,
      },
      ProposeTransactionChangeResult: {
        type: 'object',
        properties: {
          pending_change_id: { type: 'string', format: 'uuid' },
          expires_at: { type: 'string', format: 'date-time' },
          summary: { type: 'string' },
        },
        required: ['pending_change_id', 'expires_at', 'summary'],
        additionalProperties: false,
      },
      ProposeTransactionBatchResult: {
        type: 'object',
        properties: {
          pending_change_id: { type: 'string', format: 'uuid' },
          expires_at: { type: 'string', format: 'date-time' },
          summary: { type: 'string' },
          transaction_count: { type: 'integer', minimum: 2, maximum: 20 },
          total_amount: { type: 'number', minimum: 0 },
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/TransactionDraft' },
          },
        },
        required: [
          'pending_change_id',
          'expires_at',
          'summary',
          'transaction_count',
          'total_amount',
          'transactions',
        ],
        additionalProperties: false,
      },
      ConfirmTransactionChangeResult: {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['success', 'failure'] },
          reason: { type: 'string', enum: ['expired', 'not_found'] },
          operation: {
            type: 'string',
            enum: ['create', 'edit', 'delete', 'batch_create'],
          },
          transaction_id: { type: 'string', format: 'uuid' },
          transaction_ids: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
          applied_count: { type: 'integer', minimum: 0, maximum: 20 },
          applied_fields: { type: 'object', additionalProperties: true },
        },
        required: ['outcome'],
        additionalProperties: false,
      },
      ProposeSnapshotChangeResult: {
        type: 'object',
        properties: {
          pending_change_id: { type: 'string', format: 'uuid' },
          expires_at: { type: 'string', format: 'date-time' },
          summary: { type: 'string' },
          snapshot: { $ref: '#/components/schemas/ProposeSnapshotChangeInput' },
        },
        required: ['pending_change_id', 'expires_at', 'summary', 'snapshot'],
        additionalProperties: false,
      },
      ConfirmSnapshotChangeResult: {
        type: 'object',
        properties: {
          outcome: { type: 'string', enum: ['success', 'failure'] },
          reason: { type: 'string', enum: ['expired', 'not_found'] },
          operation: { type: 'string', enum: ['create', 'edit'] },
          item_id: { type: 'string', format: 'uuid' },
          applied_fields: { type: 'object', additionalProperties: true },
        },
        required: ['outcome'],
        additionalProperties: false,
      },
      ErrorResponse: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
        additionalProperties: false,
      },
    },
  },
} as const;

export function GET() {
  return NextResponse.json(openApiSchema);
}
