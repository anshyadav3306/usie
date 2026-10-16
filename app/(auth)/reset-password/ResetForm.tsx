"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Field from "@/components/Field";
import { createClient } from "@/lib/supabase/client";

export default function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace("/chats");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="New password (6+ characters)" name="password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock size={18} />} />
      <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} icon={<Lock size={18} />} />
      {error && (
        <p role="alert" className="rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full rounded-2xl bg-brand-500 py-3.5 font-bold text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-60">
        {loading ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
