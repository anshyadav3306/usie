"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, Info, Pin as PinIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { clearBadge } from "@/lib/push";
import { disappearLabel } from "@/lib/disappear";
import { baseMime, extForMime, type VoiceResult } from "@/lib/voice";
import { dayKey, dayLabel, lastSeenText, summarize } from "@/lib/format";
import { wallpaperClass } from "@/lib/wallpapers";
import type { LocalMessage, Message, PinRow, Profile, Reaction } from "@/lib/types";
import Avatar from "./Avatar";
import ChatInfo from "./ChatInfo";
import Composer from "./Composer";
import MediaViewer from "./MediaViewer";
import MessageBubble, { type ReactionGroup } from "./MessageBubble";
import MessageMenu from "./MessageMenu";

const PAGE = 50;
const BUCKET = "chat-media";
const MAX_UPLOAD = 15 * 1024 * 1024;

type Pending = { kind: "image"; file: File } | { kind: "voice"; blob: Blob; mime: string };

type Props = {
  conversationId: string;
  meId: string;
  partner: Profile | null;
  initialMessages: Message[];
  initialReactions: Reaction[];
  initialPins: PinRow[];
  initialWallpaper: string | null;
  initialMuted: boolean;
  hasMoreInitial: boolean;
  partnerLastRead: string | null;
  focusId: string | null;
  initialDisappear: number | null;
  myReadReceipts: boolean;
};

