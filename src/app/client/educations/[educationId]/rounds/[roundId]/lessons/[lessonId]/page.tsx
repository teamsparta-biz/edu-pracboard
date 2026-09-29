import { getLessonWithDivisions } from "@/lib/data";
import { DivisionList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function ClientLesson({
  params,
}: PageProps<"/client/educations/[educationId]/rounds/[roundId]/lessons/[lessonId]">) {
  const { educationId, roundId, lessonId } = await params;
  const data = await getLessonWithDivisions(educationId, roundId, lessonId);
  if (!data) return <NotFound label="차시" />;
  return <DivisionList mode="client" {...data} />;
}
