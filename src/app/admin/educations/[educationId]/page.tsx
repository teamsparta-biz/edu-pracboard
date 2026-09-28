"use client";

import { useParams } from "next/navigation";
import { RoundList } from "@/components/hierarchy/Levels";

export default function AdminEducation() {
  const { educationId } = useParams<{ educationId: string }>();
  return <RoundList mode="admin" educationId={educationId} />;
}
