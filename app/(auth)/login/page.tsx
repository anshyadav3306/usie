import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Your private space to chat, share and stay close 💜">
      <LoginForm />
      <p className="mt-4 text-center">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-600 dark:text-brand-200">
          Forgot password?
        </Link>
      </p>
      <div className="mt-8 text-center">
        <p className="mb-3 text-sm text-ink-muted">New here? Use an invite code</p>
        <Link
          href="/signup"
          className="block rounded-2xl border border-brand-200 bg-white/70 dark:bg-white/10 dark:text-brand-200 py-3.5 text-center font-semibold text-brand-600 shadow-card transition hover:bg-white"
        >
          Sign up with invite
        </Link>
      </div>
    </AuthShell>
  );
}
