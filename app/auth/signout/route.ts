import { NextResponse } from "next/server";
import { createDashboardClient } from "@/lib/supabase/dashboard-client";

export async function POST(request: Request) {
  const supabase = await createDashboardClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
