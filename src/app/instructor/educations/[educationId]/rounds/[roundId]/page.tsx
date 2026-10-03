import { requireUser } from "@/lib/auth";
import { listInstructorBoards } from "@/lib/data";
import { instructorLessons } from "@/lib/instructor";
import { LessonList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function InstructorRound({
  params,
}: PageProps<"/instructor/educations/[educationId]/rounds/[roundId]">) {
  const [{ educationId, roundId }, user] = await Promise.all([params, requireUser()]);
  const data = instructorLessons(await listInstructorBoards(user.email), educationId, roundId);
  if (!data) return <NotFound label="회차" />;
  return <LessonList mode="instructor" {...data} />;
}
