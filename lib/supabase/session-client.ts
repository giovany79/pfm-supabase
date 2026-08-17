import { createClient } from '@supabase/supabase-js';

export async function createOwnerSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const refreshToken = process.env.SUPABASE_OWNER_REFRESH_TOKEN;
  if (!url || !anonKey || !refreshToken) throw new Error('Missing Supabase runtime session configuration');
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new Error('Unable to establish owner session');
  return client;
}
