"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, KeyRound, Lock, Mail, User } from "lucide-react";
import Field from "@/components/Field";
import { createClient } from "@/lib/supabase/client";

export default function SignupForm({ initialInvite }: { initialInvite: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    invite: initialInvite,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          display_name: form.displayName.trim(),
          username: form.username.trim().toLowerCase(),
          invite_code: form.invite.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("database error")
          ? "We couldn't create that account. Check the invite code, pick a different username if it may be taken, or note this space may already have two people."
          : error.message
      );
      return;
    }
    if (data.session) {
      router.replace("/chats");
      router.refresh();
    } else {
      setNotice("Check your email to confirm your account, then sign in.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Your name" name="displayName" required value={form.displayName} onChange={set("displayName")} icon={<User size={18} />} />
      <Field
        label="Username"
        name="username"
        required
        pattern="[a-zA-Z0-9_]{3,20}"
        title="3–20 letters, numbers or underscores"
        autoCapitalize="none"
        value={form.username}
        onChange={set("username")}
        icon={<AtSign size={18} />}
      />
      <Field label="Email" name="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} icon={<Mail size={18} />} />
      <Field
        label="Password (6+ characters)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={6}
        required
        value={form.password}
        onChange={set("password")}
        icon={<Lock size={18} />}
      />
      <Field label="Invite code" name="invite" required autoCapitalize="characters" value={form.invite} onChange={set("invite")} icon={<KeyRound size={18} />} />
      {error && (
        <p role="alert" className="rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notice && <p className="rounded-xl bg-brand-100 px-4 py-2.5 text-sm text-brand-700">{notice}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-brand-500 py-3.5 font-bold text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
