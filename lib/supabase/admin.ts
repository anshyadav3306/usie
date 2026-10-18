import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses row security, so never import this into a client component.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) throw new Error("The server is missing NEXT_PUBLIC_SUPABASE_URL.");
  if (!key) {
    throw new Error(
      "The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel (Settings, Environment Variables), then redeploy."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
