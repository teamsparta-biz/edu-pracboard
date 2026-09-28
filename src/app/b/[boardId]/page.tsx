"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import { educationTitle } from "@/lib/education";
import { canViewBoard, homePath } from "@/lib/permissions";
import { useHydrated } from "@/lib/use-hydrated";
import AppHeader from "@/components/app/AppHeader";
import Notice from "@/components/app/Notice";
import { Loading } from "@/components/app/RoleGate";
import BoardView from "@/components/board/BoardView";
import JoinBoard from "@/components/board/JoinBoard";

// 최소 단위 교육의 고유 URL. 강사·교육생은 이 화면만 본다.
export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const hydrated = useHydrated();
  const user = useAppStore((s) => s.getCurrentUser());
  const { getBoard, getLesson, getRound, getEducation, getDivision, joinBoard, signOut } = useAppStore();

  const board = getBoard(boardId);
  const lesson = getLesson(board?.lessonId);
  const round = getRound(lesson?.roundId);
  const education = getEducation(round?.educationId);
  const division = getDivision(board?.divisionId);

  let content: React.ReactNode;
  let dark = false;

  if (!hydrated) {
    content = <Loading />;
  } else if (!board || !lesson || !round || !education) {
    content = <Notice icon={Lock} title="보드를 찾을 수 없어요" description="URL을 다시 확인해 주세요." />;
  } else if (!user) {
    content = (
      <JoinBoard
        subtitle={`${educationTitle(education.name)} · ${round.order}회차`}
        title={`${lesson.order}차시${division ? ` · ${division.name}` : ""} 보드`}
        onJoin={(name, email) => joinBoard(board.id, name, email)}
      />
    );
  } else if (!canViewBoard(user, board, education.id)) {
    content = (
      <Notice
        icon={Lock}
        title="이 보드에 접근할 수 없어요"
        description="현재 계정은 다른 교육에 연결되어 있어요. 이 보드에 새로 참여하려면 로그아웃해 주세요."
        action={{ label: "로그아웃하고 참여하기", onClick: signOut }}
      />
    );
  } else {
    dark = true;
    content = <BoardView board={board} user={user} />;
  }

  return (
    <div className={"min-h-screen flex flex-col " + (dark ? "bg-[#591a2e]" : "bg-muted/30")}>
      <AppHeader variant={dark ? "light" : "default"} />
      {content}
      {hydrated && user && !dark && board && (
        <p className="pb-10 text-center text-xs text-muted-foreground">
          <Link href={homePath(user)} className="underline underline-offset-4">
            내 화면으로 돌아가기
          </Link>
        </p>
      )}
    </div>
  );
}
