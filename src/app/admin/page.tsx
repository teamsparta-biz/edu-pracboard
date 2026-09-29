import { listEducations } from "@/lib/data";
import EducationList from "@/components/hierarchy/EducationList";

export default async function AdminHome() {
  return <EducationList mode="admin" educations={await listEducations()} />;
}
