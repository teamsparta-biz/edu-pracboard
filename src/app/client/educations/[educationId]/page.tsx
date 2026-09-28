"use client";

import { useParams } from "next/navigation";
import { RoundList } from "@/components/hierarchy/Levels";

export default function ClientEducation() {
  const { educationId } = useParams<{ educationId: string }>();
  return <RoundList mode="client" educationId={educationId} />;
}
