import type { Board, Division, Education, Lesson, Round } from "@/lib/types";
import type { InstructorBoard } from "@/lib/data";

// 강사 화면의 교육 → 회차 → 차시 → 분반 목록을 강사로 등록된 보드에서 만든다.
// 같은 교육이라도 다른 강사의 보드만 있는 회차·차시·분반은 보이지 않는다.

const board = (b: InstructorBoard): Board => ({ ...b.board, cardCount: b.cardCount });
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

// 키가 같은 것끼리 묶는다 (Map은 처음 나온 순서를 유지한다)
function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups.values()];
}

export function instructorEducations(boards: InstructorBoard[]): (Education & { roundCount: number; boardCount: number })[] {
  return groupBy(boards, (b) => b.education.id).map((group) => ({
    ...group[0].education,
    roundCount: new Set(group.map((b) => b.round.id)).size,
    boardCount: group.length,
  }));
}

export function instructorRounds(boards: InstructorBoard[], educationId: string) {
  const mine = boards.filter((b) => b.education.id === educationId);
  if (!mine.length) return null;
  const rounds = groupBy(mine, (b) => b.round.id)
    .map((group): Round & { lessonCount: number } => ({
      ...group[0].round,
      lessonCount: new Set(group.map((b) => b.lesson.id)).size,
    }))
    .sort(byOrder);
  return { education: mine[0].education, rounds };
}

export function instructorLessons(boards: InstructorBoard[], educationId: string, roundId: string) {
  const mine = boards.filter((b) => b.education.id === educationId && b.round.id === roundId);
  if (!mine.length) return null;
  const lessons = groupBy(mine, (b) => b.lesson.id)
    .map((group): Lesson & { divisionCount: number; board?: Board } => {
      const plain = group.find((b) => !b.division);
      return {
        ...group[0].lesson,
        divisionCount: group.filter((b) => b.division).length,
        board: plain && board(plain),
      };
    })
    .sort(byOrder);
  return { education: mine[0].education, round: mine[0].round, lessons };
}

export function instructorDivisions(boards: InstructorBoard[], educationId: string, roundId: string, lessonId: string) {
  const mine = boards.filter(
    (b) => b.education.id === educationId && b.round.id === roundId && b.lesson.id === lessonId && b.division,
  );
  if (!mine.length) return null;
  const divisions = mine
    .map((b): Division & { board?: Board } => ({ ...b.division!, board: board(b) }))
    .sort(byOrder);
  return { education: mine[0].education, round: mine[0].round, lesson: mine[0].lesson, divisions };
}
