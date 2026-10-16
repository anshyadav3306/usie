import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameSecret } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runs once a day (see vercel.json). Expired messages are already invisible; this frees the
// storage space by deleting their rows and any photo or voice file they had.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: expired, error } = await admin
    .from("messages")
    .select("id, media_path")
    .lt("expires_at", new Date().toISOString())
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expired || expired.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  const paths = expired.map((m) => m.media_path).filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from("chat-media").remove(paths);

  const { error: delError } = await admin.from("messages").delete().in("id", expired.map((m) => m.id));
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: expired.length, files: paths.length });
}
