"use client";

import AppHeader from "@/components/app/AppHeader";
import RoleGate from "@/components/app/RoleGate";

export default function ClientLayout({ children }: LayoutProps<"/client">) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <AppHeader />
      <RoleGate allow={["client"]}>{children}</RoleGate>
    </div>
  );
}
