import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import InstallCard from "@/components/InstallCard";
import PrivacyToggles from "@/components/PrivacyToggles";
import ProfileEditor from "@/components/ProfileEditor";
import PushSettings from "@/components/PushSettings";
import ThemeToggle from "@/components/ThemeToggle";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function SettingsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, username, about, avatar_url, show_last_seen, read_receipts")
    .eq("id", userId)
    .single();

  return (
    <div className="safe-top h-full overflow-y-auto">
      <div className="mx-auto max-w-lg px-5 pb-10 pt-5">
        <h1 className="text-2xl font-extrabold text-ink dark:text-white">Settings</h1>

        <h2 className="mb-2 mt-5 text-sm font-bold text-ink-muted">Profile</h2>
        <ProfileEditor
          key={`${me?.display_name}-${me?.username}-${me?.avatar_url}`}
          userId={userId}
          initial={{
            display_name: me?.display_name ?? "",
            username: me?.username ?? "",
            about: me?.about ?? null,
            avatar_url: me?.avatar_url ?? null,
          }}
        />

        <h2 className="mb-2 mt-8 text-sm font-bold text-ink-muted">Privacy</h2>
        <PrivacyToggles
          userId={userId}
          initial={{ show_last_seen: me?.show_last_seen !== false, read_receipts: me?.read_receipts !== false }}
        />

        <h2 className="mb-2 mt-8 text-sm font-bold text-ink-muted">Appearance</h2>
        <ThemeToggle />

        <h2 className="mb-2 mt-8 text-sm font-bold text-ink-muted">Install app</h2>
        <InstallCard />

        <h2 className="mb-2 mt-8 text-sm font-bold text-ink-muted">Notifications</h2>
        <PushSettings />

        <form action={signOut} className="mt-8">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white/70 py-3.5 font-semibold text-rose-600 shadow-card hover:bg-white dark:border-rose-400/30 dark:bg-white/5">
            <LogOut size={18} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
