import { Lock, LogIn } from "lucide-react";
import { joinBoard } from "@/app/actions/auth";
import { addInstructor, removeInstructor } from "@/app/actions/admin";
import { getSessionUser } from "@/lib/auth";
import { getBoardContents, getBoardPreview, getBoardRole, listInstructors, type BoardContext } from "@/lib/data";
import { educationTitle } from "@/lib/education";
import { roleLabel } from "@/lib/permissions";
import AppHeader from "@/components/app/AppHeader";
import Notice from "@/components/app/Notice";
import BoardView from "@/components/board/BoardView";
import EmailRoster from "@/components/hierarchy/EmailRoster";
import JoinBoard from "@/components/board/JoinBoard";

const boardTitle = ({ round, lesson, division, education }: BoardContext) => ({
  subtitle: `${educationTitle(education.name)} · ${round.order}회차`,
  title: `${lesson.order}차시${division ? ` · ${division.name}` : ""} 보드`,
});

// 최소 단위 교육의 고유 URL. 강사·교육생은 이 화면만 본다.
export default async function BoardPage({ params }: PageProps<"/b/[boardId]">) {
  const { boardId } = await params;
  const user = await getSessionUser();
  const role = user ? await getBoardRole(boardId).catch(() => null) : null;

  if (user && role) {
    const contents = await getBoardContents(boardId);
    if (contents) {
      return (
        <div className="min-h-screen flex flex-col bg-[#591a2e]">
          <AppHeader user={user} roleLabel={roleLabel[role]} variant="light" />
          <BoardView {...contents} role={role} userId={user.id}>
            {role === "admin" && (
              <EmailRoster
                title="강사"
                description="등록된 이메일로 로그인하면 이 보드의 섹션과 카드를 관리할 수 있어요. axhub 배정은 자동으로 추가돼요."
                placeholder="강사 이메일"
                members={await listInstructors(boardId)}
                onAdd={addInstructor.bind(null, boardId)}
                onRemove={removeInstructor.bind(null, boardId)}
              />
            )}
          </BoardView>
        </div>
      );
    }
  }

  const preview = await getBoardPreview(boardId);
  let content: React.ReactNode;

  if (!preview) {
    content = <Notice icon={Lock} title="보드를 찾을 수 없어요" description="URL을 다시 확인해 주세요." />;
  } else if (!user) {
    content = <JoinBoard boardId={boardId} {...boardTitle(preview)} />;
  } else {
    // 로그인했지만 이 보드에는 아직 참여하지 않은 경우
    const { subtitle, title } = boardTitle(preview);
    content = (
      <Notice
        icon={LogIn}
        title={`${title}에 참여할까요?`}
        description={`${subtitle} · ${user.email} 계정으로 교육생으로 참여해요.`}
        action={{ label: "참여하기", formAction: joinBoard.bind(null, boardId) }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <AppHeader user={user} />
      {content}
    </div>
  );
}
