import { requireAdmin } from "@/lib/auth";
import AppHeader from "@/components/app/AppHeader";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader user={user} roleLabel="관리자" />
      {children}
    </div>
  );
}
