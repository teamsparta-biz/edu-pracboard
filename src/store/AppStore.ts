import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Enterprise = {
  id: string;
  name: string;
  description: string;
  color: string;
  textColor?: string;
};

export type Education = {
  id: string;
  enterpriseId: string;
  name: string;
  description: string;
  period: string;
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
  title: string;
  description: string;
};

export type Section = {
  id: string;
  lessonId: string;
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
  author: string;
  createdAt: string;
};

type NewCardInput = {
  title: string;
  content?: string;
  image?: string;
  link?: string;
};

type NewRoundInput = {
  title: string;
  description?: string;
};

type NewLessonInput = {
  title: string;
  description?: string;
};

type AppState = {
  enterprises: Enterprise[];
  educations: Education[];
  rounds: Round[];
  lessons: Lesson[];
  sections: Section[];
  cards: Card[];

  getEnterprise: (id?: string) => Enterprise | undefined;
  getEducation: (id?: string) => Education | undefined;
  getRound: (id?: string) => Round | undefined;
  getLesson: (id?: string) => Lesson | undefined;
  getSection: (id?: string) => Section | undefined;

  getEducationsByEnterprise: (enterpriseId?: string) => Education[];
  getRoundsByEducation: (educationId?: string) => Round[];
  getLessonsByRound: (roundId?: string) => Lesson[];
  getSectionsByLesson: (lessonId?: string) => Section[];
  getCardsBySection: (sectionId?: string) => Card[];
  getCardCountByLesson: (lessonId?: string) => number;
  getCardCountByRound: (roundId?: string) => number;

  addRound: (educationId: string, data: NewRoundInput) => void;
  addLesson: (roundId: string, data: NewLessonInput) => void;
  addSection: (lessonId: string, name: string) => string;
  deleteSection: (sectionId: string) => void;
  addCard: (sectionId: string, data: NewCardInput) => void;
  deleteCard: (cardId: string) => void;
};

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

const seedEnterprises: Enterprise[] = [
  {
    id: "ent-samsung",
    name: "삼성전자",
    description: "혁신의 시작, 함께 만드는 미래",
    color: "#1c2b8f",
    textColor: "#ffffff",
  },
  {
    id: "ent-hyundai",
    name: "현대자동차",
    description: "인류의 새로운 미래를 향한 도약",
    color: "#0a2e5c",
    textColor: "#ffffff",
  },
  {
    id: "ent-kakao",
    name: "카카오",
    description: "모두의 일상을 더 편리하게",
    color: "#f7e600",
    textColor: "#1c1c1c",
  },
  {
    id: "ent-naver",
    name: "네이버",
    description: "기술로 모두의 경험을 한 단계 더",
    color: "#3cba54",
    textColor: "#ffffff",
  },
  {
    id: "ent-lg",
    name: "LG전자",
    description: "Life's Good, 더 나은 삶을 위한 기술",
    color: "#a1004b",
    textColor: "#ffffff",
  },
];

const seedEducations: Education[] = [
  {
    id: "edu-onboarding",
    enterpriseId: "ent-samsung",
    name: "신입사원 온보딩",
    description: "2026년 상반기 신입사원 필수 과정",
    period: "2026.03 ~ 2026.06",
  },
  {
    id: "edu-leadership",
    enterpriseId: "ent-samsung",
    name: "리더십 아카데미",
    description: "차세대 리더 양성 프로그램",
    period: "2026.04 ~ 2026.09",
  },
  {
    id: "edu-dx",
    enterpriseId: "ent-samsung",
    name: "DX 전환 실무 교육",
    description: "디지털 트랜스포메이션 실무 과정",
    period: "2026.05 ~ 2026.08",
  },
  {
    id: "edu-hyundai-1",
    enterpriseId: "ent-hyundai",
    name: "미래 모빌리티 세미나",
    description: "전기차·자율주행 기술 이해",
    period: "2026.04 ~ 2026.07",
  },
  {
    id: "edu-kakao-1",
    enterpriseId: "ent-kakao",
    name: "신입 개발자 부트캠프",
    description: "카카오 서비스 개발 실전 과정",
    period: "2026.03 ~ 2026.06",
  },
  {
    id: "edu-naver-1",
    enterpriseId: "ent-naver",
    name: "AI 서비스 기획 과정",
    description: "AI 기반 서비스 기획 실무",
    period: "2026.05 ~ 2026.08",
  },
  {
    id: "edu-lg-1",
    enterpriseId: "ent-lg",
    name: "스마트팩토리 실무 교육",
    description: "제조 현장 디지털 전환 실무",
    period: "2026.04 ~ 2026.07",
  },
];

