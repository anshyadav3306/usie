import { redirect } from "next/navigation";
import UsView from "@/components/us/UsView";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BucketItem, Countdown, Note, UsPhoto } from "@/lib/types";

export default async function UsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  const [mine, profiles] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("profiles").select("id, display_name"),
  ]);

  if (!mine.data) {
    return (
      <div className="safe-top grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-4xl">💌</p>
          <p className="mt-3 text-lg font-bold text-ink dark:text-white">Your space opens soon</p>
          <p className="mt-1 text-sm text-ink-muted">Once your person joins, your shared photos, notes and countdowns live here.</p>
        </div>
      </div>
    );
  }

  const id = mine.data.conversation_id;
  const [space, notes, countdowns, bucket, photos] = await Promise.all([
    supabase.from("shared_space").select("anniversary_date").eq("conversation_id", id).maybeSingle(),
    supabase.from("us_notes").select("*").eq("conversation_id", id).order("updated_at", { ascending: false }),
    supabase.from("us_countdowns").select("*").eq("conversation_id", id).order("target_date", { ascending: true }),
    supabase.from("us_bucket_items").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("us_photos").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200),
  ]);

  const partnerName = profiles.data?.find((p) => p.id !== userId)?.display_name ?? "Your person";

  return (
    <UsView
      conversationId={id}
      meId={userId}
      partnerName={partnerName}
      initial={{
        anniversary: space.data?.anniversary_date ?? null,
        notes: (notes.data ?? []) as Note[],
        countdowns: (countdowns.data ?? []) as Countdown[],
        bucket: (bucket.data ?? []) as BucketItem[],
        photos: (photos.data ?? []) as UsPhoto[],
      }}
    />
  );
}
