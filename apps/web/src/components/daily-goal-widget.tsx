"use client";

import type { DailyGoalToday } from "@horizon/shared";
import { IconStar } from "@/components/icons";
import { useCountUp } from "@/hooks/use-count-up";

function GoalCount({ value }: { value: number }) {
  const displayed = useCountUp(value);
  return <>{displayed.toLocaleString("pt-BR")}</>;
}

export function DailyGoalStars({
  progress,
  size = 14,
  className = "",
}: {
  progress: DailyGoalToday;
  size?: number;
  className?: string;
}) {
  if (!progress.visible || progress.target <= 0) return null;

  return (
    <div
      className={`daily-goal-stars ${className}`.trim()}
      aria-label={`${progress.completed} de ${progress.target} cadastros hoje`}
    >
      {Array.from({ length: progress.target }, (_, index) => (
        <span
          key={index}
          className={`daily-goal-star${index < progress.completed ? " is-filled" : ""}`}
          aria-hidden
        >
          <IconStar size={size} filled={index < progress.completed} />
        </span>
      ))}
    </div>
  );
}

function goalHint(progress: DailyGoalToday) {
  if (progress.reached) {
    return "Meta alcançada hoje!";
  }
  if (progress.remaining === 1) {
    return "Falta 1 cadastro para bater a meta.";
  }
  return `Faltam ${progress.remaining} cadastros para a meta.`;
}

export function DailyGoalWidget({
  progress,
  loading = false,
  compact = false,
}: {
  progress: DailyGoalToday | null;
  loading?: boolean;
  compact?: boolean;
}) {
  if (loading && !progress) {
    return (
      <article className={`metric-card daily-goal-metric${compact ? " is-compact" : ""}`}>
        <p className="metric-hint">Carregando meta…</p>
      </article>
    );
  }

  if (!progress?.visible) return null;

  return (
    <article className={`metric-card daily-goal-metric${compact ? " is-compact" : ""}`}>
      <div className="metric-card-head">
        <span className="metric-label">Meta de hoje</span>
        <span className={`metric-icon${progress.reached ? " success" : ""}`}>
          <IconStar size={16} filled={progress.reached || progress.completed > 0} />
        </span>
      </div>

      <div className="metric-value-row">
        <strong>
          <GoalCount value={progress.completed} />
        </strong>
        <span className="daily-goal-target">/ {progress.target}</span>
      </div>

      <DailyGoalStars progress={progress} size={compact ? 12 : 14} />

      <p className="metric-hint">{goalHint(progress)}</p>
    </article>
  );
}
