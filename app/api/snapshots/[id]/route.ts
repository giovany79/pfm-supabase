import { NextResponse } from 'next/server';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import { updateSnapshot } from '@/lib/supabase/queries';
import { parseSnapshotFields } from '../_validation';
import { setLocked } from '@/lib/migration/migration-lock';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const client = await createDashboardClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await context.params;
    const snapshot = await updateSnapshot(client, id, parseSnapshotFields(await request.json()));
    await setLocked(client, data.user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No fue posible actualizar el registro patrimonial.' },
      { status: 400 },
    );
  }
}
