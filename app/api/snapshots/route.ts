import { NextResponse } from 'next/server';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import { createSnapshot, querySnapshots } from '@/lib/supabase/queries';
import type { SnapshotKind } from '@/lib/types';
import { parseSnapshotFields } from './_validation';
import { setLocked } from '@/lib/migration/migration-lock';

async function authenticatedClient() {
  const client = await createDashboardClient();
  const { data } = await client.auth.getUser();
  return data.user ? { client, ownerId: data.user.id } : null;
}

export async function GET(request: Request) {
  try {
    const client = await authenticatedClient();
    if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const rawKind = params.get('kind');
    const kind = rawKind === 'asset' || rawKind === 'liability' ? rawKind as SnapshotKind : undefined;
    const result = await querySnapshots(client.client, {
      kind,
      category: params.get('category')?.trim() || undefined,
      institution: params.get('institution')?.trim() || undefined,
    });
    const all = await querySnapshots(client.client);
    const categories = [...new Set(all.rows.map((row) => row.category))].sort();
    const currencies = [...new Set(all.rows.map((row) => row.currency))].sort();
    return NextResponse.json({ ...result, categories, currencies });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible consultar el patrimonio.' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const client = await authenticatedClient();
    if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const snapshot = await createSnapshot(client.client, parseSnapshotFields(await request.json()));
    await setLocked(client.client, client.ownerId);
    return NextResponse.json(snapshot, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible crear el registro patrimonial.' },
      { status: 400 },
    );
  }
}
