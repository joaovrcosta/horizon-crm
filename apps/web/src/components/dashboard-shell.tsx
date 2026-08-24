"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export function DashboardShell({
  children,
  initialSidebarCollapsed = true,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}) {
  return (
    <AuthGuard initialSidebarCollapsed={initialSidebarCollapsed}>
      <div className="dashboard">
        <Sidebar initialCollapsed={initialSidebarCollapsed} />
        <div className="dashboard-main">{children}</div>
      </div>
    </AuthGuard>
  );
}
