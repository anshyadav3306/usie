import { redirect } from "next/navigation";
import ChatsShell from "@/components/ChatsShell";
import { createClient } from "@/lib/supabase/server";
import type { Message, Profile } from "@/lib/types";

export default async function ChatsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let conversationId: string | null = null;
  let lastReadAt: string | null = null;
  let partner: Profile | null = null;
  let lastMessage: Message | null = null;
  let unread = 0;

  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (mine) {
    conversationId = mine.conversation_id;
    lastReadAt = mine.last_read_at;

    const { data: other } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id)
      .maybeSingle();

    if (other) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, about, last_seen_at, show_last_seen, read_receipts")
        .eq("id", other.user_id)
        .single();
      partner = p as Profile | null;
    }

    const { data: last } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastMessage = last as Message | null;

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .gt("created_at", lastReadAt);
    unread = count ?? 0;
  }

  return (
    <ChatsShell
      meId={user.id}
      conversationId={conversationId}
      partner={partner}
      lastMessage={lastMessage}
      unread={unread}
    >
      {children}
    </ChatsShell>
  );
}
