"use client";

import type { DailyGoalToday } from "@horizon/shared";
import { IconStar } from "@/components/icons";

export function DailyGoalStars({
  progress,
  size = 18,
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
      aria-label={`${progress.completed} de ${progress.target} tarefas concluídas hoje`}
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
      <article className={`daily-goal-card${compact ? " is-compact" : ""}`}>
        <p className="daily-goal-loading">Carregando meta…</p>
      </article>
    );
  }

  if (!progress?.visible) return null;

  return (
    <article className={`daily-goal-card${compact ? " is-compact" : ""}`}>
      <div className="daily-goal-card-head">
        <div>
          <span className="daily-goal-label">Meta de hoje</span>
          {!compact ? (
            <p className="daily-goal-desc">
              Ligações, visitas, WhatsApp e e-mails contam como tarefa.
            </p>
          ) : null}
        </div>
        <span className="daily-goal-count">
          {progress.completed}/{progress.target}
        </span>
      </div>

      <DailyGoalStars progress={progress} size={compact ? 16 : 20} />

      <p className="daily-goal-foot">
        {progress.reached ? (
          <strong>Meta alcançada!</strong>
        ) : progress.remaining === 1 ? (
          <>Falta <strong>1</strong> tarefa para bater a meta.</>
        ) : (
          <>
            Faltam <strong>{progress.remaining}</strong> tarefas para a meta.
          </>
        )}
      </p>
    </article>
  );
}
