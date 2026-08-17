import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkLocked(client: SupabaseClient, ownerId: string) {
  const { data, error } = await client.from('system_state').select('pfm_gio_migration_locked').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data?.pfm_gio_migration_locked === true;
}
export async function setLocked(client: SupabaseClient, ownerId: string) {
  const { error } = await client.from('system_state').upsert({ owner_id: ownerId, pfm_gio_migration_locked: true, locked_at: new Date().toISOString() });
  if (error) throw error;
}
