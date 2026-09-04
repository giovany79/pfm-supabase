import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposedBatchChange, ProposedChange, ProposedSnapshotChange, TransactionDraft } from '@/lib/types';
import { aggregateTransactions, applyMutation, applySnapshotMutation, createTransactionsBatch, currentOwnerId, querySnapshots, queryTransactions } from '@/lib/supabase/queries';
import { logMutation } from '@/lib/mcp/log-mutation';
import { logSnapshotMutation } from '@/lib/mcp/log-snapshot-mutation';
import { logQuery } from '@/lib/mcp/log-query';
import { setLocked } from '@/lib/migration/migration-lock';
import { parseProposedSnapshotChange } from '@/lib/snapshot-validation';

const validType = (v: unknown) => v === 'income' || v === 'expensive';
const sqlLike = (value: unknown) =>
  typeof value === 'string' && /\b(select|insert|update|delete|drop|alter|union)\b|--|;|\/\*/i.test(value);
export function assertReadInput(name: string, input: Record<string, unknown>) {
  const allowed: Record<string, string[]> = { query_transactions: ['date_from', 'date_to', 'category', 'type', 'limit'], query_snapshots: ['as_of_date', 'kind', 'category', 'institution'], aggregate_transactions: ['group_by', 'date_from', 'date_to', 'type'] };
  if (!allowed[name] || Object.keys(input).some((key) => !allowed[name].includes(key))) throw new Error('invalid tool input');
  if (Object.values(input).some(sqlLike)) throw new Error('invalid tool input');
  if (input.type !== undefined && !validType(input.type)) throw new Error('invalid type');
  if (input.kind !== undefined && input.kind !== 'asset' && input.kind !== 'liability') throw new Error('invalid kind');
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || Number(input.limit) < 1 || Number(input.limit) > 500)) throw new Error('invalid limit');
}
function assertChange(input: Record<string, unknown>): ProposedChange {
  const operation = input.operation; if (operation !== 'create' && operation !== 'edit' && operation !== 'delete') throw new Error('operation must be create, edit, or delete');
  const result = input as ProposedChange;
  if (operation === 'create') for (const key of ['date', 'description', 'amount', 'category', 'type_income_expense'] as const) if (result[key] === undefined || result[key] === '') throw new Error(`missing ${key}`);
  if ((operation === 'edit' || operation === 'delete') && !result.target_transaction_id) throw new Error('missing target_transaction_id');
  if (result.type_income_expense !== undefined && !validType(result.type_income_expense)) throw new Error('invalid type_income_expense');
  if (result.amount !== undefined && (!Number.isFinite(Number(result.amount)) || Number(result.amount) < 0)) throw new Error('invalid amount');
  return result;
}

function assertTransactionDraft(input: unknown, index: number): TransactionDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`invalid transaction at index ${index}`);
  const draft = input as Record<string, unknown>;
  const allowed = ['date', 'description', 'amount', 'category', 'type_income_expense'];
  if (Object.keys(draft).some((key) => !allowed.includes(key))) throw new Error(`invalid transaction field at index ${index}`);
  for (const key of allowed) if (draft[key] === undefined || draft[key] === '') throw new Error(`missing ${key} at index ${index}`);
  if (typeof draft.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) throw new Error(`invalid date at index ${index}`);
  if (typeof draft.description !== 'string' || !draft.description.trim()) throw new Error(`invalid description at index ${index}`);
  if (typeof draft.category !== 'string' || !draft.category.trim()) throw new Error(`invalid category at index ${index}`);
  if (!validType(draft.type_income_expense)) throw new Error(`invalid type_income_expense at index ${index}`);
  if (typeof draft.amount !== 'number' || !Number.isFinite(draft.amount) || draft.amount < 0) throw new Error(`invalid amount at index ${index}`);
  return draft as TransactionDraft;
}

function assertBatchChange(input: Record<string, unknown>): ProposedBatchChange {
  if (Object.keys(input).some((key) => key !== 'transactions')) throw new Error('invalid batch input');
  if (!Array.isArray(input.transactions)) throw new Error('transactions must be an array');
  if (input.transactions.length < 2 || input.transactions.length > 20) throw new Error('batch must contain between 2 and 20 transactions');
  return { operation: 'batch_create', transactions: input.transactions.map(assertTransactionDraft) };
}
export async function executeReadTool(client: SupabaseClient, channel: 'mcp'|'action', name: string, input: Record<string, unknown>) {
  assertReadInput(name, input);
  let result: any;
  if (name === 'query_transactions') result = await queryTransactions(client, input as any);
  else if (name === 'query_snapshots') result = await querySnapshots(client, input as any);
  else if (name === 'aggregate_transactions') { if (input.group_by !== 'category' && input.group_by !== 'month') throw new Error('group_by must be category or month'); result = await aggregateTransactions(client, input as any); }
  else throw new Error('Unknown read tool');
  await logQuery(client, channel, name, input, result.row_count); return result;
}
export async function proposeTransactionChange(client: SupabaseClient, input: Record<string, unknown>) {
  const change = assertChange(input); const ownerId = await currentOwnerId(client); const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data, error } = await client.from('pending_transaction_changes').insert({ owner_id: ownerId, operation: change.operation, target_transaction_id: change.target_transaction_id ?? null, proposed_fields: change, expires_at }).select('id, expires_at').single(); if (error) throw error;
  return { pending_change_id: data.id, expires_at: data.expires_at, summary: `${change.operation} transaction${change.target_transaction_id ? ` ${change.target_transaction_id}` : ''}` };
}

