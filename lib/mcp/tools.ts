import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposedChange } from '@/lib/types';
import { aggregateTransactions, applyMutation, currentOwnerId, querySnapshots, queryTransactions } from '@/lib/supabase/queries';
import { logMutation } from '@/lib/mcp/log-mutation';
import { logQuery } from '@/lib/mcp/log-query';
import { setLocked } from '@/lib/migration/migration-lock';

const validType = (v: unknown) => v === 'income' || v === 'expensive';
const sqlLike = (value: unknown) => typeof value === 'string' && /\b(select|insert|update|delete|drop|alter|union)\b|--|;|\/*/i.test(value);
function assertReadInput(name: string, input: Record<string, unknown>) {
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
export async function confirmTransactionChange(client: SupabaseClient, channel: 'mcp'|'action', pending_change_id: string) {
  const ownerId = await currentOwnerId(client); const { data: pending, error } = await client.from('pending_transaction_changes').select('*').eq('owner_id', ownerId).eq('id', pending_change_id).maybeSingle();
  if (error) throw error; if (!pending) return { outcome: 'failure', reason: 'not_found' };
  const change = pending.proposed_fields as ProposedChange;
  if (new Date(pending.expires_at) < new Date()) { await client.from('pending_transaction_changes').delete().eq('id', pending.id); await logMutation(client, channel, change.operation, change.target_transaction_id ?? null, 'failure'); return { outcome: 'failure', reason: 'expired' }; }
  try { const affected = await applyMutation(client, change); await client.from('pending_transaction_changes').delete().eq('id', pending.id); await setLocked(client, ownerId); await logMutation(client, channel, change.operation, affected.transaction_id, 'success'); return { outcome: 'success', operation: change.operation, transaction_id: affected.transaction_id, applied_fields: change.operation === 'delete' ? {} : change }; }
  catch (cause) { await client.from('pending_transaction_changes').delete().eq('id', pending.id); await logMutation(client, channel, change.operation, change.target_transaction_id ?? null, 'failure'); throw cause; }
}
