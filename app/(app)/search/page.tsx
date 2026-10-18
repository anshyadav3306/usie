import { redirect } from "next/navigation";
import SearchView from "@/components/SearchView";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SearchPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  const [mine, profiles] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const partnerName = profiles.data?.find((p) => p.id !== userId)?.display_name ?? "them";

  return <SearchView conversationId={mine.data?.conversation_id ?? null} meId={userId} partnerName={partnerName} />;
}
