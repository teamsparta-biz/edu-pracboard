import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Link2 } from "lucide-react";
import { getSessionUser, homePath } from "@/lib/auth";
import { listMyBoards } from "@/lib/data";
import { educationTitle, roundLabel } from "@/lib/education";
import { roleLabel } from "@/lib/permissions";
import AppHeader from "@/components/app/AppHeader";
import Notice from "@/components/app/Notice";
import LoginForm from "@/components/auth/LoginForm";
import { Badge } from "@/components/ui/badge";

// 로그인 화면이자, 로그인한 사용자를 자기 화면으로 보내는 입구.
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const user = await getSessionUser();

  if (!user) {
    const next = typeof params.next === "string" ? params.next : "/";
    const error = typeof params.error === "string" ? params.error : undefined;
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-6 py-16">
        <LoginForm next={next} linkError={error} />
      </div>
    );
  }

  const home = await homePath(user);
  if (home !== "/") redirect(home);

  // 강사·교육생: 참여한 보드가 하나면 바로 이동, 여러 개면 목록
  const boards = await listMyBoards(user.email);
  if (boards.length === 1) redirect(`/b/${boards[0].board.id}`);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader user={user} />
      {boards.length === 0 ? (
        <Notice
          icon={Link2}
          title="참여한 보드가 없어요"
          description="강사에게 받은 보드 URL로 들어오면 그 보드에 참여할 수 있어요."
        />
      ) : (
        <div className="w-full max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold tracking-tight">내 보드</h1>
          <div className="mt-8 space-y-3">
            {boards.map(({ board, lesson, round, education, division, role }) => (
              <Link
                key={board.id}
                href={`/b/${board.id}`}
                className="group flex items-center gap-4 bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground truncate">
                    {education.company?.name} · {educationTitle(education.name)}
                  </div>
                  <div className="mt-1 font-semibold">
                    {roundLabel(round)} · {lesson.order}차시{division ? ` · ${division.name}` : ""}
                  </div>
                </div>
                <Badge variant="outline">{roleLabel[role]}</Badge>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