const seedRounds: Round[] = [
  {
    id: "round-onboarding-1",
    educationId: "edu-onboarding",
    order: 1,
    title: "조직 문화 이해하기",
    description: "핵심 가치와 조직 문화를 배웁니다",
  },
  {
    id: "round-onboarding-2",
    educationId: "edu-onboarding",
    order: 2,
    title: "비즈니스 매너와 소통",
    description: "직장인 필수 커뮤니케이션 스킬",
  },
  {
    id: "round-onboarding-3",
    educationId: "edu-onboarding",
    order: 3,
    title: "데이터 기반 의사결정",
    description: "데이터 리터러시 입문",
  },
  {
    id: "round-onboarding-4",
    educationId: "edu-onboarding",
    order: 4,
    title: "업무 자동화 워크플로우",
    description: "반복 업무를 줄이는 도구 활용법",
  },
];

const seedLessons: Lesson[] = [
  {
    id: "lesson-onboarding-1",
    roundId: "round-onboarding-1",
    order: 1,
    title: "1차시",
    description: "핵심 가치와 조직 문화 학습 자료",
  },
  {
    id: "lesson-onboarding-2",
    roundId: "round-onboarding-2",
    order: 1,
    title: "1차시",
    description: "커뮤니케이션 스킬 학습 자료",
  },
  {
    id: "lesson-onboarding-3",
    roundId: "round-onboarding-3",
    order: 1,
    title: "1차시",
    description: "데이터 리터러시 학습 자료",
  },
  {
    id: "lesson-onboarding-4",
    roundId: "round-onboarding-4",
    order: 1,
    title: "1차시",
    description: "업무 자동화 도구 학습 자료",
  },
];

const seedSections: Section[] = [
  { id: "section-onboarding-1-1", lessonId: "lesson-onboarding-1", order: 1, name: "교안 자료" },
  { id: "section-onboarding-1-2", lessonId: "lesson-onboarding-1", order: 2, name: "수강생 게시판" },
  { id: "section-onboarding-2-1", lessonId: "lesson-onboarding-2", order: 1, name: "수강생 게시판" },
  { id: "section-onboarding-3-1", lessonId: "lesson-onboarding-3", order: 1, name: "수강생 게시판" },
  { id: "section-onboarding-4-1", lessonId: "lesson-onboarding-4", order: 1, name: "수강생 게시판" },
];

