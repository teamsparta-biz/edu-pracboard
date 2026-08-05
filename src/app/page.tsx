"use client";

import Link from "next/link";
import { useAppStore } from "@/store/AppStore";
import { Building2, ArrowUpRight, GraduationCap } from "lucide-react";

export default function Home() {
  const { enterprises, getEducationsByEnterprise } = useAppStore();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            <Building2 className="w-3.5 h-3.5" /> 기업 교육 자료 플랫폼
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">기업 선택</h1>
          <p className="mt-2 text-muted-foreground">교육을 진행 중인 기업을 선택해 주세요.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enterprises.map((e) => {
            const count = getEducationsByEnterprise(e.id).length;
            return (
              <Link
                key={e.id}
                href={`/enterprises/${e.id}`}
                className="group relative bg-white rounded-2xl border border-border p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mb-4"
                  style={{ backgroundColor: e.color, color: e.textColor || "#fff" }}
                >
                  {e.name.charAt(0)}
                </div>
                <h2 className="text-lg font-semibold">{e.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {e.description}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GraduationCap className="w-3.5 h-3.5" /> 진행 중인 교육 {count}개
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
