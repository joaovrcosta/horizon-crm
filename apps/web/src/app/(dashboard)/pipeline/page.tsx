"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Prospect, ProspectStatus } from "@horizon/shared";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@horizon/shared";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime, isOverdue } from "@/lib/prospect-utils";
import { PipelineSkeleton } from "@/components/skeleton";

export default function PipelinePage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<Prospect[]>("/prospects");
      setProspects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const columns = useMemo(() => {
    const map = Object.fromEntries(
      PROSPECT_STATUSES.map((s) => [s, [] as Prospect[]]),
    ) as Record<ProspectStatus, Prospect[]>;
    for (const p of prospects) {
      map[p.status].push(p);
    }
    return map;
  }, [prospects]);

  async function moveToStatus(id: string, status: ProspectStatus) {
    const current = prospects.find((p) => p.id === id);
    if (!current || current.status === status) return;

    setProspects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );

    try {
      const updated = await apiFetch<Prospect>(`/prospects/${id}`, {
        method: "PATCH",
        body: { status },
      });
      setProspects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao mover");
      void load();
    }
  }

  if (loading) {
    return <PipelineSkeleton />;
  }

  return (
    <div className="pipeline-page">
      <div className="page-header">
        <h1>Funil</h1>
        <button className="btn btn-secondary" type="button" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      <div className="kanban">
        {PROSPECT_STATUSES.map((status) => (
          <div
            key={status}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingId) void moveToStatus(draggingId, status);
              setDraggingId(null);
            }}
          >
            <header>
              <strong>{STATUS_LABELS[status]}</strong>
              <span>{columns[status].length}</span>
            </header>
            <div className="kanban-cards">
              {columns[status].map((p) => (
                <article
                  key={p.id}
                  className={`kanban-card${draggingId === p.id ? " dragging" : ""}`}
                  draggable
                  onDragStart={() => setDraggingId(p.id)}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => router.push(`/prospects?id=${p.id}`)}
                >
                  <strong>{p.name}</strong>
                  <span>{p.assigneeName || "Sem responsável"}</span>
                  <span
                    className={
                      isOverdue(p.nextContactAt, p.status) ? "overdue" : ""
                    }
                  >
                    {p.nextContactAt
                      ? `Próx: ${formatDateTime(p.nextContactAt)}`
                      : "Sem follow-up"}
                  </span>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
