import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <AuthShell title="Join our space" subtitle="Enter your invite code to create your account 💜">
      <SignupForm initialInvite={invite ?? ""} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
