import { requireUser } from "@/lib/auth";
import { listInstructorBoards } from "@/lib/data";
import { instructorRounds } from "@/lib/instructor";
import { RoundList } from "@/components/hierarchy/Levels";
import { NotFound } from "@/components/hierarchy/shared";

export default async function InstructorEducation({ params }: PageProps<"/instructor/educations/[educationId]">) {
  const [{ educationId }, user] = await Promise.all([params, requireUser()]);
  const data = instructorRounds(await listInstructorBoards(user.email), educationId);
  if (!data) return <NotFound label="교육" />;
  return <RoundList mode="instructor" {...data} />;
}
