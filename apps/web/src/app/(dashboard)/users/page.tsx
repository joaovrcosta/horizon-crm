"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyGoalConfigUser, UserPublic } from "@horizon/shared";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { IconPlus, IconTrash } from "@/components/icons";
import { UsersSkeleton } from "@/components/skeleton";

type GoalDraft = {
  targetCount: string;
  enabled: boolean;
};

export default function UsersPage() {
  const { user, can } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [goalConfigs, setGoalConfigs] = useState<DailyGoalConfigUser[]>([]);
  const [goalDrafts, setGoalDrafts] = useState<Record<string, GoalDraft>>({});
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const canManageGoals = can("goals:manage");

  useEffect(() => {
    if (user && !can("users:read")) {
      router.replace("/prospects");
    }
  }, [user, can, router]);

  function syncGoalDrafts(configs: DailyGoalConfigUser[]) {
    const drafts: Record<string, GoalDraft> = {};
    for (const config of configs) {
      drafts[config.userId] = {
        targetCount: String(config.targetCount),
        enabled: config.enabled,
      };
    }
    setGoalDrafts(drafts);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const requests: [
        Promise<UserPublic[]>,
        Promise<DailyGoalConfigUser[] | null>,
      ] = [
        apiFetch<UserPublic[]>("/users"),
        canManageGoals
          ? apiFetch<DailyGoalConfigUser[]>("/goals/configs")
          : Promise.resolve(null),
      ];
      const [usersData, configsData] = await Promise.all(requests);
      setUsers(usersData);
      if (configsData) {
        setGoalConfigs(configsData);
        syncGoalDrafts(configsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (can("users:read")) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, can, canManageGoals]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await apiFetch<UserPublic>("/users", {
        method: "POST",
        body: form,
      });
      setUsers((prev) => [created, ...prev]);
      setShowModal(false);
      setForm({ name: "", email: "", password: "" });
      if (canManageGoals) {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(target: UserPublic) {
    if (!confirm(`Remover usuário ${target.email}?`)) return;
    try {
      await apiFetch<void>(`/users/${target.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setGoalConfigs((prev) => prev.filter((item) => item.userId !== target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover");
    }
  }

  async function saveGoalConfig(userId: string) {
    const draft = goalDrafts[userId];
    if (!draft) return;

    const targetCount = Number.parseInt(draft.targetCount, 10);
    if (!Number.isFinite(targetCount) || targetCount < 1) {
      setError("A meta diária deve ser um número inteiro maior que zero.");
      return;
    }

    setSavingGoalId(userId);
    setError("");
    try {
      const updated = await apiFetch<DailyGoalConfigUser>(
        `/goals/users/${userId}`,
        {
          method: "PUT",
          body: {
            targetCount,
            enabled: draft.enabled,
          },
        },
      );
      setGoalConfigs((prev) =>
        prev.map((item) => (item.userId === userId ? updated : item)),
      );
      syncGoalDrafts(
        goalConfigs.map((item) => (item.userId === userId ? updated : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar meta");
    } finally {
      setSavingGoalId(null);
    }
  }

  if (!can("users:read")) {
    return null;
  }

  if (loading) {
    return <UsersSkeleton />;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Usuários</h1>
        <button className="btn btn-primary" type="button" onClick={() => setShowModal(true)}>
          <IconPlus size={16} />
          Criar usuário
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

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
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role.name}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
              <td>
                {can("users:delete") && u.id !== user?.id ? (
                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={() => void removeUser(u)}
                  >
                    <IconTrash size={16} />
                    Remover
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {canManageGoals ? (
        <section className="panel users-goals-panel">
          <h2>Metas diárias</h2>
          <p className="panel-desc">
            Defina quantas tarefas cada pessoa deve concluir por dia e escolha
            para quem a meta aparece. Contam ligações, WhatsApp, visitas,
            e-mails e outras atividades registradas.
          </p>
          <table className="table users-goals-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Meta/dia</th>
                <th>Mostrar meta</th>
                <th>Hoje</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {goalConfigs.map((config) => {
                const draft = goalDrafts[config.userId] ?? {
                  targetCount: String(config.targetCount),
                  enabled: config.enabled,
                };
                return (
                  <tr key={config.userId}>
                    <td>
                      <strong>{config.userName}</strong>
                      <span className="users-goals-email">{config.userEmail}</span>
                    </td>
                    <td>
                      <input
                        className="users-goals-target"
                        type="number"
                        min={1}
                        max={100}
                        value={draft.targetCount}
                        onChange={(e) =>
                          setGoalDrafts((prev) => ({
                            ...prev,
                            [config.userId]: {
                              ...draft,
                              targetCount: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <label className="users-goals-toggle">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(e) =>
                            setGoalDrafts((prev) => ({
                              ...prev,
                              [config.userId]: {
                                ...draft,
                                enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                        {draft.enabled ? "Ativa" : "Oculta"}
                      </label>
                    </td>
                    <td>
                      {config.enabled
                        ? `${config.completedToday}/${config.targetCount}`
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={savingGoalId === config.userId}
                        onClick={() => void saveGoalConfig(config.userId)}
                      >
                        {savingGoalId === config.userId ? "Salvando…" : "Salvar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={createUser}>
            <h2>Novo usuário</h2>
            <p className="text-muted">
              Novos usuários são criados como Membro. Promoção a administrador só via banco de dados.
            </p>
            <div className="form-grid">
              <label>
                Nome *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Email *
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Senha *
                <input
                  required
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Criando…" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
