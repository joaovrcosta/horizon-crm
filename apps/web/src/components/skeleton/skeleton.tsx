import type { CSSProperties } from "react";

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: CSSProperties;
};

export function Skeleton({
  className = "",
  width,
  height,
  radius,
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
      aria-hidden
    />
  );
}

export function SkeletonBlock({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-block${className ? ` ${className}` : ""}`}
      aria-busy="true"
      aria-label="Carregando"
    >
      {children}
    </div>
  );
}
