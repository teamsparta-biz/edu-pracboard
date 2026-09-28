export type Role = "admin" | "client" | "instructor" | "student";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  // 고객사 담당자: read 권한이 부여된 교육
  educationIds?: string[];
  // 강사 / 교육생: 접근 가능한 보드(최소 단위 교육) 하나
  boardId?: string;
};

export type Company = {
  id: string;
  name: string;
  domain: string;
  color: string;
  textColor?: string;
};

export type Education = {
  id: string;
  companyId: string;
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
// 분반이 없는 차시는 보드 1개, 분반이 있는 차시는 분반마다 보드 1개.
export type Board = {
  id: string;
  lessonId: string;
  divisionId?: string;
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
  image?: string;
  link?: string;
  authorId: string;
  author: string;
  createdAt: string;
};
