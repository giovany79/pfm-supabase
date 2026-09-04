import type { SupabaseClient } from '@supabase/supabase-js';
import { currentOwnerId } from '@/lib/supabase/queries';

export async function logSnapshotMutation(
  client: SupabaseClient,
  channel: 'mcp' | 'action',
  operation: 'create' | 'edit',
  item_id: string | null,
  outcome: 'success' | 'failure',
) {
  const { error } = await client.from('snapshot_mutations').insert({
    owner_id: await currentOwnerId(client),
    channel,
    tool_name: 'confirm_snapshot_change',
    operation,
    item_id,
    actor: 'gio',
    outcome,
  });
  if (error) throw error;
}
