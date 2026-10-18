import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { configStatus } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A health check for signed-in people. It reports which settings exist (never their values).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const status = configStatus();
  let devices: number | null = null;
  if (status.settings.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { count, error } = await createAdminClient()
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) status.problems.push(`The push_subscriptions table could not be read: ${error.message}`);
      else devices = count ?? 0;
    } catch (e) {
      status.problems.push(e instanceof Error ? e.message : "Could not reach the database.");
    }
  }
  return NextResponse.json({ ...status, devices, ok: status.problems.length === 0 });
}
