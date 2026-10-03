import { redirect } from "next/navigation";
import { isInstructor, requireUser } from "@/lib/auth";
import AppHeader from "@/components/app/AppHeader";

// 강사 화면. 강사로 등록된 보드가 하나도 없으면 들어올 수 없다.
export default async function InstructorLayout({ children }: LayoutProps<"/instructor">) {
  const user = await requireUser();
  if (!(await isInstructor(user.email))) redirect("/");
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader user={user} roleLabel="강사" />
      {children}
    </div>
  );
}
