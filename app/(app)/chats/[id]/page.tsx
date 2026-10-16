import { notFound, redirect } from "next/navigation";
import ChatView from "@/components/ChatView";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, last_read_at, muted")
    .eq("conversation_id", id);
  const mine = members?.find((m) => m.user_id === user.id);
  if (!members || !mine) notFound();

  const partnerMember = members.find((m) => m.user_id !== user.id) ?? null;
  let partner: Profile | null = null;
  if (partnerMember) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, about, last_seen_at, show_last_seen, read_receipts")
      .eq("id", partnerMember.user_id)
      .single();
    partner = data as Profile | null;
  }

  const { data: conv } = await supabase.from("conversations").select("wallpaper, disappear_after").eq("id", id).single();

  const { data: meProfile } = await supabase.from("profiles").select("read_receipts").eq("id", user.id).single();

  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  const initial = ((msgs ?? []) as Message[]).reverse();

  const { data: reacts } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .eq("conversation_id", id)
    .limit(2000);

  const { data: pinRows } = await supabase
    .from("pinned_messages")
    .select("message_id, pinned_at")
    .eq("conversation_id", id);

  return (
    <ChatView
      key={id}
      conversationId={id}
      meId={user.id}
      partner={partner}
      initialMessages={initial}
      initialReactions={(reacts ?? []) as Reaction[]}
      initialPins={(pinRows ?? []) as PinRow[]}
      initialWallpaper={conv?.wallpaper ?? null}
      initialMuted={!!mine.muted}
      hasMoreInitial={(msgs?.length ?? 0) === PAGE}
      partnerLastRead={partnerMember?.last_read_at ?? null}
      focusId={focusId ?? null}
      initialDisappear={conv?.disappear_after ?? null}
      myReadReceipts={meProfile?.read_receipts !== false}
    />
  );
}
