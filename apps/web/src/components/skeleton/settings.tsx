import { Skeleton, SkeletonBlock } from "./skeleton";

export function SettingsSkeleton() {
  return (
    <SkeletonBlock className="page-wrap">
      <header className="page-header">
        <div>
          <Skeleton width={180} height={28} />
          <Skeleton width={280} height={14} style={{ marginTop: 10 }} />
        </div>
      </header>
      <div className="settings-layout">
        <section className="panel settings-reply">
          <Skeleton width={180} height={22} style={{ marginBottom: 12 }} />
          <Skeleton width="70%" height={14} style={{ marginBottom: 16 }} />
          <Skeleton width={420} height={38} radius={6} />
        </section>
        <section className="panel">
          <Skeleton width={180} height={22} style={{ marginBottom: 12 }} />
          <Skeleton width="90%" height={14} style={{ marginBottom: 20 }} />
          <Skeleton width={200} height={18} style={{ marginBottom: 20 }} />
          <div className="form-grid form-grid-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={i >= 6 ? "span-2" : undefined}>
                <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={38} radius={6} />
              </div>
            ))}
          </div>
          <Skeleton width={160} height={36} radius={6} style={{ marginTop: 20 }} />
        </section>
        <section className="panel">
          <Skeleton width={80} height={22} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={200} radius={8} />
        </section>
      </div>
    </SkeletonBlock>
  );
}
