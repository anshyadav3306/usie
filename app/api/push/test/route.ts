import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToSubscriptions } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a test notification to the signed-in person's own devices.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "No device is subscribed yet. Turn notifications on first." }, { status: 400 });
  }

  try {
    const result = await sendToSubscriptions(admin, subs, {
      title: "usie",
      body: "Notifications are working 💜",
      url: "/settings",
      tag: "usie-test",
    });
    if (result.sent === 0) {
      return NextResponse.json({ error: "The notification could not be delivered. Turn notifications off and on again." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not send" }, { status: 500 });
  }
}
