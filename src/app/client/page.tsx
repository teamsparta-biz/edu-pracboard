import { listEducations } from "@/lib/data";
import EducationList from "@/components/hierarchy/EducationList";

export default async function ClientHome() {
  return <EducationList mode="client" educations={await listEducations()} />;
}
