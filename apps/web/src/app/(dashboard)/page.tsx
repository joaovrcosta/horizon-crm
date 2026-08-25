"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MetricTrend, ProspectStats } from "@horizon/shared";
import { STATUS_LABELS } from "@horizon/shared";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/prospect-utils";
import {
  DashboardPeriodFilter,
  type DashboardPeriodPreset,
} from "@/components/dashboard-period-filter";
import {
  IconAlert,
  IconCalendar,
  IconProspects,
  IconTrophy,
  IconUsers,
} from "@/components/icons";
import { DashboardSkeleton } from "@/components/skeleton";
import { StatusChart } from "@/components/status-chart";

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function TrendPill({
  trend,
  invert = false,
}: {
  trend: MetricTrend;
  invert?: boolean;
}) {
  const positive = invert ? trend.delta <= 0 : trend.delta >= 0;
  const tone = trend.delta === 0 ? "muted" : positive ? "ok" : "bad";

  return (
    <span className={`metric-pill ${tone}`}>
      {formatSigned(trend.delta)}
    </span>
  );
}

function trendHint(trend: MetricTrend, current: number, period: string) {
  const previous = current - trend.delta;
  return (
    <>
      <span className="metric-hint-num">{formatSigned(trend.delta)}</span>
      {" vs "}
      <span className="metric-hint-num">{previous}</span>
      {` ${period}`}
    </>
  );
}

function buildStatsPath(
  preset: DashboardPeriodPreset,
  customFrom: string,
  customTo: string,
) {
  if (preset === "custom") {
    return `/stats/prospects?from=${customFrom}&to=${customTo}`;
  }
  return `/stats/prospects?days=${preset}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preset, setPreset] = useState<DashboardPeriodPreset>(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustom, setAppliedCustom] = useState({ from: "", to: "" });

  const loadStats = useCallback(async () => {
    if (preset === "custom" && (!appliedCustom.from || !appliedCustom.to)) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const path =
        preset === "custom" && appliedCustom.from && appliedCustom.to
          ? buildStatsPath("custom", appliedCustom.from, appliedCustom.to)
          : buildStatsPath(preset === "custom" ? 1 : preset, "", "");
      const data = await apiFetch<ProspectStats>(path);
      setStats(data);
    } catch (err) {
      setStats(null);
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [appliedCustom.from, appliedCustom.to, preset]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-page dash-soft">
      <div className="page-header dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral dos clientes e follow-ups</p>
        </div>
        <div className="dashboard-header-actions">
          <DashboardPeriodFilter
            preset={preset}
            customFrom={customFrom}
            customTo={customTo}
            onPresetChange={setPreset}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onApplyCustom={() =>
              setAppliedCustom({ from: customFrom, to: customTo })
            }
          />
          <Link className="btn btn-primary" href="/prospects">
            <IconProspects size={16} />
            Ir para Clientes
          </Link>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {stats ? (
        <>
          <div className={`metric-grid${loading ? " is-loading" : ""}`}>
            <article className="metric-card">
              <div className="metric-card-head">
                <span className="metric-label">Clientes</span>
                <span className="metric-icon">
                  <IconUsers size={16} />
                </span>
              </div>
              <div className="metric-value-row">
                <strong>{stats.total}</strong>
                <TrendPill trend={stats.trends.total} />
              </div>
              <p className="metric-hint">
                {trendHint(
                  stats.trends.total,
                  stats.total,
                  stats.period.compareLabel,
                )}
              </p>
            </article>

            <article className="metric-card">
              <div className="metric-card-head">
                <span className="metric-label">Atrasados</span>
                <span className="metric-icon warn">
                  <IconAlert size={16} />
                </span>
              </div>
              <div className="metric-value-row">
                <strong>{stats.overdueCount}</strong>
                <TrendPill trend={stats.trends.overdue} invert />
              </div>
              <p className="metric-hint">
                {trendHint(
                  stats.trends.overdue,
                  stats.overdueCount,
                  stats.period.compareLabel,
                )}
              </p>
            </article>

            <article className="metric-card">
              <div className="metric-card-head">
                <span className="metric-label">Para hoje</span>
                <span className="metric-icon">
                  <IconCalendar size={16} />
                </span>
              </div>
              <div className="metric-value-row">
                <strong>{stats.dueTodayCount}</strong>
                <TrendPill trend={stats.trends.dueToday} />
              </div>
              <p className="metric-hint">
                {trendHint(
                  stats.trends.dueToday,
                  stats.dueTodayCount,
                  stats.period.compareLabel,
                )}
              </p>
            </article>

            <article className="metric-card">
              <div className="metric-card-head">
                <span className="metric-label">Ganhos no período</span>
                <span className="metric-icon success">
                  <IconTrophy size={16} />
                </span>
              </div>
              <div className="metric-value-row">
                <strong>{stats.wonThisMonth}</strong>
                <TrendPill trend={stats.trends.wonThisMonth} />
              </div>
              <p className="metric-hint">
                {trendHint(
                  stats.trends.wonThisMonth,
                  stats.wonThisMonth,
                  stats.period.compareLabel,
                )}
              </p>
            </article>
          </div>

          <div className={`dashboard-grid soft${loading ? " is-loading" : ""}`}>
            <section className="dashboard-panel soft">
              <header className="dashboard-panel-header">
                <div>
                  <h2>Gestão de clientes</h2>
                  <p>Distribuição por status do funil</p>
                </div>
                <span className="panel-chip">Status</span>
              </header>
              <StatusChart byStatus={stats.byStatus} />
            </section>

            <section className="dashboard-panel soft">
              <header className="dashboard-panel-header">
                <div>
                  <h2>Follow-ups atrasados</h2>
                  <p>Prioridades para hoje</p>
                </div>
                <span className="panel-chip">
                  {stats.overdue.length}
                </span>
              </header>
              {stats.overdue.length === 0 ? (
                <div className="dashboard-empty-box">
                  <p>Nenhum follow-up atrasado.</p>
                  <span>Tudo em dia por enquanto.</span>
                </div>
              ) : (
                <div className="overdue-list soft">
                  {stats.overdue.map((item) => (
                    <Link
                      key={item.id}
                      href={`/prospects?id=${item.id}`}
                      className="overdue-item soft"
                    >
                      <div className="overdue-avatar" aria-hidden>
                        {item.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.assigneeName || "Sem responsável"} ·{" "}
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <span className="overdue">
                        {formatDateTime(item.nextContactAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
