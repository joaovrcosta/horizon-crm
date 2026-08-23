"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProspectStats } from "@horizon/shared";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@horizon/shared";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/prospect-utils";
import { IconProspects } from "@/components/icons";
import { DashboardSkeleton } from "@/components/skeleton";

export default function DashboardPage() {
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<ProspectStats>("/stats/prospects")
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const maxStatus = stats
    ? Math.max(...Object.values(stats.byStatus), 1)
    : 1;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link className="btn btn-primary" href="/prospects">
          <IconProspects size={16} />
          Ir para Prospects
        </Link>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {stats ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Total</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="stat-card warn">
              <span>Follow-ups atrasados</span>
              <strong>{stats.overdueCount}</strong>
            </div>
            <div className="stat-card">
              <span>Para hoje</span>
              <strong>{stats.dueTodayCount}</strong>
            </div>
            <div className="stat-card success">
              <span>Ganhos no mês</span>
              <strong>{stats.wonThisMonth}</strong>
            </div>
          </div>

          <section className="dashboard-section">
            <h2>Por status</h2>
            <div className="status-bars">
              {PROSPECT_STATUSES.map((status) => {
                const value = stats.byStatus[status];
                const width = `${Math.round((value / maxStatus) * 100)}%`;
                return (
                  <div key={status} className="status-bar-row">
                    <span>{STATUS_LABELS[status]}</span>
                    <div className="status-bar-track">
                      <div className="status-bar-fill" style={{ width }} />
                    </div>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="dashboard-section">
            <h2>Follow-ups atrasados</h2>
            {stats.overdue.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Nenhum follow-up atrasado.</p>
            ) : (
              <div className="overdue-list">
                {stats.overdue.map((item) => (
                  <Link
                    key={item.id}
                    href={`/prospects?id=${item.id}`}
                    className="overdue-item"
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.assigneeName || "Sem responsável"} ·{" "}
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <span className="overdue">{formatDateTime(item.nextContactAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
