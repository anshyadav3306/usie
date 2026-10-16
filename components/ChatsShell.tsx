"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listTime } from "@/lib/format";
import type { Message, Profile } from "@/lib/types";
import Avatar from "./Avatar";

type Props = {
  meId: string;
  conversationId: string | null;
  partner: Profile | null;
  lastMessage: Message | null;
  unread: number;
  children: React.ReactNode;
};

function preview(m: Message | null, meId: string) {
  if (!m) return "Say hi 💜";
  if (m.deleted_at) return "Message deleted";
  const prefix = m.sender_id === meId ? "You: " : "";
  if (m.type === "image") return `${prefix}📷 Photo`;
  if (m.type === "voice") return `${prefix}🎤 Voice message`;
  return `${prefix}${m.body ?? ""}`;
}

export default function ChatsShell({ meId, conversationId, partner, lastMessage, unread: unreadInit, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isChatOpen = pathname.startsWith("/chats/") && pathname.split("/")[2] !== "";
  const openRef = useRef(isChatOpen);
  openRef.current = isChatOpen;

  const [last, setLast] = useState<Message | null>(lastMessage);
  const [unread, setUnread] = useState(unreadInit);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`list:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setLast(m);
          if (m.sender_id !== meId && !openRef.current) setUnread((u) => u + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Message;
          setLast((prev) => (prev && prev.id === m.id ? m : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, meId]);

  useEffect(() => {
    if (isChatOpen) setUnread(0);
  }, [isChatOpen]);

  // On wide screens, open the one conversation straight away.
  useEffect(() => {
    if (conversationId && pathname === "/chats" && window.matchMedia("(min-width: 768px)").matches) {
      router.replace(`/chats/${conversationId}`);
    }
  }, [conversationId, pathname, router]);

  const active = conversationId && pathname === `/chats/${conversationId}`;

  return (
    <div className="flex h-full">
      <section
        className={`${isChatOpen ? "hidden md:flex" : "flex"} h-full w-full flex-col border-r border-brand-100 bg-white/40 backdrop-blur dark:border-white/10 dark:bg-black/10 md:w-[340px] md:shrink-0`}
      >
        <header className="safe-top px-5 pb-3 pt-5">
          <h1 className="text-2xl font-extrabold text-ink dark:text-white">Chats</h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {conversationId && partner ? (
            <Link
              href={`/chats/${conversationId}`}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                active ? "bg-brand-100 dark:bg-brand-600/25" : "hover:bg-brand-50 dark:hover:bg-white/5"
              }`}
            >
              <Avatar name={partner.display_name} url={partner.avatar_url} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold text-ink dark:text-white">{partner.display_name}</span>
                  {last && (
                    <span suppressHydrationWarning className="shrink-0 text-xs text-ink-muted">
                      {listTime(last.created_at)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-ink-muted">{preview(last, meId)}</span>
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="mx-2 mt-6 rounded-3xl border border-brand-100 bg-white/70 p-6 text-center shadow-card dark:border-white/10 dark:bg-white/5">
              <p className="text-3xl">💌</p>
              <p className="mt-3 font-bold text-ink dark:text-white">Waiting for your person</p>
              <p className="mt-1 text-sm text-ink-muted">
                Your chat appears here as soon as they sign up with their invite code.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className={`${isChatOpen ? "flex" : "hidden md:flex"} h-full min-w-0 flex-1 flex-col`}>{children}</section>
    </div>
  );
}
