"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Field from "@/components/Field";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email or password is incorrect. Check both and try again.");
      return;
    }
    router.replace("/chats");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        icon={<Mail size={18} />}
      />
      <Field
        label="Password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={<Lock size={18} />}
        trailing={
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="text-brand-400 hover:text-brand-600"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />
      {error && (
        <p role="alert" className="rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-brand-500 py-3.5 font-bold text-white shadow-soft transition hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
