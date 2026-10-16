import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import ForgotForm from "./ForgotForm";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a link to choose a new one 💜">
      {error === "expired" && (
        <p role="alert" className="mb-3 rounded-xl bg-blush-100 px-4 py-2.5 text-sm text-rose-700">
          That link has expired or was already used. Request a new one below.
        </p>
      )}
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-semibold text-brand-600">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
