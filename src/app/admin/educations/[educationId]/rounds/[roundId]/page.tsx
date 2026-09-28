"use client";

import { useParams } from "next/navigation";
import { LessonList } from "@/components/hierarchy/Levels";

export default function AdminRound() {
  const { educationId, roundId } = useParams<{ educationId: string; roundId: string }>();
  return <LessonList mode="admin" educationId={educationId} roundId={roundId} />;
}
