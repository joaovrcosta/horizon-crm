import { Skeleton, SkeletonBlock } from "./skeleton";

export function DashboardSkeleton() {
  return (
    <SkeletonBlock className="dashboard-page dash-soft">
      <div className="page-header dashboard-header">
        <div>
          <Skeleton width={140} height={28} />
          <Skeleton width={220} height={14} style={{ marginTop: 10 }} />
        </div>
        <div className="dashboard-header-actions">
          <Skeleton width={320} height={40} radius={999} />
          <Skeleton width={140} height={36} radius={999} />
        </div>
      </div>
      <div className="metric-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="metric-card">
            <Skeleton width="40%" height={12} />
            <Skeleton width="35%" height={28} style={{ marginTop: 14 }} />
            <Skeleton width="55%" height={12} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid soft">
        <section className="dashboard-panel soft">
          <Skeleton width={160} height={18} style={{ marginBottom: 8 }} />
          <Skeleton width={200} height={12} style={{ marginBottom: 20 }} />
          <Skeleton width="100%" height={12} radius={999} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12,
              marginTop: 18,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={88} radius={14} />
            ))}
          </div>
        </section>
        <section className="dashboard-panel soft">
          <Skeleton width={160} height={18} style={{ marginBottom: 8 }} />
          <Skeleton width={140} height={12} style={{ marginBottom: 20 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Skeleton width={34} height={34} radius={999} />
              <div style={{ flex: 1 }}>
                <Skeleton width="55%" height={12} />
                <Skeleton width="70%" height={10} style={{ marginTop: 8 }} />
              </div>
            </div>
          ))}
        </section>
      </div>
    </SkeletonBlock>
  );
}
