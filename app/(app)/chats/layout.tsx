import { redirect } from "next/navigation";
import ChatsShell from "@/components/ChatsShell";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Message, Profile } from "@/lib/types";

export default async function ChatsLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  // Round trip 1: my chat and both profiles (there are only ever two people).
  const [mineRes, profilesRes] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, last_read_at").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("profiles").select("id, username, display_name, avatar_url, about, last_seen_at, show_last_seen, read_receipts"),
  ]);

  const mine = mineRes.data;
  const partner = ((profilesRes.data ?? []) as Profile[]).find((p) => p.id !== userId) ?? null;

  let lastMessage: Message | null = null;
  let unread = 0;

  if (mine) {
    // Round trip 2: the latest message and the unread count, together.
    const [lastRes, countRes] = await Promise.all([
      supabase.from("messages").select("*").eq("conversation_id", mine.conversation_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", mine.conversation_id)
        .neq("sender_id", userId)
        .gt("created_at", mine.last_read_at),
    ]);
    lastMessage = lastRes.data as Message | null;
    unread = countRes.count ?? 0;
  }

  return (
    <ChatsShell meId={userId} conversationId={mine?.conversation_id ?? null} partner={partner} lastMessage={lastMessage} unread={unread}>
      {children}
    </ChatsShell>
  );
}
