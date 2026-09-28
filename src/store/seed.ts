import type {
  Board,
  Card,
  Company,
  Division,
  Education,
  Lesson,
  Round,
  Section,
  User,
} from "./types";

export const seedCompanies: Company[] = [
  { id: "samsung", name: "삼성전자", domain: "samsung.com", color: "#1c2b8f", textColor: "#ffffff" },
  { id: "hyundai", name: "현대자동차", domain: "hyundai.com", color: "#0a2e5c", textColor: "#ffffff" },
  { id: "kakao", name: "카카오", domain: "kakaocorp.com", color: "#f7e600", textColor: "#1c1c1c" },
  { id: "naver", name: "네이버", domain: "navercorp.com", color: "#3cba54", textColor: "#ffffff" },
  { id: "lg", name: "LG전자", domain: "lge.com", color: "#a1004b", textColor: "#ffffff" },
];

export const seedEducations: Education[] = [
  { id: "onb", companyId: "samsung", name: "[삼성전자] - 신입사원 온보딩" },
  { id: "lead", companyId: "samsung", name: "[삼성전자] - 리더십 아카데미" },
  { id: "dx", companyId: "samsung", name: "[삼성전자] - DX 전환 실무 교육" },
  { id: "mob", companyId: "hyundai", name: "[현대자동차] - 미래 모빌리티 세미나" },
  { id: "kdev", companyId: "kakao", name: "[카카오] - 신입 개발자 부트캠프" },
  { id: "nai", companyId: "naver", name: "[네이버] - AI 서비스 기획 과정" },
  { id: "sf", companyId: "lg", name: "[LG전자] - 스마트팩토리 실무 교육" },
];

type LessonSpec = { description: string; divisions?: string[] };
type RoundSpec = { title: string; description: string; lessons: LessonSpec[] };

// 교육별 회차 → 차시 → (분반) 구성. 이후 axhub 연동으로 대체된다.
const outline: Record<string, RoundSpec[]> = {
  onb: [
    {
      title: "조직 문화 이해하기",
      description: "핵심 가치와 조직 문화를 배웁니다",
      lessons: [
        { description: "핵심 가치와 조직 문화 학습 자료" },
        { description: "조직 문화 토론 실습" },
      ],
    },
    {
      title: "비즈니스 매너와 소통",
      description: "직장인 필수 커뮤니케이션 스킬",
      lessons: [{ description: "커뮤니케이션 스킬 실습" }],
    },
    {
      title: "데이터 기반 의사결정",
      description: "데이터 리터러시 입문",
      lessons: [{ description: "데이터 리터러시 실습", divisions: ["A반", "B반"] }],
    },
    {
      title: "업무 자동화 워크플로우",
      description: "반복 업무를 줄이는 도구 활용법",
      lessons: [{ description: "업무 자동화 도구 실습" }],
    },
  ],
  lead: [
    {
      title: "셀프 리더십",
      description: "나를 이끄는 리더십의 시작",
      lessons: [{ description: "강점 진단 워크숍" }],
    },
    {
      title: "팀 코칭",
      description: "구성원의 성장을 돕는 대화법",
      lessons: [{ description: "코칭 대화 롤플레이", divisions: ["1분반", "2분반", "3분반"] }],
    },
  ],
  dx: [
    {
      title: "DX 개념과 사례",
      description: "업계 DX 사례 분석",
      lessons: [{ description: "사례 분석 실습" }],
    },
  ],
  mob: [
    {
      title: "전기차 기초",
      description: "배터리와 구동계 이해",
      lessons: [{ description: "전기차 구조 정리 실습" }],
    },
  ],
  kdev: [
    {
      title: "웹 개발 기초",
      description: "HTML·CSS·JS로 첫 페이지 만들기",
      lessons: [
        { description: "나만의 소개 페이지 만들기" },
        { description: "API 연동 실습" },
      ],
    },
    {
      title: "서비스 배포",
      description: "만든 서비스를 세상에 공개하기",
      lessons: [{ description: "배포 실습", divisions: ["A반", "B반"] }],
    },
  ],
  nai: [
    {
      title: "AI 서비스 기획 입문",
      description: "문제 정의와 AI 적용 포인트 찾기",
      lessons: [{ description: "문제 정의 워크시트" }],
    },
  ],
  sf: [
    {
      title: "스마트팩토리 개요",
      description: "제조 현장 데이터 흐름 이해",
      lessons: [{ description: "현장 데이터 맵 그리기" }],
    },
  ],
};

export const seedRounds: Round[] = [];
export const seedLessons: Lesson[] = [];
export const seedDivisions: Division[] = [];
export const seedBoards: Board[] = [];
export const seedSections: Section[] = [];

