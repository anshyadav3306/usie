import AuthShell from "@/components/AuthShell";
import ResetForm from "./ResetForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you'll remember 💜">
      <ResetForm />
    </AuthShell>
  );
}
