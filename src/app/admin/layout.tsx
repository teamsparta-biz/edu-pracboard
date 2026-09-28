"use client";

import AppHeader from "@/components/app/AppHeader";
import RoleGate from "@/components/app/RoleGate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader />
      <RoleGate allow={["admin"]}>{children}</RoleGate>
    </div>
  );
}
