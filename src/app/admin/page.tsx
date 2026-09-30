// "지금 동기화" 버튼이 이 페이지에서 서버 액션으로 동기화를 돌린다
export const maxDuration = 300;

import { getLastSync, listEducations } from "@/lib/data";
import EducationList from "@/components/hierarchy/EducationList";
import SyncPanel from "@/components/hierarchy/SyncPanel";

export default async function AdminHome() {
  const [educations, last] = await Promise.all([listEducations(), getLastSync()]);
  return (
    <EducationList mode="admin" educations={educations}>
      <SyncPanel last={last} />
    </EducationList>
  );
}
