"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Hourglass, Images, ListChecks, Pencil, StickyNote, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { daysTogether, daysUntil, formatDate, formatYMD, nextOccurrence, parseYMD, relativeDays, daysFromToday } from "@/lib/dates";
import type { BucketItem, Countdown, Note, UsPhoto } from "@/lib/types";
import BucketTab from "./BucketTab";
import CountdownsTab from "./CountdownsTab";
import NotesTab from "./NotesTab";
import PhotoWall from "./PhotoWall";

const BUCKET = "chat-media";
const MAX_UPLOAD = 15 * 1024 * 1024;

type Tab = "photos" | "notes" | "bucket" | "countdowns";

type Initial = {
  anniversary: string | null;
  notes: Note[];
  countdowns: Countdown[];
  bucket: BucketItem[];
  photos: UsPhoto[];
};

const TABS: { key: Tab; label: string; icon: typeof Images }[] = [
  { key: "photos", label: "Our Photos", icon: Images },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "bucket", label: "Bucket List", icon: ListChecks },
  { key: "countdowns", label: "Countdowns", icon: Hourglass },
];

export default function UsView({
  conversationId,
  meId,
  partnerName,
  initial,
}: {
  conversationId: string;
  meId: string;
  partnerName: string;
  initial: Initial;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("photos");
  const [anniversary, setAnniversary] = useState<string | null>(initial.anniversary);
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState(initial.anniversary ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [countdowns, setCountdowns] = useState(initial.countdowns);
  const [bucket, setBucket] = useState(initial.bucket);
  const [photos, setPhotos] = useState(initial.photos);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => setMounted(true), []);

  const fetchAll = useCallback(async () => {
    const [space, n, c, b, p] = await Promise.all([
      supabase.from("shared_space").select("anniversary_date").eq("conversation_id", conversationId).maybeSingle(),
      supabase.from("us_notes").select("*").eq("conversation_id", conversationId).order("updated_at", { ascending: false }),
      supabase.from("us_countdowns").select("*").eq("conversation_id", conversationId).order("target_date", { ascending: true }),
      supabase.from("us_bucket_items").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
      supabase.from("us_photos").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(200),
    ]);
    if (!space.error) setAnniversary(space.data?.anniversary_date ?? null);
    if (n.data) setNotes(n.data as Note[]);
    if (c.data) setCountdowns(c.data as Countdown[]);
    if (b.data) setBucket(b.data as BucketItem[]);
    if (p.data) setPhotos(p.data as UsPhoto[]);
  }, [supabase, conversationId]);

  // Either of you changing anything shows up for the other straight away.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(t);
      t = setTimeout(fetchAll, 200);
    };
    let channel = supabase.channel(`us:${conversationId}`);
    for (const table of ["shared_space", "us_notes", "us_countdowns", "us_bucket_items", "us_photos"]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refetch);
    }
    channel.subscribe();

    const onWake = () => document.visibilityState === "visible" && fetchAll();
    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onWake);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, fetchAll]);

  async function saveAnniversary() {
    const value = dateDraft || null;
    const { error } = await supabase
      .from("shared_space")
      .upsert({ conversation_id: conversationId, anniversary_date: value }, { onConflict: "conversation_id" });
    if (error) return flash("Couldn't save the date. Try again.");
    setAnniversary(value);
    setEditingDate(false);
  }

  async function addPhotos(files: File[]) {
    setUploading(true);
    let failed = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD) {
        failed += 1;
        continue;
      }
      try {
        const { blob, width, height, ext, mime } = await compressImage(file);
        const id = crypto.randomUUID();
        const path = `${conversationId}/us/${id}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mime });
        if (upErr) throw upErr;
        const { error } = await supabase.from("us_photos").insert({
          id,
          conversation_id: conversationId,
          media_path: path,
          media_width: width,
          media_height: height,
          uploaded_by: meId,
        });
        if (error) throw error;
      } catch {
        failed += 1;
      }
    }
    setUploading(false);
    if (failed) flash(failed === files.length ? "Couldn't upload. Photos must be under 15 MB." : `${failed} photo(s) couldn't be uploaded.`);
    fetchAll();
  }

  async function deletePhoto(photo: UsPhoto) {
    if (!window.confirm("Remove this photo from Our Photos?")) return false;
    const { error } = await supabase.from("us_photos").delete().eq("id", photo.id);
    if (error) {
      flash("Couldn't remove that photo.");
      return false;
    }
    await supabase.storage.from(BUCKET).remove([photo.media_path]);
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    return true;
  }

  // The nearest upcoming special day: your anniversary (every year) or any countdown.
  const next = useMemo(() => {
    if (!mounted) return null;
    const options: { title: string; days: number; date: Date }[] = [];
    if (anniversary) {
      const d = nextOccurrence(anniversary);
      options.push({ title: "Our Anniversary", days: daysUntil(d), date: d });
    }
    for (const c of countdowns) {
      const days = daysFromToday(c.target_date);
      if (days >= 0) options.push({ title: c.title, days, date: parseYMD(c.target_date) });
    }
    options.sort((a, b) => a.days - b.days);
    return options[0] ?? null;
  }, [mounted, anniversary, countdowns]);

  return (
    <div className="safe-top h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-5 pb-10 pt-5">
        <header className="flex items-center justify-center gap-2">
          <Heart size={20} className="fill-brand-400 text-brand-400" aria-hidden />
          <h1 className="text-xl font-extrabold text-ink dark:text-white">Our Space</h1>
        </header>

        {notice && (
          <p role="status" className="mt-4 rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
            {notice}
          </p>
        )}

        <section aria-label="Together" className="mt-5 overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-blush-100 via-brand-50 to-brand-100 p-6 text-center shadow-card dark:border-white/10 dark:from-brand-700/30 dark:via-white/5 dark:to-brand-600/20">
          {editingDate ? (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink-soft dark:text-white/80" htmlFor="anniversary">
                When did your story start?
              </label>
              <input
                id="anniversary"
                type="date"
                value={dateDraft}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDateDraft(e.target.value)}
                className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-3 text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-white/10 dark:bg-white/10 dark:text-white"
              />
              <div className="flex gap-2">
                <button onClick={() => setEditingDate(false)} className="flex-1 rounded-2xl border border-brand-200 bg-white/70 py-3 font-semibold text-brand-600 dark:bg-white/10 dark:text-brand-200">
                  Cancel
                </button>
                <button onClick={saveAnniversary} className="flex-1 rounded-2xl bg-brand-500 py-3 font-bold text-white shadow-soft hover:bg-brand-600">
                  Save
                </button>
              </div>
            </div>
          ) : anniversary ? (
            <>
              <p className="text-sm font-semibold text-ink-soft dark:text-white/80">Together for</p>
              <p suppressHydrationWarning className="my-1 text-6xl font-extrabold text-brand-600 dark:text-brand-200">
                {mounted ? daysTogether(anniversary).toLocaleString() : "–"}
              </p>
              <p className="text-sm font-semibold text-ink-soft dark:text-white/80">days 💜</p>
              <p suppressHydrationWarning className="mt-3 text-xs text-ink-muted">
                Since {formatYMD(anniversary)}
              </p>
              <button
                onClick={() => {
                  setDateDraft(anniversary);
                  setEditingDate(true);
                }}
                aria-label="Change the date"
                className="mx-auto mt-3 flex items-center gap-1 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold text-brand-600 dark:bg-white/10 dark:text-brand-200"
              >
                <Pencil size={13} /> Change date
              </button>
            </>
          ) : (
            <>
              <p className="text-4xl">💞</p>
              <p className="mt-2 font-bold text-ink dark:text-white">You and {partnerName}</p>
              <p className="mt-1 text-sm text-ink-muted">Add the day your story started to see how long you&apos;ve been together.</p>
              <button onClick={() => setEditingDate(true)} className="mt-4 rounded-2xl bg-brand-500 px-6 py-3 font-bold text-white shadow-soft hover:bg-brand-600">
                Set our date
              </button>
            </>
          )}
        </section>

        <div role="tablist" aria-label="Shared space" className="mt-5 grid grid-cols-4 gap-2">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-[11px] font-bold shadow-card transition sm:text-xs ${
                  active
                    ? "border-brand-400 bg-brand-100 text-brand-700 dark:border-brand-400/60 dark:bg-brand-600/30 dark:text-brand-100"
                    : "border-brand-100 bg-white/70 text-ink-soft hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                }`}
              >
                <Icon size={21} />
                {label}
              </button>
            );
          })}
        </div>

        <section className="mt-6" role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
          {tab === "photos" && (
            <PhotoWall photos={photos} meId={meId} uploading={uploading} onAdd={addPhotos} onDelete={deletePhoto} supabase={supabase} />
          )}
          {tab === "notes" && (
            <NotesTab notes={notes} meId={meId} partnerName={partnerName} conversationId={conversationId} supabase={supabase} onChanged={fetchAll} flash={flash} />
          )}
          {tab === "bucket" && (
            <BucketTab items={bucket} setItems={setBucket} conversationId={conversationId} meId={meId} supabase={supabase} onChanged={fetchAll} flash={flash} />
          )}
          {tab === "countdowns" && (
            <CountdownsTab countdowns={countdowns} mounted={mounted} conversationId={conversationId} supabase={supabase} onChanged={fetchAll} flash={flash} />
          )}
        </section>

        <section aria-label="Next special date" className="mt-8">
          <h2 className="mb-2 text-sm font-bold text-ink-muted">Next special date</h2>
          <div className="flex items-center gap-4 rounded-3xl border border-brand-100 bg-white/70 p-4 shadow-card dark:border-white/10 dark:bg-white/5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-2xl dark:bg-brand-600/30" aria-hidden>
              🎉
            </div>
            {next ? (
              <div className="min-w-0">
                <p className="truncate font-bold text-ink dark:text-white">{next.title}</p>
                <p suppressHydrationWarning className="text-sm text-ink-muted">
                  {relativeDays(next.days)} · {formatDate(next.date)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Add a countdown or your anniversary to see what&apos;s coming up.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
