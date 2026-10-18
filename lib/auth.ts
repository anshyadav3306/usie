import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// The middleware has already checked the login with Supabase and passes the user id along in a
// header it controls. Reading it here saves a slow trip to Supabase on every page and layout.
// (Data is still protected by the database rules, which use the real login cookie.)
export const getUserId = cache(async (): Promise<string | null> => {
  const id = (await headers()).get("x-usie-user");
  if (id) return id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});