const seedCards: Card[] = [
  {
    id: "card-1",
    sectionId: "section-onboarding-1-1",
    title: "핵심 가치 5대 원칙",
    content:
      "신입사원이 꼭 알아야 할 5가지 핵심 가치를 한 장으로 정리했어요. 사람, 기술, 미래를 향한 우리의 약속.",
    link: "https://www.samsung.com",
    author: "김교육",
    createdAt: "2026-03-02",
  },
  {
    id: "card-2",
    sectionId: "section-onboarding-1-2",
    title: "조직 문화 인포그래픽",
    content:
      "부서별 협업 구조와 커뮤니케이션 채널을 한눈에 볼 수 있는 자료입니다. 다운로드해서 활용하세요.",
    image: "https://picsum.photos/seed/praboard-culture/640/400",
    author: "이과장",
    createdAt: "2026-03-05",
  },
  {
    id: "card-3",
    sectionId: "section-onboarding-1-2",
    title: "온보딩 체크리스트",
    content:
      "입사 첫 주, 첫 달에 해야 할 일들을 정리했습니다. 멘토와 함께 하나씩 체크해 보세요.",
    image: "https://picsum.photos/seed/praboard-checklist/640/400",
    author: "박멘토",
    createdAt: "2026-03-08",
  },
  {
    id: "card-4",
    sectionId: "section-onboarding-1-2",
    title: "사내 포털 바로가기 모음",
    content:
      "사내 위키, 메일, 그룹웨어 등 자주 쓰는 포털 링크를 모아뒀습니다. 즐겨찾기 해두세요.",
    link: "https://www.naver.com",
    author: "최신입",
    createdAt: "2026-03-10",
  },
  {
    id: "card-5",
    sectionId: "section-onboarding-1-2",
    title: "팀 빌딩 워크숍 후기",
    content:
      "지난주 워크숍에서 진행했던 활동과 배운 점을 정리했습니다. 다음 워크숍 기획에도 참고해보세요.",
    image: "https://picsum.photos/seed/praboard-workshop/640/400",
    author: "정사원",
    createdAt: "2026-03-12",
  },
  {
    id: "card-6",
    sectionId: "section-onboarding-2-1",
    title: "이메일 작성 가이드",
    content: "사내/외부 이메일 작성 시 지켜야 할 톤앤매너와 형식입니다.",
    author: "김교육",
    createdAt: "2026-03-14",
  },
  {
    id: "card-7",
    sectionId: "section-onboarding-2-1",
    title: "회의 진행 템플릿",
    content: "효율적인 회의를 위한 아젠다·회의록 템플릿을 공유합니다.",
    link: "https://www.notion.so",
    author: "이과장",
    createdAt: "2026-03-16",
  },
  {
    id: "card-8",
    sectionId: "section-onboarding-4-1",
    title: "업무 자동화 도구 모음",
    content: "반복 업무를 줄여주는 사내 승인 도구 사용법입니다.",
    author: "박멘토",
    createdAt: "2026-03-20",
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      enterprises: seedEnterprises,
      educations: seedEducations,
      rounds: seedRounds,
      lessons: seedLessons,
      sections: seedSections,
      cards: seedCards,

      getEnterprise: (id) => get().enterprises.find((e) => e.id === id),
      getEducation: (id) => get().educations.find((e) => e.id === id),
      getRound: (id) => get().rounds.find((r) => r.id === id),
      getLesson: (id) => get().lessons.find((l) => l.id === id),
      getSection: (id) => get().sections.find((s) => s.id === id),

      getEducationsByEnterprise: (enterpriseId) =>
        get().educations.filter((e) => e.enterpriseId === enterpriseId),
      getRoundsByEducation: (educationId) =>
        get()
          .rounds.filter((r) => r.educationId === educationId)
          .sort((a, b) => a.order - b.order),
      getLessonsByRound: (roundId) =>
        get()
          .lessons.filter((l) => l.roundId === roundId)
          .sort((a, b) => a.order - b.order),
      getSectionsByLesson: (lessonId) =>
        get()
          .sections.filter((s) => s.lessonId === lessonId)
          .sort((a, b) => a.order - b.order),
      getCardsBySection: (sectionId) =>
        get()
          .cards.filter((c) => c.sectionId === sectionId)
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      getCardCountByLesson: (lessonId) => {
        const sectionIds = new Set(
          get()
            .sections.filter((s) => s.lessonId === lessonId)
            .map((s) => s.id),
        );
        return get().cards.filter((c) => sectionIds.has(c.sectionId)).length;
      },
      getCardCountByRound: (roundId) => {
        const lessonIds = new Set(
          get()
            .lessons.filter((l) => l.roundId === roundId)
            .map((l) => l.id),
        );
        const sectionIds = new Set(
          get()
            .sections.filter((s) => lessonIds.has(s.lessonId))
            .map((s) => s.id),
        );
        return get().cards.filter((c) => sectionIds.has(c.sectionId)).length;
      },

      addRound: (educationId, data) =>
        set((state) => {
          const order =
            state.rounds.filter((r) => r.educationId === educationId).length + 1;
          const round: Round = {
            id: nextId("round"),
            educationId,
            order,
            title: data.title,
            description: data.description ?? "",
          };
          return { rounds: [...state.rounds, round] };
        }),

      addLesson: (roundId, data) =>
        set((state) => {
          const order = state.lessons.filter((l) => l.roundId === roundId).length + 1;
          const lessonId = nextId("lesson");
          const lesson: Lesson = {
            id: lessonId,
            roundId,
            order,
            title: data.title,
            description: data.description ?? "",
          };
          const section: Section = {
            id: nextId("section"),
            lessonId,
            order: 1,
            name: "수강생 게시판",
          };
          return {
            lessons: [...state.lessons, lesson],
            sections: [...state.sections, section],
          };
        }),

      addSection: (lessonId, name) => {
        const id = nextId("section");
        set((state) => {
          const order =
            state.sections.filter((s) => s.lessonId === lessonId).length + 1;
          const section: Section = { id, lessonId, order, name };
          return { sections: [...state.sections, section] };
        });
        return id;
      },

      deleteSection: (sectionId) =>
        set((state) => ({
          sections: state.sections.filter((s) => s.id !== sectionId),
          cards: state.cards.filter((c) => c.sectionId !== sectionId),
        })),

      addCard: (sectionId, data) =>
        set((state) => {
          const card: Card = {
            id: nextId("card"),
            sectionId,
            title: data.title,
            content: data.content ?? "",
            image: data.image,
            link: data.link,
            author: "나",
            createdAt: new Date().toISOString().slice(0, 10),
          };
          return { cards: [...state.cards, card] };
        }),

      deleteCard: (cardId) =>
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== cardId),
        })),
    }),
    { name: "praboard-store-v2" },
  ),
);
