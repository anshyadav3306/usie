"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Switch from "./Switch";

type Key = "show_last_seen" | "read_receipts";

export default function PrivacyToggles({ userId, initial }: { userId: string; initial: Record<Key, boolean> }) {
  const supabase = useMemo(() => createClient(), []);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function change(key: Key, next: boolean) {
    setError(null);
    setValues((v) => ({ ...v, [key]: next }));
    const { error } = await supabase.from("profiles").update({ [key]: next }).eq("id", userId);
    if (error) {
      setValues((v) => ({ ...v, [key]: !next }));
      setError("Couldn't save that setting. Try again.");
    }
  }

  const rows: { key: Key; title: string; hint: string }[] = [
    { key: "show_last_seen", title: "Show my last seen", hint: "Your person sees when you were last around. You'll still show as Online while the app is open." },
    { key: "read_receipts", title: "Read receipts", hint: "Double ticks show when a message was read. If you turn this off, you won't see theirs either." },
  ];

  return (
    <div className="divide-y divide-brand-100 rounded-3xl border border-brand-100 bg-white/70 shadow-card dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink dark:text-white">{r.title}</p>
            <p className="text-xs text-ink-muted">{r.hint}</p>
          </div>
          <Switch checked={values[r.key]} onChange={(n) => change(r.key, n)} label={r.title} />
        </div>
      ))}
      {error && (
        <p role="alert" className="px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
