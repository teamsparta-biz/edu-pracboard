import { getEducationWithRounds } from "@/lib/data";
import { RoundList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function ClientEducation({ params }: PageProps<"/client/educations/[educationId]">) {
  const { educationId } = await params;
  const data = await getEducationWithRounds(educationId);
  if (!data) return <NotFound label="교육" />;
  return <RoundList mode="client" {...data} />;
}
