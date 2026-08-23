import { Skeleton, SkeletonBlock } from "./skeleton";

export function DashboardSkeleton() {
  return (
    <SkeletonBlock className="dashboard-page">
      <div className="page-header">
        <Skeleton width={160} height={28} />
        <Skeleton width={140} height={36} radius={6} />
      </div>
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card">
            <Skeleton width="40%" height={12} />
            <Skeleton width="50%" height={28} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <section className="dashboard-section">
        <Skeleton width={100} height={18} style={{ marginBottom: 16 }} />
        <div className="status-bars">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="status-bar-row">
              <Skeleton width={80} height={12} />
              <Skeleton height={8} radius={999} style={{ flex: 1 }} />
              <Skeleton width={24} height={12} />
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-section">
        <Skeleton width={160} height={18} style={{ marginBottom: 16 }} />
        <div className="overdue-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overdue-item">
              <div style={{ flex: 1 }}>
                <Skeleton width="45%" height={14} />
                <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
              </div>
              <Skeleton width={100} height={12} />
            </div>
          ))}
        </div>
      </section>
    </SkeletonBlock>
  );
}
