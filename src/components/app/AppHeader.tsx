"use client";

import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/types";
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
  user?: SessionUser | null;
  roleLabel?: string;
  variant?: "default" | "light";
};

export default function AppHeader({ user, roleLabel, variant = "default" }: Props) {
  const isLight = variant === "light";

  return (
    <header
      className={
        "border-b " +
        (isLight ? "border-white/10 text-white" : "border-border bg-white")
      }
    >
      <div className="max-w-[1800px] mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight">
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
              {roleLabel && (
                <Badge
                  variant={isLight ? "secondary" : "outline"}
                  className={isLight ? "bg-white/15 text-white" : ""}
                >
                  {roleLabel}
                </Badge>
              )}
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
              <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
                <LogOut /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
