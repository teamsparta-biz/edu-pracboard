import { addViewer, removeViewer } from "@/app/actions/admin";
import { getEducationWithRounds, listViewers } from "@/lib/data";
import { RoundList } from "@/components/hierarchy/Levels";
import EmailRoster from "@/components/hierarchy/EmailRoster";
import { NotFound } from "@/components/hierarchy/shared";

export default async function AdminEducation({ params }: PageProps<"/admin/educations/[educationId]">) {
  const { educationId } = await params;
  const [data, viewers] = await Promise.all([getEducationWithRounds(educationId), listViewers(educationId)]);
  if (!data) return <NotFound label="교육" />;
  return (
    <RoundList
      mode="admin"
      {...data}
      actions={
        <EmailRoster
          title="고객사 담당자"
          description="등록된 이메일로 로그인하면 이 교육을 읽기 전용으로 볼 수 있어요. axhub의 교육 담당자는 자동으로 추가돼요."
          placeholder="담당자 이메일 (예: hr@company.com)"
          members={viewers}
          onAdd={addViewer.bind(null, educationId)}
          onRemove={removeViewer.bind(null, educationId)}
        />
      }
    />
  );
}
