import { redirect } from "next/navigation";
import { createDashboardClient } from "@/lib/supabase/dashboard-client";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createDashboardClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return children;
}