export async function proposeTransactionBatch(client: SupabaseClient, input: Record<string, unknown>) {
  const change = assertBatchChange(input); const ownerId = await currentOwnerId(client); const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
  const total = change.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const summary = `create ${change.transactions.length} transactions totaling ${total} COP`;
  const { data, error } = await client.from('pending_transaction_changes').insert({ owner_id: ownerId, operation: 'create', target_transaction_id: null, proposed_fields: change, expires_at }).select('id, expires_at').single(); if (error) throw error;
  return { pending_change_id: data.id, expires_at: data.expires_at, summary, transaction_count: change.transactions.length, total_amount: total, transactions: change.transactions };
}

export async function proposeSnapshotChange(client: SupabaseClient, input: Record<string, unknown>) {
  const change = parseProposedSnapshotChange(input);
  const ownerId = await currentOwnerId(client);
  if (change.operation === 'edit') {
    const existing = await querySnapshots(client);
    if (!existing.rows.some((row) => row.item_id === change.target_item_id))
      throw new Error('No existe un activo o pasivo con ese target_item_id.');
  }
  const expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
  const summary = `${change.operation} ${change.kind} ${change.name}: ${change.amount} ${change.currency} (${change.snapshot_date})`;
  const { data, error } = await client.from('pending_transaction_changes').insert({
    owner_id: ownerId,
    operation: change.operation,
    target_transaction_id: null,
    proposed_fields: change,
    expires_at,
  }).select('id, expires_at').single();
  if (error) throw error;
  return {
    pending_change_id: data.id,
    expires_at: data.expires_at,
    summary,
    snapshot: {
      operation: change.operation,
      target_item_id: change.target_item_id,
      snapshot_date: change.snapshot_date,
      name: change.name,
      kind: change.kind,
      category: change.category,
      amount: change.amount,
      currency: change.currency,
      institution: change.institution,
      notes: change.notes,
    },
  };
}

export async function confirmSnapshotChange(
  client: SupabaseClient,
  channel: 'mcp' | 'action',
  pending_change_id: string,
) {
  const ownerId = await currentOwnerId(client);
  const { data: pending, error } = await client.from('pending_transaction_changes')
    .select('*').eq('owner_id', ownerId).eq('id', pending_change_id).maybeSingle();
  if (error) throw error;
  if (!pending) return { outcome: 'failure', reason: 'not_found' };
  const change = pending.proposed_fields as ProposedSnapshotChange;
  if (change.entity !== 'snapshot' || (change.operation !== 'create' && change.operation !== 'edit'))
    return { outcome: 'failure', reason: 'not_found' };
  if (new Date(pending.expires_at) < new Date()) {
    await client.from('pending_transaction_changes').delete().eq('id', pending.id);
    await logSnapshotMutation(client, channel, change.operation, change.target_item_id ?? null, 'failure');
    return { outcome: 'failure', reason: 'expired' };
  }
  try {
    const affected = await applySnapshotMutation(client, change);
    await client.from('pending_transaction_changes').delete().eq('id', pending.id);
    await setLocked(client, ownerId);
    await logSnapshotMutation(client, channel, change.operation, affected.item_id, 'success');
    return {
      outcome: 'success',
      operation: change.operation,
      item_id: affected.item_id,
      applied_fields: change,
    };
  } catch (cause) {
    await client.from('pending_transaction_changes').delete().eq('id', pending.id);
    await logSnapshotMutation(client, channel, change.operation, change.target_item_id ?? null, 'failure');
    throw cause;
  }
}
export async function confirmTransactionChange(client: SupabaseClient, channel: 'mcp'|'action', pending_change_id: string) {
  const ownerId = await currentOwnerId(client); const { data: pending, error } = await client.from('pending_transaction_changes').select('*').eq('owner_id', ownerId).eq('id', pending_change_id).maybeSingle();
  if (error) throw error; if (!pending) return { outcome: 'failure', reason: 'not_found' };
  const change = pending.proposed_fields as ProposedChange | ProposedBatchChange;
  if ('entity' in change && change.entity === 'snapshot') return { outcome: 'failure', reason: 'not_found' };
  const auditOperation = change.operation === 'batch_create' ? 'create' : change.operation;
  const targetId = change.operation === 'batch_create' ? null : change.target_transaction_id ?? null;
  if (new Date(pending.expires_at) < new Date()) { await client.from('pending_transaction_changes').delete().eq('id', pending.id); await logMutation(client, channel, auditOperation, targetId, 'failure'); return { outcome: 'failure', reason: 'expired' }; }
  try {
    if (change.operation === 'batch_create') {
      const affected = await createTransactionsBatch(client, change.transactions);
      await client.from('pending_transaction_changes').delete().eq('id', pending.id); await setLocked(client, ownerId);
      for (const transaction of affected) await logMutation(client, channel, 'create', transaction.transaction_id, 'success');
      return { outcome: 'success', operation: 'batch_create', transaction_ids: affected.map((transaction) => transaction.transaction_id), applied_count: affected.length };
    }
    const affected = await applyMutation(client, change); await client.from('pending_transaction_changes').delete().eq('id', pending.id); await setLocked(client, ownerId); await logMutation(client, channel, change.operation, affected.transaction_id, 'success'); return { outcome: 'success', operation: change.operation, transaction_id: affected.transaction_id, applied_fields: change.operation === 'delete' ? {} : change };
  }
  catch (cause) { await client.from('pending_transaction_changes').delete().eq('id', pending.id); await logMutation(client, channel, auditOperation, targetId, 'failure'); throw cause; }
}
