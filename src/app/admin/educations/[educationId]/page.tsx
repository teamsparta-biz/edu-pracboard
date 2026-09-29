import { getEducationWithRounds, listViewers } from "@/lib/data";
import { RoundList } from "@/components/hierarchy/Levels";
import ViewerManager from "@/components/hierarchy/ViewerManager";
import { NotFound } from "@/components/hierarchy/shared";

export default async function AdminEducation({ params }: PageProps<"/admin/educations/[educationId]">) {
  const { educationId } = await params;
  const [data, viewers] = await Promise.all([getEducationWithRounds(educationId), listViewers(educationId)]);
  if (!data) return <NotFound label="교육" />;
  return (
    <RoundList mode="admin" {...data}>
      <ViewerManager educationId={educationId} viewers={viewers} />
    </RoundList>
  );
}
