"use client";

import { Skeleton, SkeletonBlock } from "./skeleton";
import { SidebarSkeleton } from "./sidebar-skeleton";
import { DashboardSkeleton } from "./dashboard";
import { PipelineSkeleton } from "./pipeline";
import { ProspectsSkeleton } from "./prospects";
import { PromptsSkeleton } from "./prompts";
import { UsersSkeleton } from "./users";
import { SettingsSkeleton } from "./settings";
import { MailSkeleton } from "./mail";

function pageSkeletonForPath(pathname: string) {
  if (pathname.startsWith("/prospects")) return <ProspectsSkeleton />;
  if (pathname.startsWith("/mail")) return <MailSkeleton />;
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
      <header className="mobile-topbar" aria-hidden>
        <Skeleton className="mobile-topbar-toggle-skeleton" />
        <div className="mobile-topbar-brand">
          <img
            src="/brand/horizon-logo.svg"
            alt=""
            className="mobile-topbar-logo"
            width={85}
            height={28}
          />
          <span>horizon.</span>
        </div>
      </header>
      <SidebarSkeleton initialCollapsed={initialSidebarCollapsed} />
      <div className="dashboard-main">{pageSkeletonForPath(pathname)}</div>
    </SkeletonBlock>
  );
}
