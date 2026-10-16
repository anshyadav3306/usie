"use client";

import { useRef } from "react";
import { AlertCircle, Check, CheckCheck, Clock, MoreHorizontal } from "lucide-react";
import { formatTime } from "@/lib/format";
import VoiceBubble from "./VoiceBubble";
import type { LocalMessage } from "@/lib/types";

export type ReactionGroup = { emoji: string; count: number; mine: boolean };

type Props = {
  message: LocalMessage;
  mine: boolean;
  grouped: boolean;
  seen: boolean;
  reply: { id: string; name: string; text: string } | null;
  imageUrl: string | null;
  reactions: ReactionGroup[];
  highlighted: boolean;
  onRetry: () => void;
  onMenu: () => void;
  onReact: (emoji: string) => void;
  onOpenImage: () => void;
  onJump: (id: string) => void;
};

export default function MessageBubble({
  message,
  mine,
  grouped,
  seen,
  reply,
  imageUrl,
  reactions,
  highlighted,
  onRetry,
  onMenu,
  onReact,
  onOpenImage,
  onJump,
}: Props) {
  const deleted = !!message.deleted_at;
  const isImage = message.type === "image" && !deleted;
  const isVoice = message.type === "voice" && !deleted;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const startPress = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || deleted) return;
    timer.current = setTimeout(() => {
      navigator.vibrate?.(10);
      onMenu();
    }, 450);
  };
  const cancelPress = () => clearTimeout(timer.current);

  return (
    <div id={`msg-${message.id}`} className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
      <div className={`group flex max-w-[82%] items-center gap-1 md:max-w-[68%] ${mine ? "flex-row-reverse" : ""}`}>
        <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
          <div
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onPointerMove={cancelPress}
            onContextMenu={(e) => {
              if (deleted) return;
              e.preventDefault();
              onMenu();
            }}
            className={`select-none shadow-card transition-shadow [-webkit-touch-callout:none] md:select-text ${
              isImage ? "p-1.5" : "px-4 py-2.5"
            } ${
              mine
                ? "rounded-bubble rounded-br-md bg-brand-200 text-ink dark:bg-brand-600 dark:text-white"
                : "rounded-bubble rounded-bl-md bg-white/95 text-ink dark:bg-white/10 dark:text-white"
            } ${highlighted ? "ring-2 ring-brand-500" : ""} ${message.status === "sending" ? "opacity-80" : ""}`}
          >
            {reply && !deleted && (
              <button
                onClick={() => onJump(reply.id)}
                className="mb-1.5 block w-full rounded-xl border-l-4 border-brand-500 bg-black/5 px-2.5 py-1.5 text-left dark:bg-white/10"
              >
                <span className="block text-xs font-bold text-brand-700 dark:text-brand-200">{reply.name}</span>
                <span className="line-clamp-2 break-words text-xs text-ink-soft dark:text-white/70">{reply.text}</span>
              </button>
            )}

            {isImage &&
              (imageUrl ? (
                <button
                  onClick={onOpenImage}
                  aria-label="Open photo"
                  className="block overflow-hidden rounded-2xl bg-brand-50 dark:bg-white/5"
                  style={{
                    width: "min(260px, 70vw)",
                    aspectRatio: message.media_width && message.media_height ? `${message.media_width} / ${message.media_height}` : "4 / 3",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Shared photo" className="h-full w-full object-cover" draggable={false} />
                </button>
              ) : (
                <div className="h-40 w-[min(260px,70vw)] animate-pulse rounded-2xl bg-brand-100 dark:bg-white/10" />
              ))}

            {isVoice && <VoiceBubble url={imageUrl} durationMs={message.media_duration_ms ?? 0} waveform={message.media_waveform} />}

            {deleted ? (
              <p className="text-[15px] italic text-ink-muted">This message was deleted</p>
            ) : (
              message.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{message.body}</p>
            )}

            <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] text-ink-muted dark:text-white/60 ${isImage ? "px-1.5 pb-0.5" : ""}`}>
              {message.edited_at && !deleted && <span>edited</span>}
              <span suppressHydrationWarning>{formatTime(message.created_at)}</span>
              {mine &&
                (message.status === "sending" ? (
                  <Clock size={12} aria-label="Sending" />
                ) : message.status === "failed" ? (
                  <button onClick={onRetry} className="flex items-center gap-1 font-semibold text-rose-600" aria-label="Retry sending">
                    <AlertCircle size={13} /> Retry
                  </button>
                ) : seen ? (
                  <CheckCheck size={14} className="text-brand-700 dark:text-brand-200" aria-label="Seen" />
                ) : (
                  <Check size={14} aria-label="Sent" />
                ))}
            </div>
          </div>

          {reactions.length > 0 && !deleted && (
            <div className={`-mt-2 flex gap-1 px-2 ${mine ? "justify-end" : "justify-start"}`}>
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => onReact(r.emoji)}
                  aria-label={`${r.emoji} ${r.count}${r.mine ? ", yours" : ""}`}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm shadow-card ${
                    r.mine
                      ? "border-brand-400 bg-brand-100 dark:bg-brand-600/50"
                      : "border-brand-100 bg-white dark:border-white/10 dark:bg-[#2a2347]"
                  }`}
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 && <span className="text-xs font-semibold text-ink-soft dark:text-white/80">{r.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!deleted && (
          <button
            onClick={onMenu}
            aria-label="Message actions"
            className="hidden h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted opacity-0 transition hover:bg-white/70 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10 md:grid"
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
