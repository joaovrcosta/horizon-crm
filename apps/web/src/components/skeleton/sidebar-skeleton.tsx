"use client";

import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { Skeleton } from "./skeleton";

const NAV_COUNT = 5;

export function SidebarSkeleton({
  initialCollapsed = true,
}: {
  initialCollapsed?: boolean;
}) {
  const { collapsed } = useSidebarCollapsed(initialCollapsed);

  return (
    <aside
      className={`sidebar sidebar-skeleton${collapsed ? " collapsed" : ""}`}
      aria-hidden
    >
      <div className="sidebar-brand-row">
        <div className="sidebar-brand">
          <Skeleton className="sidebar-skeleton-logo" />
          {!collapsed ? (
            <Skeleton className="sidebar-skeleton-brand-text" />
          ) : null}
        </div>
        <Skeleton className="sidebar-skeleton-toggle" />
      </div>

      <nav className="sidebar-nav">
        {Array.from({ length: NAV_COUNT }).map((_, i) =>
          collapsed ? (
            <Skeleton key={i} className="sidebar-skeleton-nav-item" />
          ) : (
            <div key={i} className="sidebar-skeleton-nav-row">
              <Skeleton className="sidebar-skeleton-nav-icon" />
              <Skeleton className="sidebar-skeleton-nav-label" />
            </div>
          ),
        )}
      </nav>

      <div className="sidebar-footer">
        {collapsed ? (
          <>
            <Skeleton className="sidebar-skeleton-nav-item" />
            <Skeleton className="sidebar-skeleton-avatar" />
          </>
        ) : (
          <>
            <div className="sidebar-skeleton-nav-row">
              <Skeleton className="sidebar-skeleton-nav-icon" />
              <Skeleton className="sidebar-skeleton-nav-label" />
            </div>
            <div className="sidebar-skeleton-user-card">
              <Skeleton className="sidebar-skeleton-avatar" />
              <div className="sidebar-skeleton-user-meta">
                <Skeleton className="sidebar-skeleton-user-name" />
                <Skeleton className="sidebar-skeleton-user-email" />
              </div>
              <Skeleton className="sidebar-skeleton-logout" />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
