import type { SupabaseClient } from '@supabase/supabase-js';
import { currentOwnerId } from '@/lib/supabase/queries';
export async function logQuery(client: SupabaseClient, channel: 'mcp'|'action', tool_name: string, input: Record<string, unknown>, row_count: number) { const { error } = await client.from('qa_queries').insert({ owner_id: await currentOwnerId(client), channel, tool_name, input, row_count }); if (error) throw error; }
