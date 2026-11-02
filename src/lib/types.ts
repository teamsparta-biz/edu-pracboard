// 화면에서 쓰는 모델. DB 행(snake_case)은 src/lib/data.ts에서 이 형태로 바꾼다.

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

// board_role() 결과. viewer = 교육 담당자(고객사 담당자, 읽기 전용)
export type BoardRole = "admin" | "instructor" | "student" | "viewer";

export type Company = {
  id: string;
  name: string;
};

export type Education = {
  id: string;
  company?: Company;
  // axhub 상태. 직접 만든 교육은 없음
  status?: string;
  // axhub에서 온 항목은 동기화가 관리하므로 화면에서 만들기·수정·삭제를 막는다
  synced: boolean;
  // axhub 원본 교육명. "[기업명] - 교육명" 형태이며, 화면에는 educationTitle()로 교육명만 보여준다.
  name: string;
};

export type Round = {
  id: string;
  educationId: string;
  order: number;
  title: string;
  description: string;
  synced: boolean;
};

export type Lesson = {
  id: string;
  roundId: string;
  order: number;
  description: string;
  synced: boolean;
};

// 분반. 차시 아래에 선택적으로 붙는다.
export type Division = {
  id: string;
  lessonId: string;
  order: number;
  name: string;
};

// 최소 단위 교육. 고유 URL(/b/[id])을 가진다.
// 보통은 차시(또는 분반)에 속하고, 교육 보드(EducationBoard)는 차시 없이 교육에 바로 붙는다.
export type Board = {
  id: string;
  lessonId?: string;
  divisionId?: string;
  cardCount: number;
};

// 교육 단위 보드. 관리자가 직접 만들거나(수동), axhub의 기간형 차시를 모아 동기화가 만든다(synced).
export type EducationBoard = {
  id: string;
  name: string;
  description: string;
  // 기간형 보드. 동기화가 이름을 맞추고 지우므로 화면에서 고치거나 지울 수 없다.
  synced: boolean;
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
  attachment?: Attachment;
  link?: string;
  // 링크 페이지의 대표 이미지(og:image). 카드를 저장한 뒤 서버가 찾아 넣는다
  linkImage?: string;
  authorId: string;
  author: string;
  createdAt: string;
  // 관리자·강사가 올린 카드. 섹션 맨 앞에 고정된다 (DB가 정한다)
  pinned: boolean;
  // 하트를 누른 사람들의 id
  likedBy: string[];
  // 오래된 순
  comments: Comment[];
};

export type Comment = {
  id: string;
  content: string;
  authorId: string;
  author: string;
  // "10-29 14:05" (KST)
  createdAt: string;
};

// 카드 첨부 파일. url은 표시용 서명 URL이고, 원본 경로는 서버에만 둔다.
// 내려받기는 누를 때 원래 파일 이름으로 서명 URL을 따로 발급한다 (getAttachmentDownloadUrl).
export type Attachment = {
  url: string;
  name: string;
  type: string;
  size?: number;
};

export type Viewer = {
  email: string;
  source: "axhub" | "manual";
};
