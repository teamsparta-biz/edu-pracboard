"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Building2, GraduationCap, ShieldCheck, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import { educationTitle } from "@/lib/education";
import type { Role } from "@/store/types";
import { homePath, roleLabel } from "@/lib/permissions";
import { useHydrated } from "@/lib/use-hydrated";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/app/RoleGate";

const roles: { role: Role; icon: LucideIcon; scope: string; permission: string }[] = [
  { role: "admin", icon: ShieldCheck, scope: "생성된 모든 교육", permission: "Master" },
  { role: "client", icon: Building2, scope: "read 권한이 있는 교육", permission: "Read" },
  { role: "instructor", icon: BookOpen, scope: "배정된 보드 URL 1개", permission: "CRUD" },
  { role: "student", icon: GraduationCap, scope: "가입한 보드 URL 1개", permission: "CRUD" },
];

const SIGNUP_DEMO_BOARD = "onb-r1-l1";

// 인증이 붙기 전까지 주체별 화면을 확인하기 위한 데모 계정 선택 화면.
export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { users, currentUserId, signIn, signOut, getBoard, getLesson, getRound, getEducation } =
    useAppStore();

  function boardLabel(boardId?: string) {
    const lesson = getLesson(getBoard(boardId)?.lessonId);
    const round = getRound(lesson?.roundId);
    const education = getEducation(round?.educationId);
    if (!lesson || !round || !education) return "";
    return `${educationTitle(education.name)} · ${round.order}회차 ${lesson.order}차시`;
  }

  function scopeLabel(userId: string) {
    const u = users.find((x) => x.id === userId)!;
    if (u.role === "admin") return "전체 교육";
    if (u.role === "client") return u.educationIds?.map((id) => educationTitle(getEducation(id)?.name ?? "")).join(", ");
    return boardLabel(u.boardId);
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-10">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            PracBoard · 교육 실습 결과물 보드
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">데모 계정 선택</h1>
          <p className="mt-2 text-muted-foreground">
            로그인이 붙기 전까지, 주체별 화면을 계정을 바꿔가며 확인할 수 있어요.
          </p>
        </div>

        {!hydrated ? (
          <Loading />
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {roles.map(({ role, icon: Icon, scope, permission }) => (
            <section key={role} className="bg-white rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{roleLabel[role]}</h2>
                    <p className="text-xs text-muted-foreground">{scope}</p>
                  </div>
                </div>
                <Badge variant="outline">{permission}</Badge>
              </div>

              <div className="mt-5 space-y-2">
                {users
                  .filter((u) => u.role === role)
                  .map((u) => {
                    const active = u.id === currentUserId;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          signIn(u.id);
                          router.push(homePath(u));
                        }}
                        className={
                          "group w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors " +
                          (active ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/50")
                        }
                      >
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                          {u.name.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex items-center gap-2">
                            {u.name}
                            {active && <Badge variant="secondary">현재</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {u.email} · {scopeLabel(u.id)}
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </button>
                    );
                  })}

                {role === "student" && (
                  <button
                    onClick={() => {
                      signOut();
                      router.push(`/b/${SIGNUP_DEMO_BOARD}`);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium">보드 URL로 새로 가입하기</div>
                      <div className="text-xs text-muted-foreground">
                        로그아웃 상태로 {boardLabel(SIGNUP_DEMO_BOARD)} 보드에 들어가요
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
