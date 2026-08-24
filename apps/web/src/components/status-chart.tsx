"use client";

import type { ProspectStatus } from "@horizon/shared";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@horizon/shared";

export const STATUS_COLORS: Record<ProspectStatus, string> = {
  NEW: "#6366f1",
  CONTACTED: "#34d399",
  NEGOTIATING: "#a78bfa",
  WON: "#34d399",
  LOST: "#fb7185",
};

type StatusChartProps = {
  byStatus: Record<ProspectStatus, number>;
};

export function StatusChart({ byStatus }: StatusChartProps) {
  const total = PROSPECT_STATUSES.reduce(
    (sum, status) => sum + (byStatus[status] ?? 0),
    0,
  );

  return (
    <div className="leads-status">
      <div
        className="leads-status-bar"
        role="img"
        aria-label="Distribuição por status"
      >
        {total === 0 ? (
          <div className="leads-status-bar-empty" />
        ) : (
          PROSPECT_STATUSES.map((status) => {
            const value = byStatus[status] ?? 0;
            if (value <= 0) return null;
            const pct = (value / total) * 100;
            return (
              <div
                key={status}
                className="leads-status-segment"
                style={{
                  width: `${pct}%`,
                  background: STATUS_COLORS[status],
                }}
                title={`${STATUS_LABELS[status]}: ${value}`}
              />
            );
          })
        )}
      </div>

      <div className="leads-status-grid">
        {PROSPECT_STATUSES.map((status) => {
          const value = byStatus[status] ?? 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <div key={status} className="leads-status-tile">
              <div className="leads-status-tile-top">
                <span
                  className="leads-status-dot"
                  style={{ background: STATUS_COLORS[status] }}
                />
                <span>{STATUS_LABELS[status]}</span>
              </div>
              <strong>{value}</strong>
              <em>
                {value === 1 ? "1 cliente" : `${value} clientes`} · {pct}%
              </em>
              <div className="leads-status-tile-track">
                <div
                  className="leads-status-tile-fill"
                  style={{
                    width: `${pct}%`,
                    background: STATUS_COLORS[status],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
