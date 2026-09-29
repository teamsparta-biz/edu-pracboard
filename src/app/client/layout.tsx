import { redirect } from "next/navigation";
import { homePath, requireUser } from "@/lib/auth";
import AppHeader from "@/components/app/AppHeader";

// 고객사 담당자 화면. 열람 권한이 부여된 교육이 하나도 없으면 들어올 수 없다.
export default async function ClientLayout({ children }: LayoutProps<"/client">) {
  const user = await requireUser();
  if ((await homePath(user)) !== "/client") redirect("/");
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader user={user} roleLabel="고객사 담당자" />
      {children}
    </div>
  );
}
