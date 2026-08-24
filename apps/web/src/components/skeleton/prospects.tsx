import { Skeleton, SkeletonBlock } from "./skeleton";

function ProspectListItemSkeleton() {
  return (
    <div className="list-item list-item-skeleton">
      <Skeleton width="55%" height={15} />
      <Skeleton width="75%" height={12} style={{ marginTop: 8 }} />
      <div
        className="meta"
        style={{ marginTop: 10, gap: 8, display: "flex", alignItems: "center" }}
      >
        <Skeleton width={88} height={20} radius={999} />
        <Skeleton width={72} height={20} radius={999} />
        <Skeleton width={96} height={12} style={{ marginLeft: "auto" }} />
      </div>
    </div>
  );
}

/** Só a lista — quando o layout da página já está montado. */
export function ProspectsListSkeleton() {
  return (
    <SkeletonBlock className="list-skeleton">
      <div className="list-section-label">
        <Skeleton width={56} height={11} />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <ProspectListItemSkeleton key={i} />
      ))}
    </SkeletonBlock>
  );
}

/** Painel de detalhe (overview) do prospect selecionado. */
export function ProspectDetailSkeleton() {
  return (
    <SkeletonBlock>
      <div className="detail-tabs">
        <Skeleton width={72} height={14} />
      </div>

      <div className="detail-section">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Skeleton width={180} height={26} />
          <Skeleton width={120} height={22} radius={999} />
        </div>

        <dl className="kv-grid" style={{ marginTop: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="kv-row">
              <dt>
                <Skeleton width={90} height={12} />
              </dt>
              <dd>
                <Skeleton width="100%" height={36} radius={6} />
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="actions-row" style={{ flexWrap: "wrap" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={104} height={36} radius={6} />
        ))}
      </div>

      <div className="detail-section">
        <Skeleton width={56} height={18} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={96} radius={8} />
      </div>

      <div className="detail-section">
        <Skeleton width={88} height={18} style={{ marginBottom: 12 }} />
        <div
          className="activity-form"
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <Skeleton width={96} height={38} radius={6} />
          <Skeleton height={38} radius={6} style={{ flex: 1 }} />
          <Skeleton width={100} height={38} radius={6} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="timeline-item"
            style={{ marginBottom: 10, padding: 14 }}
          >
            <div
              className="timeline-meta"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Skeleton width={72} height={14} />
              <Skeleton width={140} height={12} />
            </div>
            <Skeleton width="100%" height={12} />
            <Skeleton width="85%" height={12} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </SkeletonBlock>
  );
}

/** Página completa: lista + detalhe (auth / Suspense). */
export function ProspectsSkeleton() {
  return (
    <SkeletonBlock className="split-view">
      <aside className="list-pane">
        <div className="list-header">
          <Skeleton width={110} height={22} />
        </div>

        <div className="list-toolbar">
          <div className="list-toolbar-row">
            <Skeleton height={38} radius={6} style={{ flex: 1 }} />
            <Skeleton width={96} height={38} radius={6} />
          </div>
        </div>

        <div className="list-items">
          <ProspectsListSkeleton />
        </div>

        <div className="list-footer">
          <Skeleton width="100%" height={42} radius={6} />
        </div>
      </aside>

      <section className="detail-pane">
        <div className="detail-tabs">
          <Skeleton width={72} height={14} />
          <Skeleton width={80} height={14} />
        </div>
        <div style={{ paddingTop: 8 }}>
          <Skeleton width="40%" height={28} />
          <Skeleton width="55%" height={14} style={{ marginTop: 12 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 24,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton width={72} height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={36} radius={6} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </SkeletonBlock>
  );
}
