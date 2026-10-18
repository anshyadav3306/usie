import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { explainSendFailure, sendToSubscriptions } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Sends a test notification to the signed-in person's own devices.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in", 401);

  try {
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);
    if (error) return fail(`Could not read your saved devices: ${error.message}`, 500);
    if (!subs || subs.length === 0) return fail("No device is saved yet. Turn notifications on first.", 400);

    const result = await sendToSubscriptions(admin, subs, {
      title: "usie",
      body: "Notifications are working 💜",
      url: "/settings",
      tag: "usie-test",
    });
    if (result.sent === 0) return fail(explainSendFailure(result.firstError), 502);
    return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not send the test.", 500);
  }
}
