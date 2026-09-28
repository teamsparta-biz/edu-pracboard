"use client";

import { useParams } from "next/navigation";
import { DivisionList } from "@/components/hierarchy/Levels";

export default function AdminLesson() {
  const { educationId, roundId, lessonId } = useParams<{
    educationId: string;
    roundId: string;
    lessonId: string;
  }>();
  return <DivisionList mode="admin" educationId={educationId} roundId={roundId} lessonId={lessonId} />;
}
