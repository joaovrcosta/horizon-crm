"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="dashboard">
        <Sidebar />
        <div className="dashboard-main">{children}</div>
      </div>
    </AuthGuard>
  );
}
