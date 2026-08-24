import { Skeleton } from "./skeleton";

export function VaultsSkeleton() {
  return (
    <div className="vaults-page">
      <div className="page-header">
        <Skeleton width={120} height={28} />
        <Skeleton width={130} height={38} radius={6} />
      </div>

      <div className="split-view vaults-split">
        <section className="list-pane vault-list-pane">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Skeleton height={38} radius={6} style={{ flex: 1 }} />
            <Skeleton width={80} height={38} radius={6} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              height={56}
              radius={8}
              style={{ marginBottom: 8 }}
            />
          ))}
        </section>

        <section className="detail-pane vault-detail-pane">
          <Skeleton width={180} height={24} />
          <Skeleton width="60%" height={14} style={{ marginTop: 10 }} />
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 24,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={160} radius={10} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
