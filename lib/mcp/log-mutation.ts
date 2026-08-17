import type { SupabaseClient } from '@supabase/supabase-js';
import type { MutationOperation } from '@/lib/types';
import { currentOwnerId } from '@/lib/supabase/queries';
export async function logMutation(client: SupabaseClient, channel: 'mcp'|'action', operation: MutationOperation, transaction_id: string | null, outcome: 'success'|'failure') { const { error } = await client.from('transaction_mutations').insert({ owner_id: await currentOwnerId(client), channel, tool_name: 'confirm_transaction_change', operation, transaction_id, actor: 'gio', outcome }); if (error) throw error; }
