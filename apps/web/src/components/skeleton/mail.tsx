import { Skeleton, SkeletonBlock } from "./skeleton";

export function MailListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="mail-table" role="presentation">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mail-tr list-item-skeleton">
          <span className="mail-check">
            <Skeleton width={16} height={16} radius={4} />
          </span>
          <span className="mail-col-to">
            <Skeleton width={`${48 + (i % 3) * 14}%`} height={14} />
          </span>
          <span className="mail-col-subject">
            <Skeleton width={`${62 + (i % 4) * 8}%`} height={14} />
          </span>
          <span className="mail-col-date">
            <Skeleton width={52} height={12} style={{ marginLeft: "auto" }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function MailSkeleton() {
  return (
    <SkeletonBlock className="mail-page">
      <div className="mail-toolbar">
        <Skeleton width={248} height={36} radius={999} />
        <Skeleton
          height={38}
          radius={999}
          style={{ flex: 1, maxWidth: 520, minWidth: 140 }}
        />
        <Skeleton width={118} height={28} />
        <Skeleton width={112} height={36} radius={8} />
      </div>
      <div className="mail-table-wrap">
        <div className="mail-table-head">
          <span className="mail-check">
            <Skeleton width={16} height={16} radius={4} />
          </span>
          <span className="mail-col-to">
            <Skeleton width={72} height={11} />
          </span>
          <span className="mail-col-subject">
            <Skeleton width={68} height={11} />
          </span>
          <span className="mail-col-date">
            <Skeleton width={40} height={11} style={{ marginLeft: "auto" }} />
          </span>
        </div>
        <MailListSkeleton rows={12} />
      </div>
    </SkeletonBlock>
  );
}
