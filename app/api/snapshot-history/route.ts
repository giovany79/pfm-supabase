import { NextResponse } from 'next/server';
import { buildSnapshotHistory, type SnapshotHistorySource } from '@/lib/snapshot-history';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';

async function allSnapshots(
  client: Awaited<ReturnType<typeof createDashboardClient>>,
  ownerId: string,
) {
  const rows: SnapshotHistorySource[] = [];
  const pageSize = 500;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('snapshots')
      .select('item_id,snapshot_date,name,kind,category,amount,currency,institution,created_at')
      .eq('owner_id', ownerId)
      .order('snapshot_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as SnapshotHistorySource[]));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export async function GET() {
  try {
    const client = await createDashboardClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    return NextResponse.json(
      buildSnapshotHistory(await allSnapshots(client, auth.user.id)),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No fue posible construir el histórico patrimonial.',
      },
      { status: 400 },
    );
  }
}
