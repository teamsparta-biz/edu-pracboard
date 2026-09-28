"use client";

import { useParams } from "next/navigation";
import { LessonList } from "@/components/hierarchy/Levels";

export default function ClientRound() {
  const { educationId, roundId } = useParams<{ educationId: string; roundId: string }>();
  return <LessonList mode="client" educationId={educationId} roundId={roundId} />;
}
