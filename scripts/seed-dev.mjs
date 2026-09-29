// 개발용 초기 데이터. axhub 연동 전까지 화면을 확인하기 위한 교육 계층과 카드 이미지 버킷을 만든다.
// 이미 교육이 있으면 계층 데이터는 건너뛴다.
//
//   node --env-file=.env.local scripts/seed-dev.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BUCKET = "card-images";

const companies = {
  samsung: { name: "삼성전자", domain: "samsung.com" },
  hyundai: { name: "현대자동차", domain: "hyundai.com" },
  kakao: { name: "카카오", domain: "kakaocorp.com" },
};

// 교육 → 회차 → 차시 → (분반)
const educations = [
  {
    company: "samsung",
    name: "[삼성전자] - 신입사원 온보딩",
    rounds: [
      {
        title: "조직 문화 이해하기",
        description: "핵심 가치와 조직 문화를 배웁니다",
        lessons: [{ description: "핵심 가치와 조직 문화 학습 자료" }, { description: "조직 문화 토론 실습" }],
      },
      {
        title: "데이터 기반 의사결정",
        description: "데이터 리터러시 입문",
        lessons: [{ description: "데이터 리터러시 실습", divisions: ["A반", "B반"] }],
      },
    ],
  },
  {
    company: "samsung",
    name: "[삼성전자] - 리더십 아카데미",
    rounds: [
      { title: "셀프 리더십", description: "나를 이끄는 리더십의 시작", lessons: [{ description: "강점 진단 워크숍" }] },
    ],
  },
  {
    company: "hyundai",
    name: "[현대자동차] - 미래 모빌리티 세미나",
    rounds: [
      { title: "전기차 기초", description: "배터리와 구동계 이해", lessons: [{ description: "전기차 구조 정리 실습" }] },
    ],
  },
  {
    company: "kakao",
    name: "[카카오] - 신입 개발자 부트캠프",
    rounds: [
      {
        title: "웹 개발 기초",
        description: "HTML·CSS·JS로 첫 페이지 만들기",
        lessons: [{ description: "나만의 소개 페이지 만들기" }, { description: "API 연동 실습" }],
      },
    ],
  },
];

async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return console.log(`bucket ${BUCKET}: 이미 있음`);
  await must(
    supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/*"],
    }),
  );
  console.log(`bucket ${BUCKET}: 생성`);
}

async function seedHierarchy() {
  const { count } = await supabase.from("educations").select("id", { count: "exact", head: true });
  if (count) return console.log(`educations: ${count}개 있음, 건너뜀`);

  const companyIds = {};
  for (const [key, c] of Object.entries(companies)) {
    companyIds[key] = (await must(supabase.from("companies").insert(c).select("id").single())).id;
  }

  let boards = 0;
  for (const e of educations) {
    const education = await must(
      supabase.from("educations").insert({ company_id: companyIds[e.company], name: e.name }).select("id").single(),
    );
    for (const [ri, r] of e.rounds.entries()) {
      const round = await must(
        supabase
          .from("rounds")
          .insert({ education_id: education.id, position: ri + 1, title: r.title, description: r.description })
          .select("id")
          .single(),
      );
      for (const [li, l] of r.lessons.entries()) {
        const lesson = await must(
          supabase
            .from("lessons")
            .insert({ education_id: education.id, round_id: round.id, position: li + 1, description: l.description })
            .select("id")
            .single(),
        );
        const divisionIds = [];
        for (const [di, name] of (l.divisions ?? []).entries()) {
          const d = await must(
            supabase
              .from("divisions")
              .insert({ education_id: education.id, lesson_id: lesson.id, position: di + 1, name })
              .select("id")
              .single(),
          );
          divisionIds.push(d.id);
        }
        for (const divisionId of divisionIds.length ? divisionIds : [null]) {
          const board = await must(
            supabase
              .from("boards")
              .insert({ education_id: education.id, lesson_id: lesson.id, division_id: divisionId })
              .select("id")
              .single(),
          );
          await must(supabase.from("sections").insert({ board_id: board.id, position: 1, name: "수강생 게시판" }));
          boards++;
        }
      }
    }
  }
  console.log(`educations: ${educations.length}개, boards: ${boards}개 생성`);
}

await ensureBucket();
await seedHierarchy();
