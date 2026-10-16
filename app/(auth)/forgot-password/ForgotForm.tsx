"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import Field from "@/components/Field";
import { createClient } from "@/lib/supabase/client";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error && /rate|limit|seconds/i.test(error.message)) {
      setError("Too many requests. Wait a minute and try again.");
      return;
    }
    // Same message whether or not the email has an account, so nobody can probe for accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl bg-brand-100 px-4 py-4 text-center text-sm text-brand-700 dark:bg-brand-600/20 dark:text-brand-100">
        If that email has an account, a reset link is on its way. Open it on this same device for the smoothest experience.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} />} />
      {error && (
        <p role="alert" className="rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="w-full rounded-2xl bg-brand-500 py-3.5 font-bold text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-60">
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