for (const [educationId, rounds] of Object.entries(outline)) {
  rounds.forEach((r, ri) => {
    const roundId = `${educationId}-r${ri + 1}`;
    seedRounds.push({ id: roundId, educationId, order: ri + 1, title: r.title, description: r.description });

    r.lessons.forEach((l, li) => {
      const lessonId = `${roundId}-l${li + 1}`;
      seedLessons.push({ id: lessonId, roundId, order: li + 1, description: l.description });

      const boards: Board[] = l.divisions
        ? l.divisions.map((name, di) => {
            const divisionId = `${lessonId}-d${di + 1}`;
            seedDivisions.push({ id: divisionId, lessonId, order: di + 1, name });
            return { id: divisionId, lessonId, divisionId };
          })
        : [{ id: lessonId, lessonId }];

      for (const b of boards) {
        seedBoards.push(b);
        seedSections.push({ id: `${b.id}-s1`, boardId: b.id, order: 1, name: "수강생 게시판" });
      }
    });
  });
}

// 첫 보드에는 강사용 섹션을 하나 더 둔다.
seedSections.unshift({ id: "onb-r1-l1-s0", boardId: "onb-r1-l1", order: 0, name: "교안 자료" });

export const seedUsers: User[] = [
  { id: "u-admin", name: "운영 매니저", email: "manager@teamsparta.co", role: "admin" },
  { id: "u-client-samsung", name: "삼성전자 HR 담당자", email: "hr@samsung.com", role: "client", educationIds: ["onb", "lead"] },
  { id: "u-client-kakao", name: "카카오 교육 담당자", email: "edu@kakaocorp.com", role: "client", educationIds: ["kdev"] },
  { id: "u-inst-onb", name: "김교육 강사", email: "kim.instructor@gmail.com", role: "instructor", boardId: "onb-r1-l1" },
  { id: "u-inst-kdev", name: "박멘토 강사", email: "park.mentor@gmail.com", role: "instructor", boardId: "kdev-r1-l1" },
  { id: "u-stu-1", name: "최신입", email: "choi@samsung.com", role: "student", boardId: "onb-r1-l1" },
  { id: "u-stu-2", name: "정사원", email: "jung@samsung.com", role: "student", boardId: "onb-r1-l1" },
  { id: "u-stu-3", name: "한개발", email: "han@kakaocorp.com", role: "student", boardId: "kdev-r1-l1" },
];

export const seedCards: Card[] = [
  {
    id: "card-1",
    sectionId: "onb-r1-l1-s0",
    title: "핵심 가치 5대 원칙",
    content: "신입사원이 꼭 알아야 할 5가지 핵심 가치를 한 장으로 정리했어요. 사람, 기술, 미래를 향한 우리의 약속.",
    link: "https://www.samsung.com",
    authorId: "u-inst-onb",
    author: "김교육 강사",
    createdAt: "2026-03-02",
  },
  {
    id: "card-2",
    sectionId: "onb-r1-l1-s1",
    title: "조직 문화 인포그래픽",
    content: "부서별 협업 구조와 커뮤니케이션 채널을 한눈에 볼 수 있게 정리했습니다.",
    image: "https://picsum.photos/seed/praboard-culture/640/400",
    authorId: "u-stu-1",
    author: "최신입",
    createdAt: "2026-03-05",
  },
  {
    id: "card-3",
    sectionId: "onb-r1-l1-s1",
    title: "온보딩 체크리스트",
    content: "입사 첫 주, 첫 달에 해야 할 일들을 정리했습니다. 멘토와 함께 하나씩 체크해 보세요.",
    image: "https://picsum.photos/seed/praboard-checklist/640/400",
    authorId: "u-stu-2",
    author: "정사원",
    createdAt: "2026-03-08",
  },
  {
    id: "card-4",
    sectionId: "onb-r1-l1-s1",
    title: "팀 빌딩 워크숍 후기",
    content: "워크숍에서 진행했던 활동과 배운 점을 정리했습니다.",
    image: "https://picsum.photos/seed/praboard-workshop/640/400",
    authorId: "u-stu-1",
    author: "최신입",
    createdAt: "2026-03-12",
  },
  {
    id: "card-5",
    sectionId: "onb-r2-l1-s1",
    title: "이메일 작성 가이드",
    content: "사내/외부 이메일 작성 시 지켜야 할 톤앤매너와 형식입니다.",
    authorId: "u-inst-onb",
    author: "김교육 강사",
    createdAt: "2026-03-14",
  },
  {
    id: "card-6",
    sectionId: "kdev-r1-l1-s1",
    title: "나의 첫 소개 페이지",
    content: "HTML과 CSS로 만든 자기소개 페이지입니다. 반응형까지 적용했어요!",
    image: "https://picsum.photos/seed/praboard-profile/640/400",
    link: "https://example.com",
    authorId: "u-stu-3",
    author: "한개발",
    createdAt: "2026-03-20",
  },
];
