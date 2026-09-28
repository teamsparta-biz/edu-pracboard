"use client";

import { Loader2, Lock, LogIn } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import type { Role } from "@/store/types";
import { homePath } from "@/lib/permissions";
import { useHydrated } from "@/lib/use-hydrated";
import Notice from "./Notice";

type Props = {
  allow: Role[];
  children: React.ReactNode;
};

export function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center py-24">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function RoleGate({ allow, children }: Props) {
  const hydrated = useHydrated();
  const user = useAppStore((s) => s.getCurrentUser());

  if (!hydrated) return <Loading />;
  if (!user) {
    return (
      <Notice
        icon={LogIn}
        title="로그인이 필요해요"
        description="데모 계정을 선택해 들어와 주세요."
        action={{ label: "데모 계정 선택", href: "/" }}
      />
    );
  }
  if (!allow.includes(user.role)) {
    return (
      <Notice
        icon={Lock}
        title="접근 권한이 없어요"
        description="이 화면은 현재 계정으로 볼 수 없어요."
        action={{ label: "내 화면으로 가기", href: homePath(user) }}
      />
    );
  }
  return <>{children}</>;
}
