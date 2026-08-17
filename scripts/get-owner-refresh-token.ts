import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_OWNER_EMAIL;
const password = process.env.SUPABASE_OWNER_PASSWORD;

if (!url || !anonKey || !email || !password) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_OWNER_EMAIL o SUPABASE_OWNER_PASSWORD en .env.local.",
  );
}

const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });

  if (error || !data.session) {
    throw error ?? new Error("No se pudo crear la sesión del propietario.");
  }

  console.log(`SUPABASE_OWNER_REFRESH_TOKEN=${data.session.refresh_token}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
