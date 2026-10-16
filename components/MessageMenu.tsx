"use client";

import { useEffect, type ReactNode } from "react";
import { Copy, Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react";

const QUICK = ["❤️", "😂", "😮", "😢", "👍"];

type Props = {
  mine: boolean;
  canCopy: boolean;
  canEdit: boolean;
  myReaction: string | null;
  pinned: boolean;
  onPin: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

function Item({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold hover:bg-brand-50 dark:hover:bg-white/10 ${
        danger ? "text-rose-600" : "text-ink dark:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function MessageMenu({ mine, canCopy, canEdit, myReaction, pinned, onPin, onReact, onReply, onCopy, onEdit, onDelete, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-6 backdrop-blur-sm" onClick={onClose} role="dialog" aria-label="Message actions">
      <div className="w-full max-w-[280px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-between rounded-full bg-white px-3 py-2 shadow-soft dark:bg-[#241d3d]">
          {QUICK.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              aria-label={`React ${e}`}
              className={`grid h-10 w-10 place-items-center rounded-full text-2xl transition hover:scale-110 ${
                myReaction === e ? "bg-brand-100 dark:bg-brand-600/40" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="rounded-3xl bg-white p-1.5 shadow-soft dark:bg-[#241d3d]">
          <Item icon={<Reply size={19} />} label="Reply" onClick={onReply} />
          {canCopy && <Item icon={<Copy size={19} />} label="Copy" onClick={onCopy} />}
          {mine && canEdit && <Item icon={<Pencil size={19} />} label="Edit" onClick={onEdit} />}
          <Item icon={pinned ? <PinOff size={19} /> : <Pin size={19} />} label={pinned ? "Unpin" : "Pin"} onClick={onPin} />
          {mine && <Item icon={<Trash2 size={19} />} label="Delete" onClick={onDelete} danger />}
        </div>
      </div>
    </div>
  );
}
