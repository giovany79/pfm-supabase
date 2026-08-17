import type { SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot, Transaction } from '@/lib/types';

export async function upsertSnapshots(client: SupabaseClient, records: Snapshot[]) {
  if (!records.length) return 0;
  const { error } = await client.from('snapshots').upsert(records, { onConflict: 'item_id' });
  if (error) throw error;
  return records.length;
}
export async function upsertTransactions(client: SupabaseClient, records: Transaction[]) {
  if (!records.length) return 0;
  const { error } = await client.from('transactions').upsert(records, { onConflict: 'transaction_id' });
  if (error) throw error;
  return records.length;
}
