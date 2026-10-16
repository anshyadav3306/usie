"use client";

import Link from "next/link";
import { BellOff, Hourglass, Pin, Search, X } from "lucide-react";
import { DISAPPEAR_OPTIONS } from "@/lib/disappear";
import { WALLPAPERS } from "@/lib/wallpapers";
import type { Profile } from "@/lib/types";
import Avatar from "./Avatar";

type Props = {
  partner: Profile;
  wallpaper: string | null;
  onWallpaper: (key: string) => void;
  muted: boolean;
  onMute: (next: boolean) => void;
  disappearAfter: number | null;
  onDisappear: (value: number | null) => void;
  pinCount: number;
  onShowPins: () => void;
  onClose?: () => void;
};

const row =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-semibold text-ink hover:bg-brand-50 disabled:opacity-50 dark:text-white dark:hover:bg-white/10";

export default function ChatInfo({ partner, wallpaper, onWallpaper, muted, onMute, disappearAfter, onDisappear, pinCount, onShowPins, onClose }: Props) {
  const current = wallpaper ?? "hearts";
  return (
    <div className="w-full">
      {onClose && (
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-ink-muted hover:bg-brand-50 dark:hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <Avatar name={partner.display_name} url={partner.avatar_url} size={88} />
        <h2 className="mt-3 text-xl font-extrabold text-ink dark:text-white">{partner.display_name}</h2>
        <p className="text-sm text-ink-muted">@{partner.username}</p>
        {partner.about && <p className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-ink-soft dark:bg-white/10 dark:text-white/80">{partner.about}</p>}
      </div>

      <div className="mt-6 space-y-1">
        <Link href="/search" className={row}>
          <Search size={19} className="text-brand-600" /> Search in chat
        </Link>
        <button onClick={onShowPins} disabled={pinCount === 0} className={row}>
          <Pin size={19} className="text-brand-600" /> Pinned messages
          <span className="ml-auto text-sm font-bold text-ink-muted">{pinCount}</span>
        </button>
        <div className={`${row} cursor-default`}>
          <BellOff size={19} className="text-brand-600" /> Mute notifications
          <button
            role="switch"
            aria-checked={muted}
            aria-label="Mute notifications"
            onClick={() => onMute(!muted)}
            className={`relative ml-auto h-7 w-12 shrink-0 rounded-full transition ${muted ? "bg-brand-500" : "bg-brand-100 dark:bg-white/15"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${muted ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      <h3 className="mb-2 mt-4 flex items-center gap-2 px-1 text-sm font-bold text-ink-muted">
        <Hourglass size={15} /> Disappearing messages
      </h3>
      <div role="group" aria-label="Disappearing messages" className="flex gap-1.5 rounded-2xl bg-brand-50 p-1.5 dark:bg-white/5">
        {DISAPPEAR_OPTIONS.map((o) => (
          <button
            key={o.label}
            onClick={() => onDisappear(o.value)}
            aria-pressed={disappearAfter === o.value}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              disappearAfter === o.value ? "bg-brand-500 text-white shadow-soft" : "text-ink-muted hover:bg-white/70 dark:hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-xs text-ink-muted">Applies to new messages for both of you.</p>

      <h3 className="mb-2 mt-6 px-1 text-sm font-bold text-ink-muted">Chat wallpaper</h3>
      <div className="grid grid-cols-3 gap-2">
        {WALLPAPERS.map((w) => (
          <button
            key={w.key}
            onClick={() => onWallpaper(w.key)}
            aria-pressed={current === w.key}
            aria-label={`${w.label} wallpaper`}
            className={`overflow-hidden rounded-2xl border-2 text-xs font-semibold text-ink-soft transition dark:text-white/80 ${
              current === w.key ? "border-brand-500" : "border-transparent"
            }`}
          >
            <div className={`${w.className} h-16 bg-brand-50 dark:bg-[#17132a]`} />
            <div className="bg-white/80 py-1.5 dark:bg-white/5">{w.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