export default function ChatView({
  conversationId,
  meId,
  partner: partnerProp,
  initialMessages,
  initialReactions,
  initialPins,
  initialWallpaper,
  initialMuted,
  hasMoreInitial,
  partnerLastRead,
  focusId,
  initialDisappear,
  myReadReceipts,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partnerRead, setPartnerRead] = useState<string | null>(partnerLastRead);
  const [partner, setPartner] = useState<Profile | null>(partnerProp);
  const partnerId = partnerProp?.id ?? null;
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [menuFor, setMenuFor] = useState<LocalMessage | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [editing, setEditing] = useState<LocalMessage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pins, setPins] = useState<PinRow[]>(initialPins);
  const [pinCache, setPinCache] = useState<Record<string, Message>>({});
  const [pinIndex, setPinIndex] = useState(0);
  const [wallpaper, setWallpaper] = useState<string | null>(initialWallpaper);
  const [muted, setMuted] = useState(initialMuted);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [disappearAfter, setDisappearAfter] = useState<number | null>(initialDisappear);
  const [now, setNow] = useState(() => Date.now());
  const [pinGone, setPinGone] = useState<Record<string, true>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const urlsSignedAt = useRef(0);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingFiles = useRef(new Map<string, Pending>());
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const pinCacheRef = useRef(pinCache);
  pinCacheRef.current = pinCache;

  const partnerName = partner?.display_name ?? "Your person";

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const upsert = useCallback((m: Message) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...m, localUrl: prev[i].localUrl };
        return copy;
      }
      return [...prev, m].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    });
  }, []);

  const markRead = useCallback(async () => {
    await supabase.rpc("mark_read", { conv: conversationId });
    clearBadge();
  }, [supabase, conversationId]);

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .eq("conversation_id", conversationId)
      .limit(2000);
    if (data) setReactions(data as Reaction[]);
  }, [supabase, conversationId]);

  const fetchPins = useCallback(async () => {
    const { data } = await supabase
      .from("pinned_messages")
      .select("message_id, pinned_at")
      .eq("conversation_id", conversationId);
    if (data) setPins(data as PinRow[]);
  }, [supabase, conversationId]);

  // Refresh the latest messages (covers new, edited and deleted ones) after being away.
  const catchUp = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    (data as Message[] | null)?.forEach(upsert);

    const { data: pm } = await supabase
      .from("conversation_members")
      .select("last_read_at")
      .eq("conversation_id", conversationId)
      .neq("user_id", meId)
      .maybeSingle();
    if (pm) setPartnerRead(pm.last_read_at);
    fetchReactions();
    fetchPins();
  }, [supabase, conversationId, meId, upsert, fetchReactions, fetchPins]);

  useEffect(() => {
    setMounted(true);
    markRead();
  }, [markRead]);

  // Messages, read receipts and the partner's last-seen time.
  useEffect(() => {
    const filter = `conversation_id=eq.${conversationId}`;
    let channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (payload) => {
        const m = payload.new as Message;
        upsert(m);
        if (m.sender_id !== meId) {
          setPartnerTyping(false);
          if (document.visibilityState === "visible") markRead();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, (payload) => {
        upsert(payload.new as Message);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter }, (payload) => {
        const row = payload.new as { user_id: string; last_read_at: string; muted: boolean };
        if (row.user_id === meId) setMuted(!!row.muted);
        else setPartnerRead(row.last_read_at);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` }, (payload) => {
        const row = payload.new as { wallpaper: string | null; disappear_after: number | null };
        setWallpaper(row.wallpaper);
        setDisappearAfter(row.disappear_after);
      });
    if (partnerId) {
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${partnerId}` },
        (payload) => setPartner((prev) => (prev ? { ...prev, ...(payload.new as Profile) } : prev))
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, meId, partnerId, upsert, markRead]);

  // Reactions (a delete event carries no filterable fields, so any change triggers a refetch).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        clearTimeout(t);
        t = setTimeout(fetchReactions, 150);
      })
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, fetchReactions]);

  // Pinned messages (refetch on any change).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`pins:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pinned_messages" }, () => {
        clearTimeout(t);
        t = setTimeout(fetchPins, 150);
      })
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, fetchPins]);

  // Pinned messages that are further back than what is loaded still need their text for the banner.
  useEffect(() => {
    const missing = pins
      .map((p) => p.message_id)
      .filter((id) => !messagesRef.current.some((m) => m.id === id) && !pinCacheRef.current[id]);
    if (missing.length === 0) return;
    supabase
      .from("messages")
      .select("*")
      .in("id", missing)
      .then(({ data }) => {
        if (!data) return;
        const found = new Set((data as Message[]).map((m) => m.id));
        setPinGone((prev) => {
          const next = { ...prev };
          missing.forEach((id) => {
            if (!found.has(id)) next[id] = true;
          });
          return next;
        });
        setPinCache((prev) => {
          const next = { ...prev };
          (data as Message[]).forEach((m) => {
            next[m.id] = m;
          });
          return next;
        });
      });
  }, [pins, supabase]);

  // Typing indicator + online status.
  useEffect(() => {
    const room = supabase.channel(`room:${conversationId}`, {
      config: { presence: { key: meId }, broadcast: { self: false } },
    });
    room
      .on("presence", { event: "sync" }, () => {
        const state = room.presenceState();
        setPartnerOnline(!!partnerId && partnerId in state);
      })
      .on("broadcast", { event: "typing" }, (msg) => {
        const user = (msg.payload as { user?: string } | undefined)?.user;
        if (user === meId) return;
        setPartnerTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPartnerTyping(false), 3000);
      })
      .on("broadcast", { event: "stop_typing" }, () => {
        clearTimeout(typingTimer.current);
        setPartnerTyping(false);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await room.track({ online_at: new Date().toISOString() });
      });
    roomRef.current = room;

    const onVis = () => {
      if (document.visibilityState === "visible") room.track({ online_at: new Date().toISOString() });
      else room.untrack();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(typingTimer.current);
      roomRef.current = null;
      supabase.removeChannel(room);
    };
  }, [supabase, conversationId, meId, partnerId]);

  // Keep my own "last seen" fresh.
  useEffect(() => {
    const ping = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", meId)
        .then(() => {});
    };
    const tick = () => {
      if (document.visibilityState === "visible") ping();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") ping();
    };
    ping();
    const t = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [supabase, meId]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      // Signed photo links expire; re-sign them if the tab has been open a long time.
      if (Date.now() - urlsSignedAt.current > 5 * 60 * 60 * 1000) setUrls({});
      catchUp();
      markRead();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [catchUp, markRead]);

  // Sign photo links for any message that needs one.
  useEffect(() => {
    const need = [
      ...new Set(messages.map((m) => m.media_path).filter((p): p is string => !!p && !urlsRef.current[p])),
    ];
    if (need.length === 0) return;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(need, 6 * 60 * 60)
      .then(({ data }) => {
        if (!data) return;
        urlsSignedAt.current = Date.now();
        setUrls((prev) => {
          const next = { ...prev };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [messages, urls, supabase]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!mounted || !el) return;
    if (prevHeight.current !== null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, mounted, partnerTyping]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function loadMore() {
    const first = messagesRef.current.find((m) => !m.status);
    if (!first || loadingMore) return;
    setLoadingMore(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", first.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data ?? []) as Message[]).reverse();
    prevHeight.current = scrollRef.current?.scrollHeight ?? null;
    stickToBottom.current = false;
    setMessages((prev) => [...older, ...prev]);
    setHasMore((data?.length ?? 0) === PAGE);
    setLoadingMore(false);
  }

  function blankMessage(over: Partial<LocalMessage>): LocalMessage {
    return {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: meId,
      type: "text",
      body: null,
      reply_to: replyTo?.id ?? null,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      media_path: null,
      media_width: null,
      media_height: null,
      media_duration_ms: null,
      media_waveform: null,
      expires_at: null,
      status: "sending",
      ...over,
    };
  }

  function markFailed(id: string) {
    setMessages((p) => p.map((x) => (x.id === id ? { ...x, status: "failed" } : x)));
  }

  async function insertText(m: LocalMessage) {
    const { data, error } = await supabase
      .from("messages")
      .insert({ id: m.id, conversation_id: m.conversation_id, sender_id: m.sender_id, type: "text", body: m.body, reply_to: m.reply_to })
      .select()
      .single();
    if (error || !data) return markFailed(m.id);
    upsert(data as Message);
  }

  async function uploadAndInsert(m: LocalMessage, file: File) {
    try {
      const { blob, width, height, ext, mime } = await compressImage(file);
      const path = `${conversationId}/${m.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mime });
      // A retry after a half-finished send finds the file already there, which is fine.
      if (upErr && !/already exists|duplicate/i.test(upErr.message)) throw upErr;
      const { data, error } = await supabase
        .from("messages")
        .insert({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          type: "image",
          body: null,
          reply_to: m.reply_to,
          media_path: path,
          media_width: width,
          media_height: height,
        })
        .select()
        .single();
      if (error || !data) throw error;
      pendingFiles.current.delete(m.id);
      upsert(data as Message);
    } catch {
      markFailed(m.id);
    }
  }

  function stopTyping() {
    lastTypingSent.current = 0;
    roomRef.current?.send({ type: "broadcast", event: "stop_typing", payload: {} });
  }

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    roomRef.current?.send({ type: "broadcast", event: "typing", payload: { user: meId } });
  }

  function send(text: string) {
    const body = text.trim();
    if (!body) return;
    const m = blankMessage({ body });
    stickToBottom.current = true;
    setReplyTo(null);
    setMessages((p) => [...p, m]);
    stopTyping();
    insertText(m);
  }

  function sendImage(file: File) {
    if (!file.type.startsWith("image/")) return flash("Only photos can be sent for now.");
    if (file.size > MAX_UPLOAD) return flash("That photo is too large. The limit is 15 MB.");
    const m = blankMessage({ type: "image", localUrl: URL.createObjectURL(file) });
    pendingFiles.current.set(m.id, { kind: "image", file });
    stickToBottom.current = true;
    setReplyTo(null);
    setMessages((p) => [...p, m]);
    uploadAndInsert(m, file);
  }

  async function uploadVoice(m: LocalMessage, blob: Blob, mime: string) {
    try {
      const path = `${conversationId}/${m.id}.${extForMime(mime)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: baseMime(mime) });
      if (upErr && !/already exists|duplicate/i.test(upErr.message)) throw upErr;
      const { data, error } = await supabase
        .from("messages")
        .insert({
          id: m.id,
          conversation_id: m.conversation_id,
          sender_id: m.sender_id,
          type: "voice",
          body: null,
          reply_to: m.reply_to,
          media_path: path,
          media_duration_ms: m.media_duration_ms,
          media_waveform: m.media_waveform,
        })
        .select()
        .single();
      if (error || !data) throw error;
      pendingFiles.current.delete(m.id);
      upsert(data as Message);
    } catch {
      markFailed(m.id);
    }
  }

  function sendVoice(v: VoiceResult) {
    const m = blankMessage({
      type: "voice",
      localUrl: URL.createObjectURL(v.blob),
      media_duration_ms: v.durationMs,
      media_waveform: v.waveform,
    });
    pendingFiles.current.set(m.id, { kind: "voice", blob: v.blob, mime: v.mime });
    stickToBottom.current = true;
    setReplyTo(null);
    setMessages((p) => [...p, m]);
    stopTyping();
    uploadVoice(m, v.blob, v.mime);
  }

  function retry(m: LocalMessage) {
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, status: "sending" } : x)));
    const pending = pendingFiles.current.get(m.id);
    if (m.type === "image" && pending?.kind === "image") uploadAndInsert(m, pending.file);
    else if (m.type === "voice" && pending?.kind === "voice") uploadVoice(m, pending.blob, pending.mime);
    else if (m.type === "text") insertText(m);
    else markFailed(m.id);
  }

  async function saveEdit(m: LocalMessage, text: string) {
    const body = text.trim();
    if (!body || body === m.body) return;
    const editedAt = new Date().toISOString();
    setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, body, edited_at: editedAt } : x)));
    const { error } = await supabase.from("messages").update({ body, edited_at: editedAt }).eq("id", m.id);
    if (error) {
      setMessages((p) => p.map((x) => (x.id === m.id ? { ...x, body: m.body, edited_at: m.edited_at } : x)));
      flash("Couldn't save your edit. Try again.");
    }
  }

  async function deleteMessage(m: LocalMessage) {
    if (!window.confirm("Delete this message for everyone?")) return;
    const at = new Date().toISOString();
    setMessages((p) =>
      p.map((x) => (x.id === m.id ? { ...x, deleted_at: at, body: null, media_path: null, media_width: null, media_height: null, media_duration_ms: null, media_waveform: null } : x))
    );
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: at, body: null, media_path: null, media_width: null, media_height: null, media_duration_ms: null, media_waveform: null })
      .eq("id", m.id);
    if (error) {
      setMessages((p) => p.map((x) => (x.id === m.id ? m : x)));
      flash("Couldn't delete that message. Try again.");
      return;
    }
    if (m.media_path) await supabase.storage.from(BUCKET).remove([m.media_path]);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const mineNow = reactions.find((r) => r.message_id === messageId && r.user_id === meId);
    const others = (p: Reaction[]) => p.filter((r) => !(r.message_id === messageId && r.user_id === meId));
    if (mineNow?.emoji === emoji) {
      setReactions(others);
      const { error } = await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", meId);
      if (error) fetchReactions();
    } else {
      setReactions((p) => [...others(p), { message_id: messageId, user_id: meId, emoji }]);
      const { error } = await supabase
        .from("message_reactions")
        .upsert({ message_id: messageId, user_id: meId, conversation_id: conversationId, emoji }, { onConflict: "message_id,user_id" });
      if (error) fetchReactions();
    }
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return flash("Couldn't find that message.");
    stickToBottom.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1600);
  }

  async function goTo(id: string) {
    let tries = 0;
    while (!messagesRef.current.some((m) => m.id === id) && hasMoreRef.current && tries < 10) {
      await loadMore();
      await new Promise((r) => setTimeout(r, 80));
      tries += 1;
    }
    requestAnimationFrame(() => jumpTo(id));
  }

  useEffect(() => {
    if (focusId && mounted) goTo(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, mounted]);

  const pinnedIds = useMemo(() => new Set(pins.map((p) => p.message_id)), [pins]);

  async function togglePin(m: LocalMessage) {
    if (pinnedIds.has(m.id)) {
      setPins((p) => p.filter((x) => x.message_id !== m.id));
      const { error } = await supabase.from("pinned_messages").delete().eq("conversation_id", conversationId).eq("message_id", m.id);
      if (error) fetchPins();
    } else {
      setPins((p) => [{ message_id: m.id, pinned_at: new Date().toISOString() }, ...p]);
      const { error } = await supabase.from("pinned_messages").insert({ conversation_id: conversationId, message_id: m.id, pinned_by: meId });
      if (error) {
        fetchPins();
        flash("Couldn't pin that message.");
      }
    }
  }

  async function changeWallpaper(key: string) {
    const prev = wallpaper;
    setWallpaper(key);
    const { error } = await supabase.from("conversations").update({ wallpaper: key }).eq("id", conversationId);
    if (error) {
      setWallpaper(prev);
      flash("Couldn't change the wallpaper.");
    }
  }

  async function changeMuted(next: boolean) {
    setMuted(next);
    const { error } = await supabase
      .from("conversation_members")
      .update({ muted: next })
      .eq("conversation_id", conversationId)
      .eq("user_id", meId);
    if (error) {
      setMuted(!next);
      flash("Couldn't update notifications.");
    }
  }

  async function changeDisappear(value: number | null) {
    const prev = disappearAfter;
    setDisappearAfter(value);
    const { error } = await supabase.from("conversations").update({ disappear_after: value }).eq("id", conversationId);
    if (error) {
      setDisappearAfter(prev);
      flash("Couldn't change disappearing messages.");
    }
  }

  // Expired messages disappear from the screen on time; the database stops returning them too.
  const hasExpiring = messages.some((m) => m.expires_at);
  useEffect(() => {
    if (!hasExpiring) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [hasExpiring]);

  const visible = useMemo(
    () => messages.filter((m) => !m.expires_at || Date.parse(m.expires_at) > now),
    [messages, now]
  );
  const byId = useMemo(() => new Map(visible.map((m) => [m.id, m])), [visible]);

  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, Map<string, ReactionGroup>>();
    for (const r of reactions) {
      const groups = map.get(r.message_id) ?? new Map<string, ReactionGroup>();
      const g = groups.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      g.count += 1;
      if (r.user_id === meId) g.mine = true;
      groups.set(r.emoji, g);
      map.set(r.message_id, groups);
    }
    return map;
  }, [reactions, meId]);

  const expiredIds = new Set(messages.filter((m) => m.expires_at && Date.parse(m.expires_at) <= now).map((m) => m.id));
  const pinList = pins
    .filter((p) => !pinGone[p.message_id] && !expiredIds.has(p.message_id))
    .sort((a, b) => Date.parse(b.pinned_at) - Date.parse(a.pinned_at));
  const pinNow = pinList.length ? pinList[pinIndex % pinList.length] : null;
  const pinnedMsg = pinNow ? (byId.get(pinNow.message_id) ?? pinCache[pinNow.message_id] ?? null) : null;

  const lastSeen = partner?.show_last_seen !== false ? (partner?.last_seen_at ?? null) : null;
  const receiptsOn = myReadReceipts && partner?.read_receipts !== false;

  const status = partnerTyping
    ? "typing…"
    : partnerOnline
      ? "Online"
      : lastSeen
        ? lastSeenText(lastSeen)
        : partner
          ? `@${partner.username}`
          : "";

  const menuReaction = menuFor
    ? (reactions.find((r) => r.message_id === menuFor.id && r.user_id === meId)?.emoji ?? null)
    : null;

  function replyInfo(m: LocalMessage) {
    if (!m.reply_to) return null;
    const orig = byId.get(m.reply_to);
    if (!orig) return { id: m.reply_to, name: "Earlier message", text: "Tap to find it" };
    return { id: orig.id, name: orig.sender_id === meId ? "You" : partnerName, text: summarize(orig) };
  }

  return (
    <div className="flex h-full min-w-0">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="safe-top flex items-center gap-3 border-b border-brand-100 bg-white/70 px-3 pb-3 pt-3 backdrop-blur dark:border-white/10 dark:bg-[#1b1630]/80">
          <button
            onClick={() => router.push("/chats")}
            aria-label="Back to chats"
            className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-brand-50 dark:text-white dark:hover:bg-white/10 md:hidden"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="relative">
            <Avatar name={partnerName} url={partner?.avatar_url} size={42} />
            {partnerOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 dark:border-[#1b1630]" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-ink dark:text-white">{partnerName}</p>
            <p suppressHydrationWarning aria-live="polite" className={`truncate text-xs ${partnerTyping || partnerOnline ? "font-semibold text-brand-600 dark:text-brand-200" : "text-ink-muted"}`}>
              {status}
            </p>
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="Chat settings"
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10 lg:hidden"
          >
            <Info size={21} />
          </button>
          <button
            onClick={() => setInfoOpen((o) => !o)}
            aria-label="Toggle chat info"
            aria-pressed={infoOpen}
            className="ml-auto hidden h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10 lg:grid"
          >
            <Info size={21} />
          </button>
        </header>

        {pinNow && (
          <button
            onClick={() => {
              goTo(pinNow.message_id);
              setPinIndex((i) => i + 1);
            }}
            className="flex w-full items-center gap-3 border-b border-brand-100 bg-brand-50/90 px-4 py-2 text-left backdrop-blur dark:border-white/10 dark:bg-white/5"
            aria-label="Go to pinned message"
          >
            <PinIcon size={16} className="shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-brand-700 dark:text-brand-200">
                Pinned message{pinList.length > 1 ? ` ${(pinIndex % pinList.length) + 1} of ${pinList.length}` : ""}
              </span>
              <span className="block truncate text-sm text-ink-soft dark:text-white/80">{pinnedMsg ? summarize(pinnedMsg) : "Loading…"}</span>
            </span>
          </button>
        )}

        {disappearAfter && (
          <p className="border-b border-brand-100 bg-white/60 px-4 py-1.5 text-center text-xs font-semibold text-ink-muted backdrop-blur dark:border-white/10 dark:bg-black/10">
            ⏳ New messages disappear after {disappearLabel(disappearAfter)}
          </p>
        )}

        <div ref={scrollRef} onScroll={onScroll} className={`${wallpaperClass(wallpaper)} min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6`}>
          {!mounted ? null : (
            <>
              {hasMore && (
                <div className="mb-3 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-brand-600 shadow-card dark:bg-white/10 dark:text-brand-200"
                  >
                    {loadingMore ? "Loading…" : "Load earlier messages"}
                  </button>
                </div>
              )}
              {visible.length === 0 && (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="text-4xl">👋</p>
                    <p className="mt-2 font-bold text-ink dark:text-white">Say hi to {partnerName}</p>
                    <p className="text-sm text-ink-muted">Your messages show up here.</p>
                  </div>
                </div>
              )}
              {visible.map((m, i) => {
                const prev = visible[i - 1];
                const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
                const grouped =
                  !!prev && !newDay && prev.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60 * 1000;
                const mine = m.sender_id === meId;
                const seen = mine && receiptsOn && !m.status && !!partnerRead && Date.parse(partnerRead) >= Date.parse(m.created_at);
                const imageUrl = m.media_path ? (urls[m.media_path] ?? m.localUrl ?? null) : (m.localUrl ?? null);
                return (
                  <div key={m.id}>
                    {newDay && (
                      <div className="my-4 flex justify-center">
                        <span suppressHydrationWarning className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink-muted shadow-card dark:bg-white/10">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      message={m}
                      mine={mine}
                      grouped={grouped}
                      seen={seen}
                      reply={replyInfo(m)}
                      imageUrl={imageUrl}
                      reactions={[...(reactionsByMessage.get(m.id)?.values() ?? [])]}
                      highlighted={highlightId === m.id}
                      onRetry={() => retry(m)}
                      onMenu={() => !m.status && setMenuFor(m)}
                      onReact={(emoji) => toggleReaction(m.id, emoji)}
                      onOpenImage={() => imageUrl && setViewer(imageUrl)}
                      onJump={goTo}
                    />
                  </div>
                );
              })}
              {partnerTyping && (
                <div className="mt-3 flex justify-start" aria-hidden>
                  <div className="flex gap-1 rounded-bubble rounded-bl-md bg-white/95 px-4 py-3 shadow-card dark:bg-white/10">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Composer
          onSend={(t) => {
            if (editing) {
              saveEdit(editing, t);
              setEditing(null);
            } else send(t);
          }}
          onSendImage={sendImage}
          onSendVoice={sendVoice}
          onNotice={flash}
          onTyping={notifyTyping}
          reply={replyTo ? { name: replyTo.sender_id === meId ? "yourself" : partnerName, text: summarize(replyTo) } : null}
          onCancelReply={() => setReplyTo(null)}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
          notice={notice}
        />
      </div>

      {infoOpen && partner && (
        <aside className="hidden h-full w-[300px] shrink-0 overflow-y-auto border-l border-brand-100 bg-white/50 px-5 py-8 backdrop-blur dark:border-white/10 dark:bg-black/20 lg:block">
          <ChatInfo
            partner={partner}
            wallpaper={wallpaper}
            onWallpaper={changeWallpaper}
            muted={muted}
            onMute={changeMuted}
            disappearAfter={disappearAfter}
            onDisappear={changeDisappear}
            pinCount={pinList.length}
            onShowPins={() => pinNow && goTo(pinNow.message_id)}
          />
        </aside>
      )}

      {sheetOpen && partner && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setSheetOpen(false)} role="dialog" aria-label="Chat settings">
          <div className="safe-bottom max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-soft dark:bg-[#1b1630]" onClick={(e) => e.stopPropagation()}>
            <ChatInfo
              partner={partner}
              wallpaper={wallpaper}
              onWallpaper={changeWallpaper}
              muted={muted}
              onMute={changeMuted}
            disappearAfter={disappearAfter}
            onDisappear={changeDisappear}
              pinCount={pinList.length}
              onShowPins={() => {
                setSheetOpen(false);
                if (pinNow) goTo(pinNow.message_id);
              }}
              onClose={() => setSheetOpen(false)}
            />
          </div>
        </div>
      )}

      {menuFor && (
        <MessageMenu
          mine={menuFor.sender_id === meId}
          canCopy={menuFor.type === "text" && !!menuFor.body}
          canEdit={menuFor.type === "text"}
          myReaction={menuReaction}
          pinned={pinnedIds.has(menuFor.id)}
          onPin={() => {
            togglePin(menuFor);
            setMenuFor(null);
          }}
          onClose={() => setMenuFor(null)}
          onReact={(emoji) => {
            toggleReaction(menuFor.id, emoji);
            setMenuFor(null);
          }}
          onReply={() => {
            setEditing(null);
            setReplyTo(menuFor);
            setMenuFor(null);
          }}
          onCopy={() => {
            navigator.clipboard?.writeText(menuFor.body ?? "").then(() => flash("Copied"));
            setMenuFor(null);
          }}
          onEdit={() => {
            setReplyTo(null);
            setEditing(menuFor);
            setMenuFor(null);
          }}
          onDelete={() => {
            const m = menuFor;
            setMenuFor(null);
            deleteMessage(m);
          }}
        />
      )}

      {viewer && <MediaViewer url={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
