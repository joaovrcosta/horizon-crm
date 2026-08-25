import { Skeleton, SkeletonBlock } from "./skeleton";

export function PromptsSkeleton() {
  return (
    <SkeletonBlock className="prompts-page">
      <div className="page-header">
        <Skeleton width={180} height={28} />
        <Skeleton width={150} height={36} radius={6} />
      </div>
      <div className="list-toolbar prompts-toolbar">
        <div className="list-toolbar-row">
          <Skeleton width="100%" height={38} radius={6} style={{ flex: 1 }} />
          <Skeleton width={240} height={38} radius={6} />
          <Skeleton width={90} height={38} radius={6} />
        </div>
      </div>
      <div className="prompt-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <article key={i} className="prompt-card">
            <Skeleton width="55%" height={18} />
            <div className="tags" style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <Skeleton width={64} height={20} radius={999} />
              <Skeleton width={48} height={20} radius={999} />
            </div>
            <Skeleton width="100%" height={72} style={{ marginTop: 14 }} />
            <div
              className="prompt-actions"
              style={{ marginTop: 14, display: "flex", gap: 8 }}
            >
              <Skeleton width={88} height={34} radius={6} />
              <Skeleton width={80} height={34} radius={6} />
            </div>
          </article>
        ))}
      </div>
    </SkeletonBlock>
  );
}
