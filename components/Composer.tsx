"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Mic, Pencil, Smile, X } from "lucide-react";
import { voiceSupported, type VoiceResult } from "@/lib/voice";
import EmojiPicker from "./EmojiPicker";
import VoiceRecorder from "./VoiceRecorder";
import type { LocalMessage } from "@/lib/types";

type Props = {
  onSend: (text: string) => void;
  onSendImage: (file: File) => void;
  onSendVoice: (v: VoiceResult) => void;
  onTyping: () => void;
  onNotice: (text: string) => void;
  reply: { name: string; text: string } | null;
  onCancelReply: () => void;
  editing: LocalMessage | null;
  onCancelEdit: () => void;
  notice: string | null;
};

export default function Composer({ onSend, onSendImage, onSendVoice, onTyping, onNotice, reply, onCancelReply, editing, onCancelEdit, notice }: Props) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [canVoice, setCanVoice] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setCanVoice(voiceSupported()), []);

  function resize() {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  useEffect(() => {
    if (editing) {
      setText(editing.body ?? "");
      requestAnimationFrame(() => {
        resize();
        ref.current?.focus();
      });
    }
  }, [editing]);

  useEffect(() => {
    if (reply) ref.current?.focus();
  }, [reply]);

  function submit() {
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      resize();
      ref.current?.focus();
    });
  }

  function cancelEdit() {
    onCancelEdit();
    setText("");
    requestAnimationFrame(resize);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      if (editing) cancelEdit();
      else if (reply) onCancelReply();
      return;
    }
    // Phones: Enter adds a new line. Laptops: Enter sends, Shift+Enter adds a new line.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function insertEmoji(emoji: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    onTyping();
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
      resize();
    });
  }

  const showMic = canVoice && !text.trim() && !editing;

  return (
    <div className="safe-bottom relative border-t border-brand-100 bg-white/70 px-3 pt-3 backdrop-blur dark:border-white/10 dark:bg-[#1b1630]/80">
      {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}

      {notice && (
        <p role="status" className="mb-2 rounded-xl bg-blush-100 px-3 py-2 text-sm text-rose-700">
          {notice}
        </p>
      )}

      {(reply || editing) && !recording && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border-l-4 border-brand-500 bg-brand-50 px-3 py-2 dark:bg-white/10">
          {editing && <Pencil size={16} className="shrink-0 text-brand-600" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-brand-700 dark:text-brand-200">{editing ? "Editing message" : `Replying to ${reply?.name}`}</p>
            {reply && !editing && <p className="truncate text-xs text-ink-soft dark:text-white/70">{reply.text}</p>}
          </div>
          <button
            onClick={editing ? cancelEdit : onCancelReply}
            aria-label={editing ? "Cancel edit" : "Cancel reply"}
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-white/70 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {recording ? (
        <VoiceRecorder
          onSend={(v) => {
            setRecording(false);
            onSendVoice(v);
          }}
          onCancel={() => setRecording(false)}
          onError={onNotice}
        />
      ) : (
        <div className="mb-3 flex items-end gap-2">
          <div className="flex min-h-[46px] flex-1 items-end rounded-3xl border border-brand-100 bg-white shadow-card focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 dark:border-white/10 dark:bg-white/10">
            <button
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              aria-label="Emoji"
              aria-expanded={emojiOpen}
              className="grid h-[46px] w-11 shrink-0 place-items-center text-ink-muted hover:text-brand-600"
            >
              <Smile size={22} />
            </button>
            <textarea
              ref={ref}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                resize();
                if (e.target.value.trim()) onTyping();
              }}
              onKeyDown={onKeyDown}
              placeholder="Type a message…"
              aria-label="Message"
              className="max-h-36 min-h-[46px] min-w-0 flex-1 resize-none bg-transparent py-3 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!editing}
              aria-label="Send a photo"
              className="grid h-[46px] w-11 shrink-0 place-items-center text-ink-muted hover:text-brand-600 disabled:opacity-40"
            >
              <ImagePlus size={22} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSendImage(f);
                e.target.value = "";
              }}
            />
          </div>
          {showMic ? (
            <button
              type="button"
              onClick={() => {
                setEmojiOpen(false);
                setRecording(true);
              }}
              aria-label="Record a voice message"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-soft transition hover:bg-brand-600"
            >
              <Mic size={22} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim()}
              aria-label={editing ? "Save edit" : "Send message"}
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-40"
            >
              <ArrowUp size={22} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
