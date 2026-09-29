import { requireUser } from "@/lib/auth";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export default async function SetPasswordPage() {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-6 py-16">
      <SetPasswordForm email={user.email} />
    </div>
  );
}
