import { Skeleton, SkeletonBlock } from "./skeleton";

export function PipelineSkeleton() {
  return (
    <SkeletonBlock className="pipeline-page">
      <div className="page-header">
        <Skeleton width={80} height={28} />
        <Skeleton width={100} height={36} radius={6} />
      </div>
      <div className="kanban">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="kanban-column">
            <header>
              <Skeleton width={90} height={14} />
              <Skeleton width={20} height={14} />
            </header>
            <div className="kanban-cards">
              {Array.from({ length: 3 }).map((_, card) => (
                <div key={card} className="kanban-card">
                  <Skeleton width="70%" height={14} />
                  <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
                  <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonBlock>
  );
}
