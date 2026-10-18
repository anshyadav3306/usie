import { notFound, redirect } from "next/navigation";
import ChatView from "@/components/ChatView";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Message, PinRow, Profile, Reaction } from "@/lib/types";

const PAGE = 50;

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const { m: focusId } = await searchParams;
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  // One round trip for everything. If this is not your chat, the database rules return nothing.
  const [members, profiles, conv, msgs, reacts, pinRows] = await Promise.all([
    supabase.from("conversation_members").select("user_id, last_read_at, muted").eq("conversation_id", id),
    supabase.from("profiles").select("id, username, display_name, avatar_url, about, last_seen_at, show_last_seen, read_receipts"),
    supabase.from("conversations").select("wallpaper, disappear_after").eq("id", id).maybeSingle(),
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(PAGE),
    supabase.from("message_reactions").select("message_id, user_id, emoji").eq("conversation_id", id).limit(2000),
    supabase.from("pinned_messages").select("message_id, pinned_at").eq("conversation_id", id),
  ]);

  const mine = members.data?.find((m) => m.user_id === userId);
  if (!mine) notFound();

  const partnerMember = members.data?.find((m) => m.user_id !== userId) ?? null;
  const all = (profiles.data ?? []) as Profile[];
  const partner = all.find((p) => p.id !== userId) ?? null;
  const me = all.find((p) => p.id === userId);
  const initial = ((msgs.data ?? []) as Message[]).reverse();

  return (
    <ChatView
      key={id}
      conversationId={id}
      meId={userId}
      partner={partner}
      initialMessages={initial}
      initialReactions={(reacts.data ?? []) as Reaction[]}
      initialPins={(pinRows.data ?? []) as PinRow[]}
      initialWallpaper={conv.data?.wallpaper ?? null}
      initialMuted={!!mine.muted}
      hasMoreInitial={(msgs.data?.length ?? 0) === PAGE}
      partnerLastRead={partnerMember?.last_read_at ?? null}
      focusId={focusId ?? null}
      initialDisappear={conv.data?.disappear_after ?? null}
      myReadReceipts={me?.read_receipts !== false}
    />
  );
}
