"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImagePlus } from "lucide-react";
import MediaViewer from "@/components/MediaViewer";
import type { UsPhoto } from "@/lib/types";

const BUCKET = "chat-media";

export default function PhotoWall({
  photos,
  meId,
  uploading,
  onAdd,
  onDelete,
  supabase,
}: {
  photos: UsPhoto[];
  meId: string;
  uploading: boolean;
  onAdd: (files: File[]) => void;
  onDelete: (photo: UsPhoto) => Promise<boolean>;
  supabase: SupabaseClient;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef(urls);
  urlsRef.current = urls;
  const [open, setOpen] = useState<UsPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const need = [...new Set(photos.map((p) => p.media_path).filter((p) => !urlsRef.current[p]))];
    if (need.length === 0) return;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(need, 6 * 60 * 60)
      .then(({ data }) => {
        if (!data) return;
        setUrls((prev) => {
          const next = { ...prev };
          data.forEach((d) => {
            if (d.path && d.signedUrl) next[d.path] = d.signedUrl;
          });
          return next;
        });
      });
  }, [photos, urls, supabase]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink dark:text-white">Our Moments</h2>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-60"
        >
          <ImagePlus size={17} /> {uploading ? "Uploading…" : "Add photos"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onAdd(files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white/50 px-6 py-10 text-center dark:border-white/15 dark:bg-white/5">
          <p className="text-4xl">📸</p>
          <p className="mt-2 font-bold text-ink dark:text-white">Your photo wall is empty</p>
          <p className="text-sm text-ink-muted">Add the moments you want to keep. You both see them here.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {photos.map((p) => (
            <li key={p.id} className="aspect-square overflow-hidden rounded-2xl bg-brand-100 dark:bg-white/10">
              {urls[p.media_path] ? (
                <button onClick={() => setOpen(p)} aria-label="Open photo" className="h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[p.media_path]} alt="Shared moment" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div className="h-full w-full animate-pulse" />
              )}
            </li>
          ))}
        </ul>
      )}

      {open && urls[open.media_path] && (
        <MediaViewer
          url={urls[open.media_path]}
          onClose={() => setOpen(null)}
          onDelete={
            open.uploaded_by === meId
              ? async () => {
                  const done = await onDelete(open);
                  if (done) setOpen(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
