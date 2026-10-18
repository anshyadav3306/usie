import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToSubscriptions } from "@/lib/push-server";
import { sameSecret } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MessageRecord = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  body: string | null;
  deleted_at: string | null;
};

// Called by the Supabase database webhook whenever a row is inserted into `messages`.
export async function POST(req: Request) {
  if (!sameSecret(req.headers.get("x-webhook-secret"), process.env.WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as { type?: string; table?: string; record?: MessageRecord } | null;
  const m = payload?.record;
  if (!payload || payload.type !== "INSERT" || payload.table !== "messages" || !m) {
    return NextResponse.json({ ok: true, skipped: "not a new message" });
  }
  if (m.deleted_at || (m.type !== "text" && m.type !== "image" && m.type !== "voice")) {
    return NextResponse.json({ ok: true, skipped: "nothing to announce" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server is not configured." }, { status: 500 });
  }

  const { data: members } = await admin
    .from("conversation_members")
    .select("user_id, muted, last_read_at")
    .eq("conversation_id", m.conversation_id);
  const recipients = (members ?? []).filter((r) => r.user_id !== m.sender_id && !r.muted);
  if (recipients.length === 0) return NextResponse.json({ ok: true, skipped: "no recipients" });

  const { data: sender } = await admin.from("profiles").select("display_name").eq("id", m.sender_id).single();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", recipients.map((r) => r.user_id));

  const text = m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎤 Voice message" : (m.body ?? "").slice(0, 140);
  let sent = 0;

  for (const r of recipients) {
    const mine = (subs ?? []).filter((s) => s.user_id === r.user_id);
    if (mine.length === 0) continue;

    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", m.conversation_id)
      .neq("sender_id", r.user_id)
      .is("deleted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .gt("created_at", r.last_read_at);

    try {
      const result = await sendToSubscriptions(admin, mine, {
        title: sender?.display_name ?? "usie",
        body: text,
        url: `/chats/${m.conversation_id}`,
        tag: `chat-${m.conversation_id}`,
        badge: count ?? 1,
      });
      sent += result.sent;
      if (result.sent === 0 && result.firstError) console.error("push not delivered", result.firstError);
    } catch (e) {
      // Configuration problem (missing or mismatched keys): say so in the Vercel logs.
      console.error("push failed:", e instanceof Error ? e.message : e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Push failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, sent });
}
