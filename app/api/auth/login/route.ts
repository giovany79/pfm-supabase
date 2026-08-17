import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });

  if (!url || !anonKey) return NextResponse.redirect(new URL("/login?error=config", request.url), { status: 303 });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => {
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
  });

  if (error) return NextResponse.redirect(new URL("/login?error=credentials", request.url), { status: 303 });
  return response;
}
