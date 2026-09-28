import { create } from "zustand";
import { persist } from "zustand/middleware";
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
import {
  seedBoards,
  seedCards,
  seedCompanies,
  seedDivisions,
  seedEducations,
  seedLessons,
  seedRounds,
  seedSections,
  seedUsers,
} from "./seed";

export type * from "./types";

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
  description?: string;
};

type AppState = {
  users: User[];
  currentUserId: string | null;
  companies: Company[];
  educations: Education[];
  rounds: Round[];
  lessons: Lesson[];
  divisions: Division[];
  boards: Board[];
  sections: Section[];
  cards: Card[];

  getCurrentUser: () => User | undefined;
  getCompany: (id?: string) => Company | undefined;
  getEducation: (id?: string) => Education | undefined;
  getRound: (id?: string) => Round | undefined;
  getLesson: (id?: string) => Lesson | undefined;
  getDivision: (id?: string) => Division | undefined;
  getBoard: (id?: string) => Board | undefined;

  getRoundsByEducation: (educationId?: string) => Round[];
  getLessonsByRound: (roundId?: string) => Lesson[];
  getDivisionsByLesson: (lessonId?: string) => Division[];
  getBoardsByLesson: (lessonId?: string) => Board[];
  getBoardsByEducation: (educationId?: string) => Board[];
  getSectionsByBoard: (boardId?: string) => Section[];
  getCardsBySection: (sectionId?: string) => Card[];
  getCardCountByBoard: (boardId?: string) => number;

  signIn: (userId: string) => void;
  signOut: () => void;
  joinBoard: (boardId: string, name: string, email: string) => void;

  addRound: (educationId: string, data: NewRoundInput) => void;
  addLesson: (roundId: string, data: NewLessonInput) => void;
  addSection: (boardId: string, name: string) => string;
  deleteSection: (sectionId: string) => void;
  addCard: (sectionId: string, data: NewCardInput) => void;
  deleteCard: (cardId: string) => void;
};

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter}`;
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      users: seedUsers,
      currentUserId: null,
      companies: seedCompanies,
      educations: seedEducations,
      rounds: seedRounds,
      lessons: seedLessons,
      divisions: seedDivisions,
      boards: seedBoards,
      sections: seedSections,
      cards: seedCards,

      getCurrentUser: () => get().users.find((u) => u.id === get().currentUserId),
      getCompany: (id) => get().companies.find((c) => c.id === id),
      getEducation: (id) => get().educations.find((e) => e.id === id),
      getRound: (id) => get().rounds.find((r) => r.id === id),
      getLesson: (id) => get().lessons.find((l) => l.id === id),
      getDivision: (id) => get().divisions.find((d) => d.id === id),
      getBoard: (id) => get().boards.find((b) => b.id === id),

      getRoundsByEducation: (educationId) =>
        get().rounds.filter((r) => r.educationId === educationId).sort(byOrder),
      getLessonsByRound: (roundId) =>
        get().lessons.filter((l) => l.roundId === roundId).sort(byOrder),
      getDivisionsByLesson: (lessonId) =>
        get().divisions.filter((d) => d.lessonId === lessonId).sort(byOrder),
      getBoardsByLesson: (lessonId) => get().boards.filter((b) => b.lessonId === lessonId),
      getBoardsByEducation: (educationId) => {
        const roundIds = new Set(
          get()
            .rounds.filter((r) => r.educationId === educationId)
            .map((r) => r.id),
        );
        const lessonIds = new Set(
          get()
            .lessons.filter((l) => roundIds.has(l.roundId))
            .map((l) => l.id),
        );
        return get().boards.filter((b) => lessonIds.has(b.lessonId));
      },
      getSectionsByBoard: (boardId) =>
        get().sections.filter((s) => s.boardId === boardId).sort(byOrder),
      getCardsBySection: (sectionId) =>
        get()
          .cards.filter((c) => c.sectionId === sectionId)
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      getCardCountByBoard: (boardId) => {
        const sectionIds = new Set(
          get()
            .sections.filter((s) => s.boardId === boardId)
            .map((s) => s.id),
        );
        return get().cards.filter((c) => sectionIds.has(c.sectionId)).length;
      },

      signIn: (userId) => set({ currentUserId: userId }),
      signOut: () => set({ currentUserId: null }),

      // 교육생이 보드 URL로 들어와 회원가입하면, 그 보드에 묶인 계정이 된다.
      joinBoard: (boardId, name, email) => {
        const user: User = { id: nextId("u"), name, email, role: "student", boardId };
        set((state) => ({ users: [...state.users, user], currentUserId: user.id }));
      },

      addRound: (educationId, data) =>
        set((state) => {
          const order = state.rounds.filter((r) => r.educationId === educationId).length + 1;
          const round: Round = {
            id: nextId("round"),
            educationId,
            order,
            title: data.title,
            description: data.description ?? "",
          };
          return { rounds: [...state.rounds, round] };
        }),

      // 분반 없는 차시를 만들면 보드와 기본 섹션이 함께 생긴다.
      addLesson: (roundId, data) =>
        set((state) => {
          const order = state.lessons.filter((l) => l.roundId === roundId).length + 1;
          const lessonId = nextId("lesson");
          const lesson: Lesson = { id: lessonId, roundId, order, description: data.description ?? "" };
          const board: Board = { id: nextId("b"), lessonId };
          const section: Section = { id: nextId("section"), boardId: board.id, order: 1, name: "수강생 게시판" };
          return {
            lessons: [...state.lessons, lesson],
            boards: [...state.boards, board],
            sections: [...state.sections, section],
          };
        }),

      addSection: (boardId, name) => {
        const id = nextId("section");
        set((state) => {
          const order = state.sections.filter((s) => s.boardId === boardId).length + 1;
          const section: Section = { id, boardId, order, name };
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
          const user = state.users.find((u) => u.id === state.currentUserId);
          const card: Card = {
            id: nextId("card"),
            sectionId,
            title: data.title,
            content: data.content ?? "",
            image: data.image,
            link: data.link,
            authorId: user?.id ?? "",
            author: user?.name ?? "익명",
            createdAt: new Date().toISOString().slice(0, 10),
          };
          return { cards: [...state.cards, card] };
        }),

      deleteCard: (cardId) =>
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== cardId),
        })),
    }),
    { name: "praboard-store-v4" },
  ),
);
