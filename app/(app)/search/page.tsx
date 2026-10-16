import { redirect } from "next/navigation";
import SearchView from "@/components/SearchView";
import { createClient } from "@/lib/supabase/server";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let partnerName = "them";
  if (mine) {
    const { data: other } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", mine.conversation_id)
      .neq("user_id", user.id)
      .maybeSingle();
    if (other) {
      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", other.user_id).single();
      if (p) partnerName = p.display_name;
    }
  }

  return <SearchView conversationId={mine?.conversation_id ?? null} meId={user.id} partnerName={partnerName} />;
}
