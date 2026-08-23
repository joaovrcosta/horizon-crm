"use client";

import { Skeleton, SkeletonBlock } from "./skeleton";
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

export function AppShellSkeleton({ pathname = "/" }: { pathname?: string }) {
  return (
    <SkeletonBlock className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand-row" style={{ padding: "16px 18px" }}>
          <Skeleton width={100} height={20} />
        </div>
        <nav
          className="sidebar-nav"
          style={{ padding: "8px 12px", gap: 6, display: "grid" }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={36} radius={6} />
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">{pageSkeletonForPath(pathname)}</div>
    </SkeletonBlock>
  );
}
