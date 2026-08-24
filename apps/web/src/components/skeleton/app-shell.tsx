"use client";

import { SkeletonBlock } from "./skeleton";
import { SidebarSkeleton } from "./sidebar-skeleton";
import { DashboardSkeleton } from "./dashboard";
import { PipelineSkeleton } from "./pipeline";
import { ProspectsSkeleton } from "./prospects";
import { PromptsSkeleton } from "./prompts";
import { UsersSkeleton } from "./users";
import { SettingsSkeleton } from "./settings";

function pageSkeletonForPath(pathname: string) {
  if (pathname.startsWith("/prospects")) return <ProspectsSkeleton />;
  if (pathname.startsWith("/pipeline")) return <PipelineSkeleton />;
  if (pathname.startsWith("/prompts")) return <PromptsSkeleton />;
  if (pathname.startsWith("/users")) return <UsersSkeleton />;
  if (pathname.startsWith("/settings")) return <SettingsSkeleton />;
  return <DashboardSkeleton />;
}

export function AppShellSkeleton({
  pathname = "/",
  initialSidebarCollapsed = true,
}: {
  pathname?: string;
  initialSidebarCollapsed?: boolean;
}) {
  return (
    <SkeletonBlock className="dashboard">
      <SidebarSkeleton initialCollapsed={initialSidebarCollapsed} />
      <div className="dashboard-main">{pageSkeletonForPath(pathname)}</div>
    </SkeletonBlock>
  );
}
