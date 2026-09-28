"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Repeat } from "lucide-react";
import { useAppStore } from "@/store/AppStore";
import { homePath, roleLabel } from "@/lib/permissions";
import { useHydrated } from "@/lib/use-hydrated";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  variant?: "default" | "light";
};

export default function AppHeader({ variant = "default" }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const storedUser = useAppStore((s) => s.getCurrentUser());
  // 서버 렌더와 맞추기 위해 저장된 로그인 정보는 hydration 이후에만 쓴다.
  const user = hydrated ? storedUser : undefined;
  const signOut = useAppStore((s) => s.signOut);
  const isLight = variant === "light";

  return (
    <header
      className={
        "border-b " +
        (isLight ? "border-white/10 text-white" : "border-border bg-white")
      }
    >
      <div className="max-w-[1800px] mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
        <Link href={user ? homePath(user) : "/"} className="font-bold tracking-tight">
          PracBoard
        </Link>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={
                "flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1 text-sm transition-colors " +
                (isLight ? "hover:bg-white/10" : "hover:bg-muted")
              }
            >
              <span
                className={
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium " +
                  (isLight ? "bg-white/15" : "bg-muted")
                }
              >
                {user.name.charAt(0)}
              </span>
              <span className="hidden sm:inline font-medium">{user.name}</span>
              <Badge
                variant={isLight ? "secondary" : "outline"}
                className={isLight ? "bg-white/15 text-white" : ""}
              >
                {roleLabel[user.role]}
              </Badge>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="text-sm font-medium text-foreground">{user.name}</div>
                  <div className="text-xs font-normal">{user.email}</div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/")}>
                <Repeat /> 데모 계정 전환
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  signOut();
                  router.push("/");
                }}
              >
                <LogOut /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
