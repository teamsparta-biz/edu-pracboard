import { getRoundWithLessons } from "@/lib/data";
import { LessonList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function ClientRound({ params }: PageProps<"/client/educations/[educationId]/rounds/[roundId]">) {
  const { educationId, roundId } = await params;
  const data = await getRoundWithLessons(educationId, roundId);
  if (!data) return <NotFound label="회차" />;
  return <LessonList mode="client" {...data} />;
}
