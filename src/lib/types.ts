// 화면에서 쓰는 모델. DB 행(snake_case)은 src/lib/data.ts에서 이 형태로 바꾼다.

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

// board_role() 결과. viewer = 고객사 담당자(읽기 전용)
export type BoardRole = "admin" | "instructor" | "student" | "viewer";

export type Company = {
  id: string;
  name: string;
};

export type Education = {
  id: string;
  company?: Company;
  // axhub 원본 교육명. "[기업명] - 교육명" 형태이며, 화면에는 educationTitle()로 교육명만 보여준다.
  name: string;
};

export type Round = {
  id: string;
  educationId: string;
  order: number;
  title: string;
  description: string;
};

export type Lesson = {
  id: string;
  roundId: string;
  order: number;
  description: string;
};

// 분반. 차시 아래에 선택적으로 붙는다.
export type Division = {
  id: string;
  lessonId: string;
  order: number;
  name: string;
};

// 최소 단위 교육. 고유 URL(/b/[id])을 가진다.
export type Board = {
  id: string;
  lessonId: string;
  divisionId?: string;
  cardCount: number;
};

export type Section = {
  id: string;
  boardId: string;
  order: number;
  name: string;
};

export type Card = {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  // 표시용 서명 URL. 원본 경로는 서버에만 둔다.
  image?: string;
  link?: string;
  authorId: string;
  author: string;
  createdAt: string;
};

export type Viewer = {
  email: string;
  source: "axhub" | "manual";
};
