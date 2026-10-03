import { requireUser } from "@/lib/auth";
import { listInstructorBoards } from "@/lib/data";
import { instructorDivisions } from "@/lib/instructor";
import { DivisionList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function InstructorLesson({
  params,
}: PageProps<"/instructor/educations/[educationId]/rounds/[roundId]/lessons/[lessonId]">) {
  const [{ educationId, roundId, lessonId }, user] = await Promise.all([params, requireUser()]);
  const data = instructorDivisions(await listInstructorBoards(user.email), educationId, roundId, lessonId);
  if (!data) return <NotFound label="차시" />;
  return <DivisionList mode="instructor" {...data} />;
}
