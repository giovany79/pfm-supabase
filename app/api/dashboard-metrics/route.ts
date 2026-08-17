import { NextResponse } from 'next/server';
import { createDashboardClient } from '@/lib/supabase/dashboard-client';
import { dashboardMetrics } from '@/lib/supabase/queries';
export async function GET(request: Request) { try { const client = await createDashboardClient(); const { data } = await client.auth.getUser(); if (!data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const url = new URL(request.url); return NextResponse.json(await dashboardMetrics(client, url.searchParams.get('date_from') ?? undefined, url.searchParams.get('date_to') ?? undefined)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 400 }); } }
