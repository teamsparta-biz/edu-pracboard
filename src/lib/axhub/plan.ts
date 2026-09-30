// axhub 차시 → PracBoard 차시·분반 묶기. 외부 호출 없는 순수 함수라 따로 확인할 수 있다.
//
// axhub에는 분반 컬럼이 없고, 반마다 차시(course_sessions)를 따로 만든다.
// 그래서 한 회차 안에서 같은 날짜에 시간이 겹치는 차시들을 분반으로 본다.
//   - 그날 차시가 하나            → PracBoard 차시 하나, 분반 없음 (보드 하나)
//   - 시간이 겹치는 차시 여러 개  → PracBoard 차시 하나, 분반 여러 개 (반마다 보드)
//   - 같은 날이어도 안 겹치면     → 서로 다른 PracBoard 차시 (오전·오후)

export type AxhubSession = {
  id: string;
  roundId: string;
  date: string; // YYYY-MM-DD
  startTime: number | null; // 13.5 = 13시 30분
  endTime: number | null;
  name: string | null;
};

export type PlannedLesson = {
  key: string;
  roundId: string;
  position: number;
  description: string;
  // 한 개면 분반 없음
  sessions: { session: AxhubSession; divisionName: string }[];
};

const overlaps = (a: AxhubSession, b: AxhubSession) =>
  a.startTime == null || b.startTime == null || a.endTime == null || b.endTime == null
    ? true // 시간이 비어 있으면 같은 시간대로 본다
    : a.startTime < b.endTime && b.startTime < a.endTime;

// 한 회차의 axhub 차시들을 PracBoard 차시 목록으로 묶는다.
export function planLessons(roundId: string, sessions: AxhubSession[]): PlannedLesson[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? 0) - (b.startTime ?? 0) ||
      (a.name ?? "").localeCompare(b.name ?? "", "ko") ||
      a.id.localeCompare(b.id),
  );

  // 날짜별로 시간이 겹치는 것끼리 묶는다
  const groups: { date: string; slot: number; sessions: AxhubSession[] }[] = [];
  for (const s of sorted) {
    const sameDay = groups.filter((g) => g.date === s.date);
    const group = sameDay.find((g) => g.sessions.some((other) => overlaps(other, s)));
    if (group) group.sessions.push(s);
    else groups.push({ date: s.date, slot: sameDay.length, sessions: [s] });
  }

  return groups.map((g, i) => ({
    key: `${roundId}:${g.date}:${g.slot}`,
    roundId,
    position: i + 1,
    description: describe(g.sessions),
    sessions: g.sessions.map((session, j) => ({ session, divisionName: session.name?.trim() || `${j + 1}반` })),
  }));
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 예: "10/2(목) 09:00–17:00"
function describe(sessions: AxhubSession[]) {
  const [first] = sessions;
  const [y, mo, d] = first.date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const starts = sessions.map((s) => s.startTime).filter((v): v is number => v != null);
  const ends = sessions.map((s) => s.endTime).filter((v): v is number => v != null);
  const time = starts.length && ends.length ? ` ${formatHour(Math.min(...starts))}–${formatHour(Math.max(...ends))}` : "";
  return `${mo}/${d}(${weekday})${time}`;
}
