"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressAvatar } from "@/lib/image";
import Avatar from "./Avatar";

type Initial = { display_name: string; username: string; about: string | null; avatar_url: string | null };

const BUCKET = "avatars";
const field =
  "w-full rounded-2xl border border-brand-100 bg-white px-4 py-3 text-[15px] text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white";

function pathFromUrl(url: string | null) {
  const marker = `/${BUCKET}/`;
  const i = url ? url.indexOf(marker) : -1;
  return url && i >= 0 ? url.slice(i + marker.length) : null;
}

export default function ProfileEditor({ userId, initial }: { userId: string; initial: Initial }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.display_name);
  const [username, setUsername] = useState(initial.username);
  const [about, setAbout] = useState(initial.about ?? "");
  const [avatar, setAvatar] = useState(initial.avatar_url);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function replaceAvatar(file: File | null) {
    setBusy(true);
    setMessage(null);
    try {
      let url: string | null = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Please choose a photo.");
        const blob = await compressAvatar(file);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (error) throw error;
      const old = pathFromUrl(avatar);
      if (old) await supabase.storage.from(BUCKET).remove([old]);
      setAvatar(url);
      setMessage({ ok: true, text: file ? "Photo updated." : "Photo removed." });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error && e.message === "Please choose a photo." ? e.message : "Couldn't update the photo. Try a smaller image." });
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const cleanName = name.trim();
    const cleanUser = username.trim().toLowerCase();
    if (!cleanName) return setMessage({ ok: false, text: "Your name can't be empty." });
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) return setMessage({ ok: false, text: "Usernames are 3 to 20 letters, numbers or underscores." });
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: cleanName, username: cleanUser, about: about.trim() || null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      return setMessage({ ok: false, text: error.code === "23505" ? "That username is taken." : "Couldn't save. Try again." });
    }
    setUsername(cleanUser);
    setMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="rounded-3xl border border-brand-100 bg-white/70 p-4 shadow-card dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar name={name || "?"} url={avatar} size={72} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Change profile photo"
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-brand-500 text-white shadow-soft hover:bg-brand-600 disabled:opacity-60 dark:border-[#1b1630]"
          >
            <Camera size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) replaceAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-ink dark:text-white">{initial.display_name}</p>
          {avatar ? (
            <button type="button" onClick={() => replaceAvatar(null)} disabled={busy} className="text-sm font-semibold text-rose-600 disabled:opacity-60">
              Remove photo
            </button>
          ) : (
            <p className="text-sm text-ink-muted">Add a photo for your person to see</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-muted">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoCapitalize="none" required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-ink-muted">About</span>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} rows={2} placeholder="A little line about you" className={`${field} resize-none`} />
        </label>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-100" : "bg-blush-100 text-rose-700"}`}>
          {message.text}
        </p>
      )}
      <button type="submit" disabled={busy} className="mt-4 w-full rounded-2xl bg-brand-500 py-3 font-bold text-white shadow-soft hover:bg-brand-600 disabled:opacity-60">
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
