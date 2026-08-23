import { Skeleton, SkeletonBlock } from "./skeleton";

export function UsersSkeleton() {
  return (
    <SkeletonBlock className="users-page">
      <div className="page-header">
        <Skeleton width={120} height={28} />
        <Skeleton width={140} height={36} radius={6} />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Papel</th>
            <th>Criado em</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td>
                <Skeleton width="70%" height={14} />
              </td>
              <td>
                <Skeleton width="80%" height={14} />
              </td>
              <td>
                <Skeleton width={72} height={14} />
              </td>
              <td>
                <Skeleton width={88} height={14} />
              </td>
              <td>
                <Skeleton width={90} height={32} radius={6} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SkeletonBlock>
  );
}
