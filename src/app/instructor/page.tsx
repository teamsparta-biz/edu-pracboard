import { requireUser } from "@/lib/auth";
import { listInstructorBoards } from "@/lib/data";
import { instructorEducations } from "@/lib/instructor";
import EducationList from "@/components/hierarchy/EducationList";

export default async function InstructorHome() {
  const user = await requireUser();
  return <EducationList mode="instructor" educations={instructorEducations(await listInstructorBoards(user.email))} />;
}
