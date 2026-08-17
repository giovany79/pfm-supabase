import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createDashboardClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase browser configuration');
  const store = await cookies();
  return createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => { try { items.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} } } });
}
