"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/store/AppStore";
import Breadcrumb from "@/components/layout/Breadcrumb";
import { Calendar, BookOpen } from "lucide-react";

export default function Educations() {
  const { enterpriseId } = useParams<{ enterpriseId: string }>();
  const { getEnterprise, getEducationsByEnterprise, getRoundsByEducation } =
    useAppStore();
  const enterprise = getEnterprise(enterpriseId);
  const educations = getEducationsByEnterprise(enterpriseId);

  if (!enterprise) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        기업을 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Breadcrumb items={[{ label: "기업", to: "/" }, { label: enterprise.name }]} />
        <div className="mt-6 mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {enterprise.name} 교육 과정
          </h1>
          <p className="mt-2 text-muted-foreground">수강 중인 교육 과정을 선택해 주세요.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {educations.map((ed) => {
            const rounds = getRoundsByEducation(ed.id);
            return (
              <Link
                key={ed.id}
                href={`/enterprises/${enterpriseId}/educations/${ed.id}`}
                className="group bg-white rounded-2xl border border-border p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
              >
                <span className="text-xs font-medium text-muted-foreground">교육 과정</span>
                <h2 className="mt-1 text-lg font-semibold leading-snug">{ed.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                  {ed.description}
                </p>
                <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {ed.period}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> {rounds.length}회차
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
