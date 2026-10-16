"use client";

import { useEffect } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";

export default function MediaViewer({ url, onClose, onDelete }: { url: string; onClose: () => void; onDelete?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-label="Photo" onClick={onClose}>
      <div className="safe-top absolute right-3 top-3 flex gap-2">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete photo"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-rose-300 hover:bg-white/25"
          >
            <Trash2 size={20} />
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="Open original"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <ExternalLink size={20} />
        </a>
        <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
          <X size={22} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="max-h-[92dvh] max-w-[96vw] object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
